import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../lib/auth';
import type { NowPlayingService } from './now-playing.service';

export function createNowPlayingRoutes(nowPlaying: NowPlayingService): FastifyPluginAsync {
  return async (fastify) => {
    // Same data as the socket's initial state, for SSR / first paint of the stories bar.
    fastify.get('/friends', { preHandler: fastify.authenticate }, async (request) => {
      return nowPlaying.getFriendsLivePresence(requireAuth(request).userId);
    });
  };
}
