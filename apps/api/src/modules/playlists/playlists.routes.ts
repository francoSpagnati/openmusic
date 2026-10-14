import type { FastifyPluginAsync } from 'fastify';
import {
  CreatePlaylistInputSchema,
  AddTrackToPlaylistInputSchema,
} from '@openmusic/shared';
import type { PlaylistsService } from './playlists.service';

export function createPlaylistsRoutes(playlistsService: PlaylistsService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Crea una nuova playlist tematica (richiede auth)
    fastify.post('/', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = CreatePlaylistInputSchema.parse(request.body);
        const playlist = await playlistsService.createPlaylist(decoded.userId, input);
        return reply.status(201).send(playlist);
      } catch (err) {
        return reply.status(401).send({ error: 'Non autorizzato o input non valido', details: String(err) });
      }
    });

    // 2. Aggiunge una traccia a una playlist (Lato A o Lato B)
    fastify.post('/track', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = AddTrackToPlaylistInputSchema.parse(request.body);
        const updated = await playlistsService.addTrackToPlaylist(decoded.userId, input);
        return reply.send(updated);
      } catch (err) {
        return reply.status(400).send({ error: 'Operazione fallita', details: String(err) });
      }
    });

    // 3. Dettagli playlist con Lato A e Lato B
    fastify.get('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const playlist = await playlistsService.getPlaylistDetails(id);
        return reply.send(playlist);
      } catch {
        return reply.status(404).send({ error: 'Playlist non trovata' });
      }
    });

    // 4. Tutte le playlist create da un utente
    fastify.get('/user/:userId', async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const list = await playlistsService.getUserPlaylists(userId);
      return reply.send(list);
    });
  };
}
