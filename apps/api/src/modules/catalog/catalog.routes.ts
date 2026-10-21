import type { FastifyPluginAsync } from 'fastify';
import {
  AudioPreviewResolveQuerySchema,
  BrowseReleasesQuerySchema,
  CatalogSearchQuerySchema,
  IdParamSchema,
} from '@openmusic/shared';
import { NotFoundError } from '../../lib/errors';
import type { CatalogService } from './catalog.service';

/**
 * Search and preview call third-party APIs (and search may write imported releases), so they are
 * rate limited per IP even though they are public.
 */
const upstreamRateLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

export function createCatalogRoutes(catalogService: CatalogService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/search', upstreamRateLimit, async (request) => {
      const { q } = CatalogSearchQuerySchema.parse(request.query);
      if (!q) return { releases: [], tracks: [] };
      return catalogService.search(q);
    });

    // Explore: browse releases by genre, most reviewed or most recent first.
    fastify.get('/releases', async (request) => {
      const query = BrowseReleasesQuerySchema.parse(request.query);
      return catalogService.browseReleases(query);
    });

    fastify.get('/genres', async () => catalogService.listGenres());

    fastify.get('/releases/:id', async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      const release = await catalogService.getReleaseById(id);
      if (!release) throw new NotFoundError('Release non trovata');
      return release;
    });

    // ADR-003: 30s audio preview resolver.
    fastify.get('/preview', upstreamRateLimit, async (request) => {
      const query = AudioPreviewResolveQuerySchema.parse(request.query);
      return catalogService.resolveTrackPreview(query.title, query.artist, query.isrc);
    });
  };
}
