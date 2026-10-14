import type { FastifyPluginAsync } from 'fastify';
import type { DiscoveryService } from './discovery.service';

export function createDiscoveryRoutes(discoveryService: DiscoveryService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Feed verticale Reels (Soglia di Doherty < 400ms)
    fastify.get('/reels', async (request, reply) => {
      let currentUserId: string | undefined;
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        currentUserId = decoded.userId;
      } catch {
        // Nessun utente loggato
      }

      const feed = await discoveryService.getReelsFeed(currentUserId);
      return reply.send(feed);
    });

    // 2. Roulette Russa dei Generi (Algoritmo "Out-of-the-bubble")
    fastify.get('/roulette', async (request, reply) => {
      let currentUserId: string | undefined;
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        currentUserId = decoded.userId;
      } catch {
        // Nessun utente loggato
      }

      const result = await discoveryService.spinGenreRoulette(currentUserId);
      return reply.send(result);
    });
  };
}
