import type { FastifyPluginAsync } from 'fastify';
import {
  AddTrackToPlaylistInputSchema,
  CreatePlaylistInputSchema,
  IdParamSchema,
  UserIdParamSchema,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { PlaylistsService } from './playlists.service';

export function createPlaylistsRoutes(playlistsService: PlaylistsService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
      const input = CreatePlaylistInputSchema.parse(request.body);
      const playlist = await playlistsService.createPlaylist(requireAuth(request).userId, input);
      return reply.status(201).send(playlist);
    });

    // Add a track to side A or B of one of the caller's playlists.
    fastify.post('/track', { preHandler: fastify.authenticate }, async (request) => {
      const input = AddTrackToPlaylistInputSchema.parse(request.body);
      return playlistsService.addTrackToPlaylist(requireAuth(request).userId, input);
    });

    fastify.get('/user/:userId', { preHandler: fastify.optionalAuth }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      return playlistsService.getUserPlaylists(userId, request.auth?.userId ?? null);
    });

    fastify.get('/:id', { preHandler: fastify.optionalAuth }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return playlistsService.getPlaylistDetails(id, request.auth?.userId ?? null);
    });
  };
}
