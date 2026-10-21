import type { FastifyPluginAsync } from 'fastify';
import {
  CursorQuerySchema,
  UserIdParamSchema,
  UserSearchQuerySchema,
  UserSuggestionsQuerySchema,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { UsersService } from './users.service';

export function createUsersRoutes(users: UsersService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/search', { preHandler: fastify.optionalAuth }, async (request) => {
      const { q, ...page } = UserSearchQuerySchema.parse(request.query);
      return users.search(request.auth?.userId ?? null, q, page);
    });

    fastify.get('/suggestions', { preHandler: fastify.optionalAuth }, async (request) => {
      const { limit } = UserSuggestionsQuerySchema.parse(request.query);
      return users.suggestions(request.auth?.userId ?? null, limit);
    });

    fastify.get('/:userId/followers', { preHandler: fastify.optionalAuth }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      const page = CursorQuerySchema.parse(request.query);
      return users.followers(request.auth?.userId ?? null, userId, page);
    });

    fastify.get('/:userId/following', { preHandler: fastify.optionalAuth }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      const page = CursorQuerySchema.parse(request.query);
      return users.following(request.auth?.userId ?? null, userId, page);
    });

    fastify.put('/:userId/follow', { preHandler: fastify.authenticate }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      return users.follow(requireAuth(request).userId, userId);
    });

    fastify.delete('/:userId/follow', { preHandler: fastify.authenticate }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      return users.unfollow(requireAuth(request).userId, userId);
    });
  };
}
