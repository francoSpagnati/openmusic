import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ExportPlaylistInputSchema } from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { SpotifySyncService } from './spotify-sync.service';

const HeavyRotationQuerySchema = z.object({
  timeRange: z.enum(['short_term', 'medium_term', 'long_term']).default('short_term'),
});

/**
 * All routes need a session and a linked Spotify account (409 CONFLICT otherwise). Spotify API
 * failures surface as 502 UPSTREAM_ERROR without provider details.
 */
export function createSpotifyRoutes(spotifySyncService: SpotifySyncService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/currently-playing', async (request) => {
      return spotifySyncService.syncUserPlayback(requireAuth(request).userId);
    });

    // Sync playback into Redis presence and log a scrobble (verified listen).
    fastify.post('/sync-playback', async (request) => {
      return spotifySyncService.syncUserPlayback(requireAuth(request).userId);
    });

    fastify.get('/heavy-rotation', async (request) => {
      const { timeRange } = HeavyRotationQuerySchema.parse(request.query);
      const tracks = await spotifySyncService.getHeavyRotation(
        requireAuth(request).userId,
        timeRange
      );
      return { tracks };
    });

    fastify.get('/recently-played', async (request) => {
      const items = await spotifySyncService.getRecentlyPlayed(requireAuth(request).userId);
      return { items };
    });

    fastify.get('/top-artists', async (request) => {
      const artists = await spotifySyncService.getTopArtists(requireAuth(request).userId);
      return { artists };
    });

    fastify.post('/export-playlist', async (request) => {
      const input = ExportPlaylistInputSchema.parse(request.body);
      return spotifySyncService.exportPlaylistToSpotify(requireAuth(request).userId, input);
    });
  };
}
