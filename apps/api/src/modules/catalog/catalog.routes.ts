import type { FastifyPluginAsync } from 'fastify';
import { AudioPreviewResolveQuerySchema } from '@openmusic/shared';
import type { CatalogService } from './catalog.service';

export function createCatalogRoutes(catalogService: CatalogService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Ricerca globale per album e brani
    fastify.get('/search', async (request, reply) => {
      const { q } = request.query as { q?: string };
      if (!q) {
        return reply.send({ releases: [], tracks: [] });
      }
      const results = await catalogService.search(q);
      return reply.send(results);
    });

    // 2. Dettaglio singola Release con tracce e punteggi
    fastify.get('/releases/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const release = await catalogService.getReleaseById(id);
      if (!release) {
        return reply.status(404).send({ error: 'Release non trovata' });
      }
      return reply.send(release);
    });

    // 3. ADR-003: Risolutore di anteprima audio 30s
    fastify.get('/preview', async (request, reply) => {
      const query = AudioPreviewResolveQuerySchema.parse(request.query);
      const result = await catalogService.resolveTrackPreview(
        query.title,
        query.artist,
        query.isrc
      );
      return reply.send(result);
    });
  };
}
