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
import { clientIpResolver } from './lib/client-ip';
import { BackgroundQueue } from './lib/background';
import { RedisResponseCache, systemClock, type Clock, type FetchLike } from './lib/upstream';
import { createCatalogProviders, type CatalogProviders } from './modules/catalog/providers';
import { CatalogImportService } from './modules/catalog/catalog-import.service';
import { CatalogEnrichmentService } from './modules/catalog/catalog-enrichment.service';
import { registerErrorHandling } from './lib/error-handler';
import { createRealtimeEmitter, type OpenMusicIo } from './lib/realtime';
import { NowPlayingService } from './modules/now-playing/now-playing.service';
import { registerNowPlayingGateway } from './modules/now-playing/now-playing.gateway';
import { createNowPlayingRoutes } from './modules/now-playing/now-playing.routes';
import { NowPlayingThrottle } from './modules/now-playing/now-playing.throttle';
import { ListeningActivity } from './modules/now-playing/listening-activity';
import { PollScheduler } from './modules/now-playing/poll-scheduler';
import { ProviderSyncStore } from './modules/now-playing/provider-sync.store';
import { ScrobbleRecorder } from './modules/now-playing/scrobble-recorder';
import {
  NowPlayingPoller,
  type NowPlayingPollerDeps,
  type NowPlayingPollerOptions,
} from './modules/now-playing/now-playing.poller';
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
  spotifyService: SpotifyService;
  lastFmService: LastFmService;
  /** ADR-013: background Spotify/Last.fm reader. Built here, started only by server.ts. */
  nowPlayingPoller: NowPlayingPoller;
  /** What the poller was built with (tests build a second instance from it). */
  nowPlayingPollerDeps: NowPlayingPollerDeps;
  nowPlayingPollerOptions: NowPlayingPollerOptions;
  pollScheduler: PollScheduler;
  listeningActivity: ListeningActivity;
  providerSyncStore: ProviderSyncStore;
  scrobbleRecorder: ScrobbleRecorder;
  nowPlayingThrottle: NowPlayingThrottle;
  /** Scrobble writes / catalog resolution queued by the poller. */
  pollerBackground: BackgroundQueue;
}

export interface BuildAppOptions {
  /** Overrides AUTH_RATE_LIMIT_MAX (tests use a high value except in the rate-limit test). */
  authRateLimitMax?: number;
  /** Overrides TRUST_PROXY (tests). */
  trustProxy?: boolean;
  /** Overrides PROXY_SECRET (tests). */
  proxySecret?: string;
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
  /**
   * `fetch` for Spotify and Last.fm (linked accounts). Tests inject fixtures; when omitted in
   * NODE_ENV=test every call fails immediately.
   */
  providerFetch?: FetchLike;
  /** Overrides LASTFM_API_KEY (tests). */
  lastFmApiKey?: string;
  /** Overrides NOW_PLAYING_POLLER_ENABLED (only what the API reports/schedules; never starts it). */
  nowPlayingPollerEnabled?: boolean;
  /** Clock for the poller, its schedule and the sync status (tests pass a fake one). */
  nowPlayingClock?: Clock;
  /** Overrides of the poller tuning (tests). */
  nowPlayingPoller?: Partial<NowPlayingPollerOptions>;
}

const offlineFetch: FetchLike = () =>
  Promise.reject(new Error('External catalog calls are disabled in tests'));
const offlineProviderFetch: FetchLike = () =>
  Promise.reject(new Error('Spotify/Last.fm calls are disabled in tests'));

export async function buildApp(options: BuildAppOptions = {}): Promise<AppContext> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: options.trustProxy ?? env.TRUST_PROXY,
  });

  // 1. Security & platform plugins
  await app.register(helmet, {
    // JSON API: no HTML is served, so a locked-down CSP costs nothing.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    // @fastify/cors >= 10 defaults to the CORS-safelisted GET,HEAD,POST only: keep the
    // write verbs the web client uses cross-origin (PATCH/PUT/DELETE preflights).
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE_NAME, signed: false },
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  // Opt-in per route (auth endpoints). In-memory store: fine for a single API instance;
  // switch to the Redis store when scaling horizontally. Keyed by the real client IP, also for
  // requests relayed by the web app's same-origin proxy (ADR-014).
  await app.register(rateLimit, {
    global: false,
    keyGenerator: clientIpResolver(options.proxySecret ?? env.PROXY_SECRET),
  });

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
  const providerFetch =
    options.providerFetch ?? (env.NODE_ENV === 'test' ? offlineProviderFetch : undefined);
  const spotifyService = new SpotifyService({ fetch: providerFetch });
  const lastFmService = new LastFmService({ fetch: providerFetch, apiKey: options.lastFmApiKey });
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
  const catalogExternalEnabled =
    options.catalogExternalEnabled ??
    (env.NODE_ENV === 'test' && !options.catalogFetch ? false : env.CATALOG_EXTERNAL_ENABLED);
  const previewResolver = new AudioPreviewResolverService(catalogProviders, {
    externalEnabled: catalogExternalEnabled,
  });
  const catalogService = new CatalogService(
    prisma,
    previewResolver,
    catalogProviders,
    catalogImportService,
    catalogEnrichmentService,
    catalogBackground,
    app.log,
    { externalEnabled: catalogExternalEnabled, previewCache: new RedisResponseCache(redis) }
  );
  const reviewsService = new ReviewsService(prisma, notificationsService);
  const profileService = new ProfileService(prisma);
  const discoveryService = new DiscoveryService(prisma, previewResolver);

  const chatService = new ChatService(prisma, notificationsService, realtime);
  const playlistsService = new PlaylistsService(prisma);
  const notificationPresenceService = new NotificationPresenceService(nowPlayingService);

  const criticService = new CriticService(prisma, notificationsService);
  const videosService = new VideosService(prisma);

  // ADR-013: automatic now-playing sync (Spotify / Last.fm poller).
  const npClock = options.nowPlayingClock ?? systemClock;
  const pollerEnabled = options.nowPlayingPollerEnabled ?? env.NOW_PLAYING_POLLER_ENABLED;
  const providerSyncStore = new ProviderSyncStore(prisma, npClock);
  const scrobbleRecorder = new ScrobbleRecorder(prisma, redis, catalogService);
  const pollScheduler = new PollScheduler(redis, { clock: npClock });
  const nowPlayingThrottle = new NowPlayingThrottle(
    options.nowPlayingIntervalMs ?? 2_000,
    (userId, track) => nowPlayingService.updateUserNowPlaying(userId, track),
    (err, userId) => app.log.warn({ err, userId }, 'Deferred now-playing update failed')
  );
  const nowPlayingPollerOptions: NowPlayingPollerOptions = {
    activeIntervalMs: env.NOW_PLAYING_ACTIVE_INTERVAL_SECONDS * 1000,
    idleIntervalMs: env.NOW_PLAYING_IDLE_INTERVAL_SECONDS * 1000,
    inactiveAfterMs: env.NOW_PLAYING_INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000,
    concurrency: env.NOW_PLAYING_POLL_CONCURRENCY,
    clock: npClock,
    ...options.nowPlayingPoller,
  };
  const listeningActivity = new ListeningActivity(redis, prisma, {
    clock: npClock,
    onUserSeen: async (userId) => {
      // Back after a long absence: accounts paused for inactivity are read again at once.
      if ((await providerSyncStore.resumeUser(userId)) > 0 && pollerEnabled) {
        await pollScheduler.wake(userId);
      }
    },
    onUserOnline: async (userId) => {
      // Opening the app pulls an idle user's next read close (fast interval from then on).
      if (pollerEnabled) await pollScheduler.expedite(userId, npClock.now() + 2_000);
    },
  });

  const spotifySyncService = new SpotifySyncService(
    prisma,
    redis,
    spotifyService,
    nowPlayingService,
    scrobbleRecorder,
    providerSyncStore
  );
  const pollerBackground = new BackgroundQueue(app.log, 2, 500);
  const nowPlayingPollerDeps: NowPlayingPollerDeps = {
    prisma,
    redis,
    logger: app.log,
    scheduler: pollScheduler,
    activity: listeningActivity,
    store: providerSyncStore,
    spotify: spotifyService,
    spotifyTokens: spotifySyncService,
    lastfm: lastFmService,
    presence: {
      submit: (userId, track) => nowPlayingThrottle.submit(userId, track),
      refresh: (userId) => nowPlayingService.refreshTrack(userId),
      clear: async (userId) => {
        nowPlayingThrottle.cancel(userId);
        await nowPlayingService.clearTrack(userId);
      },
    },
    scrobbles: scrobbleRecorder,
    background: pollerBackground,
  };
  const nowPlayingPoller = new NowPlayingPoller(nowPlayingPollerDeps, nowPlayingPollerOptions);
  app.addHook('onClose', async () => {
    await nowPlayingPoller.stop();
    await pollerBackground.close();
  });
  const usersService = new UsersService(prisma, notificationsService);
  const feedService = new FeedService(prisma, notificationsService);

  const sessionSockets = registerNowPlayingGateway(app, io, prisma, nowPlayingService, {
    sessionRecheckMs: options.sessionRecheckMs,
    throttle: nowPlayingThrottle,
    activity: listeningActivity,
  });

  // 4. Routes
  // Platform health checks hit this every few seconds: keep them out of the info-level logs.
  app.get('/health', { logLevel: 'warn' }, async () => ({
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
      publicApiUrl: env.PUBLIC_API_URL,
      activity: {
        seen: (userId) => listeningActivity.touch(userId),
        providerLinked: async (userId) => {
          if (pollerEnabled) await pollScheduler.wake(userId);
        },
      },
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
  await app.register(
    createNowPlayingRoutes(nowPlayingService, {
      syncStatus: async (userId) =>
        providerSyncStore.getStatus(userId, {
          autoSyncEnabled: pollerEnabled,
          nextDueAt: pollerEnabled ? await pollScheduler.nextDueAt(userId) : null,
        }),
    }),
    { prefix: '/api/now-playing' }
  );
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
    spotifyService,
    lastFmService,
    nowPlayingPoller,
    nowPlayingPollerDeps,
    nowPlayingPollerOptions,
    pollScheduler,
    listeningActivity,
    providerSyncStore,
    scrobbleRecorder,
    nowPlayingThrottle,
    pollerBackground,
  };
}
