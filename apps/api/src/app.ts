import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { prisma } from '@openmusic/db';
import { SESSION_COOKIE_NAME } from '@openmusic/shared';
import { env } from './config/env';
import { registerAuth } from './lib/auth';
import { BackgroundQueue } from './lib/background';
import { RedisResponseCache, type Clock, type FetchLike } from './lib/upstream';
import { createCatalogProviders, type CatalogProviders } from './modules/catalog/providers';
import { CatalogImportService } from './modules/catalog/catalog-import.service';
import { CatalogEnrichmentService } from './modules/catalog/catalog-enrichment.service';
import { registerErrorHandling } from './lib/error-handler';
import { createRealtimeEmitter, type OpenMusicIo } from './lib/realtime';
import { NowPlayingService } from './modules/now-playing/now-playing.service';
import { registerNowPlayingGateway } from './modules/now-playing/now-playing.gateway';
import { createNowPlayingRoutes } from './modules/now-playing/now-playing.routes';
import { SpotifyService } from './modules/auth/spotify.service';
import { LastFmService } from './modules/auth/lastfm.service';
import { AuthService } from './modules/auth/auth.service';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { AudioPreviewResolverService } from './modules/catalog/audio-preview-resolver.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { createCatalogRoutes } from './modules/catalog/catalog.routes';
import { ReviewsService } from './modules/reviews/reviews.service';
import { createReviewsRoutes } from './modules/reviews/reviews.routes';
import { ProfileService } from './modules/profile/profile.service';
import { createProfileRoutes } from './modules/profile/profile.routes';
import { DiscoveryService } from './modules/discovery/discovery.service';
import { createDiscoveryRoutes } from './modules/discovery/discovery.routes';
import { ChatService } from './modules/chat/chat.service';
import { createChatRoutes } from './modules/chat/chat.routes';
import { PlaylistsService } from './modules/playlists/playlists.service';
import { createPlaylistsRoutes } from './modules/playlists/playlists.routes';
import { NotificationPresenceService } from './modules/notifications/notification-presence.service';
import { NotificationsService } from './modules/notifications/notifications.service';
import { createNotificationsRoutes } from './modules/notifications/notifications.routes';
import { CriticService } from './modules/critic/critic.service';
import { createCriticRoutes } from './modules/critic/critic.routes';
import { VideosService } from './modules/videos/videos.service';
import { createVideosRoutes } from './modules/videos/videos.routes';
import { SpotifySyncService } from './modules/spotify/spotify-sync.service';
import { createSpotifyRoutes } from './modules/spotify/spotify.routes';
import { UsersService } from './modules/users/users.service';
import { createUsersRoutes } from './modules/users/users.routes';
import { FeedService } from './modules/feed/feed.service';
import { createFeedRoutes } from './modules/feed/feed.routes';

export interface AppContext {
  app: FastifyInstance;
  io: OpenMusicIo;
  redis: Redis;
  authService: AuthService;
  nowPlayingService: NowPlayingService;
  catalogService: CatalogService;
  catalogProviders: CatalogProviders;
  catalogImportService: CatalogImportService;
  catalogEnrichmentService: CatalogEnrichmentService;
  /** Background catalog work (dominant colors, MusicBrainz enrichment). */
  catalogBackground: BackgroundQueue;
  reviewsService: ReviewsService;
  profileService: ProfileService;
  discoveryService: DiscoveryService;
  chatService: ChatService;
  playlistsService: PlaylistsService;
  notificationsService: NotificationsService;
  notificationPresenceService: NotificationPresenceService;
  criticService: CriticService;
  videosService: VideosService;
  spotifySyncService: SpotifySyncService;
  usersService: UsersService;
  feedService: FeedService;
}

export interface BuildAppOptions {
  /** Overrides AUTH_RATE_LIMIT_MAX (tests use a high value except in the rate-limit test). */
  authRateLimitMax?: number;
  /**
   * `fetch` used for external catalogs. Tests inject a fixture-backed fake; when omitted in
   * NODE_ENV=test every outbound catalog call fails immediately (tests never hit the network).
   */
  catalogFetch?: FetchLike;
  /** Clock for upstream rate limiting/backoff (tests pass one that does not really sleep). */
  catalogClock?: Clock;
  /** Overrides CATALOG_EXTERNAL_ENABLED. */
  catalogExternalEnabled?: boolean;
  /** Socket gateway tuning (tests shorten these). */
  nowPlayingIntervalMs?: number;
  sessionRecheckMs?: number;
}

const offlineFetch: FetchLike = () =>
  Promise.reject(new Error('External catalog calls are disabled in tests'));

export async function buildApp(options: BuildAppOptions = {}): Promise<AppContext> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
    trustProxy: env.TRUST_PROXY,
  });

  // 1. Security & platform plugins
  await app.register(helmet, {
    // JSON API: no HTML is served, so a locked-down CSP costs nothing.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  });
  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true });
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE_NAME, signed: false },
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  // Opt-in per route (auth endpoints). In-memory store: fine for a single API instance;
  // switch to the Redis store when scaling horizontally.
  await app.register(rateLimit, { global: false });

  registerErrorHandling(app);
  registerAuth(app, prisma, env);

  // 2. Infrastructure
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  const io: OpenMusicIo = new SocketIOServer(app.server, {
    cors: { origin: env.CORS_ORIGINS, credentials: true, methods: ['GET', 'POST'] },
  });
  const realtime = createRealtimeEmitter(io);

  // 3. Services
  const notificationsService = new NotificationsService(prisma, realtime);
  const nowPlayingService = new NowPlayingService(redis, prisma, realtime);
  const spotifyService = new SpotifyService();
  const lastFmService = new LastFmService();
  const authService = new AuthService(prisma, spotifyService, lastFmService);

  const catalogProviders = createCatalogProviders({
    fetch: options.catalogFetch ?? (env.NODE_ENV === 'test' ? offlineFetch : undefined),
    clock: options.catalogClock,
    cache: new RedisResponseCache(redis),
    musicbrainzContact: env.MUSICBRAINZ_CONTACT,
    itunesCountry: env.ITUNES_COUNTRY,
  });
  const catalogBackground = new BackgroundQueue(app.log);
  app.addHook('onClose', async () => catalogBackground.close());
  const catalogImportService = new CatalogImportService(prisma, catalogProviders);
  const catalogEnrichmentService = new CatalogEnrichmentService(
    prisma,
    catalogProviders,
    catalogImportService
  );
  const previewResolver = new AudioPreviewResolverService(catalogProviders);
  const catalogService = new CatalogService(
    prisma,
    previewResolver,
    catalogProviders,
    catalogImportService,
    catalogEnrichmentService,
    catalogBackground,
    app.log,
    {
      externalEnabled:
        options.catalogExternalEnabled ??
        (env.NODE_ENV === 'test' && !options.catalogFetch ? false : env.CATALOG_EXTERNAL_ENABLED),
    }
  );
  const reviewsService = new ReviewsService(prisma, notificationsService);
  const profileService = new ProfileService(prisma);
  const discoveryService = new DiscoveryService(prisma, previewResolver);

  const chatService = new ChatService(prisma, notificationsService, realtime);
  const playlistsService = new PlaylistsService(prisma);
  const notificationPresenceService = new NotificationPresenceService(nowPlayingService);

  const criticService = new CriticService(prisma, notificationsService);
  const videosService = new VideosService(prisma);
  const spotifySyncService = new SpotifySyncService(
    prisma,
    redis,
    spotifyService,
    nowPlayingService
  );
  const usersService = new UsersService(prisma, notificationsService);
  const feedService = new FeedService(prisma, notificationsService);

  const sessionSockets = registerNowPlayingGateway(app, io, prisma, nowPlayingService, {
    nowPlayingIntervalMs: options.nowPlayingIntervalMs,
    sessionRecheckMs: options.sessionRecheckMs,
  });

  // 4. Routes
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await app.register(
    createAuthRoutes(authService, {
      rateLimitMax: options.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX,
      cookieSecure: env.COOKIE_SECURE,
      presence: nowPlayingService,
      sockets: sessionSockets,
      webAppUrl: env.WEB_APP_URL,
    }),
    { prefix: '/api/auth' }
  );
  await app.register(createUsersRoutes(usersService), { prefix: '/api/users' });
  await app.register(createFeedRoutes(feedService), { prefix: '/api' });
  await app.register(createCatalogRoutes(catalogService), { prefix: '/api/catalog' });
  await app.register(createReviewsRoutes(reviewsService), { prefix: '/api/reviews' });
  await app.register(createProfileRoutes(profileService), { prefix: '/api/profile' });
  await app.register(createDiscoveryRoutes(discoveryService), { prefix: '/api/discovery' });
  await app.register(createChatRoutes(chatService), { prefix: '/api/chat' });
  await app.register(createPlaylistsRoutes(playlistsService), { prefix: '/api/playlists' });
  await app.register(createNotificationsRoutes(notificationsService, notificationPresenceService), {
    prefix: '/api/notifications',
  });
  await app.register(createNowPlayingRoutes(nowPlayingService), { prefix: '/api/now-playing' });
  await app.register(createCriticRoutes(criticService), { prefix: '/api/critic' });
  await app.register(createVideosRoutes(videosService), { prefix: '/api/videos' });
  await app.register(createSpotifyRoutes(spotifySyncService), { prefix: '/api/spotify' });

  return {
    app,
    io,
    redis,
    authService,
    nowPlayingService,
    catalogService,
    catalogProviders,
    catalogImportService,
    catalogEnrichmentService,
    catalogBackground,
    reviewsService,
    profileService,
    discoveryService,
    chatService,
    playlistsService,
    notificationsService,
    notificationPresenceService,
    criticService,
    videosService,
    spotifySyncService,
    usersService,
    feedService,
  };
}
