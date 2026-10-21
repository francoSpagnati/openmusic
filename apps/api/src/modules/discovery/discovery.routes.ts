import type { FastifyPluginAsync } from 'fastify';
import type { DiscoveryService } from './discovery.service';

export function createDiscoveryRoutes(discoveryService: DiscoveryService): FastifyPluginAsync {
  return async (fastify) => {
    // Vertical reels feed (Doherty threshold < 400ms). Personalised when signed in.
    fastify.get('/reels', { preHandler: fastify.optionalAuth }, async (request) => {
      return discoveryService.getReelsFeed(request.auth?.userId);
    });

    // Genre roulette ("out of the bubble").
    fastify.get('/roulette', { preHandler: fastify.optionalAuth }, async (request) => {
      return discoveryService.spinGenreRoulette(request.auth?.userId);
    });
  };
}
