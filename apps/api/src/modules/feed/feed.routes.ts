import type { FastifyPluginAsync } from 'fastify';
import {
  CreatePostInputSchema,
  CursorQuerySchema,
  FeedQuerySchema,
  IdParamSchema,
  UserIdParamSchema,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { FeedService } from './feed.service';

/** Mounted at `/api`: `/api/feed`, `/api/posts/...`, `/api/users/:userId/posts`. */
export function createFeedRoutes(feed: FeedService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/feed', { preHandler: fastify.optionalAuth }, async (request) => {
      const { scope, ...page } = FeedQuerySchema.parse(request.query);
      const viewerId = request.auth?.userId ?? null;
      // Anonymous visitors have no follow graph: they always get the global feed.
      return feed.feed(viewerId, viewerId ? scope : 'global', page);
    });

    fastify.get('/posts/saved', { preHandler: fastify.authenticate }, async (request) => {
      const page = CursorQuerySchema.parse(request.query);
      return feed.saved(requireAuth(request).userId, page);
    });

    fastify.post('/posts', { preHandler: fastify.authenticate }, async (request, reply) => {
      const input = CreatePostInputSchema.parse(request.body);
      const post = await feed.create(requireAuth(request).userId, input);
      return reply.status(201).send(post);
    });

    fastify.get('/posts/:id', { preHandler: fastify.optionalAuth }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return feed.get(request.auth?.userId ?? null, id);
    });

    fastify.delete('/posts/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
      const { id } = IdParamSchema.parse(request.params);
      await feed.remove(requireAuth(request), id);
      return reply.status(204).send();
    });

    fastify.put('/posts/:id/like', { preHandler: fastify.authenticate }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return feed.like(requireAuth(request).userId, id);
    });

    fastify.delete('/posts/:id/like', { preHandler: fastify.authenticate }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return feed.unlike(requireAuth(request).userId, id);
    });

    fastify.put('/posts/:id/save', { preHandler: fastify.authenticate }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return feed.setSaved(requireAuth(request).userId, id, true);
    });

    fastify.delete('/posts/:id/save', { preHandler: fastify.authenticate }, async (request) => {
      const { id } = IdParamSchema.parse(request.params);
      return feed.setSaved(requireAuth(request).userId, id, false);
    });

    fastify.get('/users/:userId/posts', { preHandler: fastify.optionalAuth }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      const page = CursorQuerySchema.parse(request.query);
      return feed.byUser(request.auth?.userId ?? null, userId, page);
    });
  };
}
