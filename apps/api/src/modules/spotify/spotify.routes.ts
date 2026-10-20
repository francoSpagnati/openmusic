import type { FastifyPluginAsync } from 'fastify';
import { ExportPlaylistInputSchema } from '@openmusic/shared';
import type { SpotifySyncService } from './spotify-sync.service';

export function createSpotifyRoutes(spotifySyncService: SpotifySyncService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Recupera la traccia attualmente in riproduzione su Spotify per l'utente loggato
    fastify.get('/currently-playing', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const result = await spotifySyncService.syncUserPlayback(decoded.userId);
        return reply.send(result);
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Impossibile recuperare la riproduzione Spotify corrente',
        });
      }
    });

    // 2. Forza la sincronizzazione della riproduzione con Redis e il conteggio scrobble
    fastify.post('/sync-playback', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const result = await spotifySyncService.syncUserPlayback(decoded.userId);
        return reply.send(result);
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Errore durante la sincronizzazione con Spotify',
        });
      }
    });

    // 3. Recupera i brani in rotazione pesante (Top 5 brani dell'ultimo mese)
    fastify.get('/heavy-rotation', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const query = request.query as { timeRange?: 'short_term' | 'medium_term' | 'long_term' };
        const tracks = await spotifySyncService.getHeavyRotation(
          decoded.userId,
          query.timeRange ?? 'short_term'
        );
        return reply.send({ tracks });
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Impossibile recuperare la rotazione pesante da Spotify',
        });
      }
    });

    // 4. Cronologia recente (Recently Played)
    fastify.get('/recently-played', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const items = await spotifySyncService.getRecentlyPlayed(decoded.userId);
        return reply.send({ items });
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Impossibile recuperare gli ascolti recenti',
        });
      }
    });

    // 5. Artisti preferiti (Top Artists)
    fastify.get('/top-artists', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const artists = await spotifySyncService.getTopArtists(decoded.userId);
        return reply.send({ artists });
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Impossibile recuperare i top artists',
        });
      }
    });

    // 6. Esporta una playlist analogica creata su OpenMusic direttamente sull'account Spotify
    fastify.post('/export-playlist', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = ExportPlaylistInputSchema.parse(request.body);
        const result = await spotifySyncService.exportPlaylistToSpotify(decoded.userId, input);
        return reply.send(result);
      } catch (err: unknown) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Errore durante l\'esportazione della playlist su Spotify',
        });
      }
    });
  };
}
