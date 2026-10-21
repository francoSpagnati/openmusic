import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CriticAccreditationRequestSchema,
  CriticVerifyInputSchema,
  PublishCriticReviewInputSchema,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import { NotFoundError } from '../../lib/errors';
import type { CriticService } from './critic.service';

const ReleaseParamSchema = z.object({ releaseId: z.string().uuid() });

export function createCriticRoutes(criticService: CriticService): FastifyPluginAsync {
  return async (fastify) => {
    // Accreditation request (pending until an ADMIN verifies it).
    fastify.post('/accredit', { preHandler: fastify.authenticate }, async (request) => {
      const input = CriticAccreditationRequestSchema.parse(request.body);
      return criticService.applyForAccreditation(requireAuth(request).userId, input);
    });

    fastify.get('/accreditation', { preHandler: fastify.authenticate }, async (request) => {
      return criticService.getAccreditationStatus(requireAuth(request).userId);
    });

    fastify.get(
      '/requests',
      { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] },
      async () => criticService.listPendingRequests()
    );

    fastify.post(
      '/verify',
      { preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')] },
      async (request) => {
        const { userId, approve } = CriticVerifyInputSchema.parse(request.body);
        return criticService.verify(requireAuth(request).userId, userId, approve);
      }
    );

    // Accredited critics only (role checked in the service against the current DB role).
    fastify.post('/reviews', { preHandler: fastify.authenticate }, async (request, reply) => {
      const input = PublishCriticReviewInputSchema.parse(request.body);
      const review = await criticService.publishCriticReview(requireAuth(request).userId, input);
      return reply.status(201).send(review);
    });

    fastify.get('/dual-score/:releaseId', async (request) => {
      const { releaseId } = ReleaseParamSchema.parse(request.params);
      const scores = await criticService.getDualScores(releaseId);
      if (!scores) throw new NotFoundError('Album non trovato');
      return scores;
    });

    fastify.get('/release/:releaseId', async (request) => {
      const { releaseId } = ReleaseParamSchema.parse(request.params);
      return criticService.getReleaseCriticReviews(releaseId);
    });
  };
}
