import type { FastifyPluginAsync } from 'fastify';
import { UserIdParamSchema, UsernameParamSchema } from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { ProfileService } from './profile.service';

export function createProfileRoutes(profileService: ProfileService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
      const { userId } = requireAuth(request);
      return profileService.getUserProfile({ id: userId }, userId);
    });

    fastify.get('/by-username/:username', { preHandler: fastify.optionalAuth }, async (request) => {
      const { username } = UsernameParamSchema.parse(request.params);
      return profileService.getUserProfile(
        { username: username.toLowerCase() },
        request.auth?.userId ?? null
      );
    });

    fastify.get('/:userId', { preHandler: fastify.optionalAuth }, async (request) => {
      const { userId } = UserIdParamSchema.parse(request.params);
      return profileService.getUserProfile({ id: userId }, request.auth?.userId ?? null);
    });
  };
}
