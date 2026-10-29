import type { FastifyPluginAsync } from 'fastify';
import { UserIdParamSchema, type NowPlayingSyncStatus } from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { NowPlayingService } from './now-playing.service';

export interface NowPlayingRoutesOptions {
  /** ADR-013: per-provider state of the automatic sync for the signed-in user. */
  syncStatus: (userId: string) => Promise<NowPlayingSyncStatus>;
}

export function createNowPlayingRoutes(
  nowPlaying: NowPlayingService,
  options: NowPlayingRoutesOptions
): FastifyPluginAsync {
  return async (fastify) => {
    // Same data as the socket's initial state, for SSR / first paint of the stories bar.
    fastify.get('/friends', { preHandler: fastify.authenticate }, async (request) => {
      return nowPlaying.getFriendsLivePresence(requireAuth(request).userId);
    });

    // Profile "In ascolto ora" card: first paint, then the socket keeps it live. Own profile or a
    // followed user only (404 otherwise); Ghost Mode hides the track from everyone else.
    fastify.get('/users/:userId', { preHandler: fastify.authenticate }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      return nowPlaying.getUserPresence(requireAuth(request).userId, userId);
    });

    // Settings page: is the background Spotify/Last.fm reading working, and when did it last run.
    fastify.get('/sync-status', { preHandler: fastify.authenticate }, async (request) => {
      return options.syncStatus(requireAuth(request).userId);
    });
  };
}
