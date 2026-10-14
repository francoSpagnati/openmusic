import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { prisma } from '@openmusic/db';
import { env } from './config/env';
import { NowPlayingService } from './modules/now-playing/now-playing.service';
import { registerNowPlayingGateway } from './modules/now-playing/now-playing.gateway';
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
import { createNotificationPresenceRoutes } from './modules/notifications/notification-presence.routes';
import { CriticService } from './modules/critic/critic.service';
import { createCriticRoutes } from './modules/critic/critic.routes';
import { VideosService } from './modules/videos/videos.service';
import { createVideosRoutes } from './modules/videos/videos.routes';
import { SpotifySyncService } from './modules/spotify/spotify-sync.service';
import { createSpotifyRoutes } from './modules/spotify/spotify.routes';

export interface AppContext {
  app: FastifyInstance;
  io: SocketIOServer;
  redis: Redis;
  authService: AuthService;
  nowPlayingService: NowPlayingService;
  catalogService: CatalogService;
  reviewsService: ReviewsService;
  profileService: ProfileService;
  discoveryService: DiscoveryService;
  chatService: ChatService;
  playlistsService: PlaylistsService;
  notificationPresenceService: NotificationPresenceService;
  criticService: CriticService;
  videosService: VideosService;
  spotifySyncService: SpotifySyncService;
}

export async function buildApp(): Promise<AppContext> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  // 1. Plugins Fastify
  await app.register(cors, {
    origin: env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // 2. Infrastruttura Redis & Database
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  // 3. Servizi Core (Milestones 1..5 + Spotify Sync Engine)
  const nowPlayingService = new NowPlayingService(redis, prisma);
  const spotifyService = new SpotifyService();
  const lastFmService = new LastFmService();
  const authService = new AuthService(prisma, spotifyService, lastFmService);

  const previewResolver = new AudioPreviewResolverService();
  const catalogService = new CatalogService(prisma, previewResolver);
  const reviewsService = new ReviewsService(prisma);
  const profileService = new ProfileService(prisma);
  const discoveryService = new DiscoveryService(prisma, previewResolver);

  const chatService = new ChatService(prisma);
  const playlistsService = new PlaylistsService(prisma);
  const notificationPresenceService = new NotificationPresenceService(nowPlayingService);

  const criticService = new CriticService(prisma);
  const videosService = new VideosService(prisma);
  const spotifySyncService = new SpotifySyncService(prisma, redis, spotifyService, nowPlayingService);

  // 4. Socket.io Server collegato all'istanza HTTP di Fastify
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  registerNowPlayingGateway(io, nowPlayingService);

  // 5. Rotte API
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await app.register(createAuthRoutes(authService), { prefix: '/api/auth' });
  await app.register(createCatalogRoutes(catalogService), { prefix: '/api/catalog' });
  await app.register(createReviewsRoutes(reviewsService), { prefix: '/api/reviews' });
  await app.register(createProfileRoutes(profileService), { prefix: '/api/profile' });
  await app.register(createDiscoveryRoutes(discoveryService), { prefix: '/api/discovery' });
  await app.register(createChatRoutes(chatService), { prefix: '/api/chat' });
  await app.register(createPlaylistsRoutes(playlistsService), { prefix: '/api/playlists' });
  await app.register(createNotificationPresenceRoutes(notificationPresenceService), {
    prefix: '/api/notifications',
  });
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
    reviewsService,
    profileService,
    discoveryService,
    chatService,
    playlistsService,
    notificationPresenceService,
    criticService,
    videosService,
    spotifySyncService,
  };
}
