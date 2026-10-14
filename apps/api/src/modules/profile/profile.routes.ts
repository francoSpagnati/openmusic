import type { FastifyPluginAsync } from 'fastify';
import type { ProfileService } from './profile.service';

export function createProfileRoutes(profileService: ProfileService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Profilo dell'utente corrente (richiede token JWT)
    fastify.get('/me', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const profile = await profileService.getUserProfile(decoded.userId);
        if (!profile) {
          return reply.status(404).send({ error: 'Profilo non trovato' });
        }
        return reply.send(profile);
      } catch {
        return reply.status(401).send({ error: 'Non autorizzato' });
      }
    });

    // 2. Profilo pubblico per ID utente
    fastify.get('/:userId', async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const profile = await profileService.getUserProfile(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Profilo utente non trovato' });
      }
      return reply.send(profile);
    });
  };
}
