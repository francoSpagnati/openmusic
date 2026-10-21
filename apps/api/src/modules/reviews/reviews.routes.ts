import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CreateReviewInputSchema, ToggleReactionInputSchema } from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { ReviewsService } from './reviews.service';

const ReleaseParamSchema = z.object({ releaseId: z.string().uuid() });

export function createReviewsRoutes(reviewsService: ReviewsService): FastifyPluginAsync {
  return async (fastify) => {
    // Create or update the caller's review (one per release).
    fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
      const input = CreateReviewInputSchema.parse(request.body);
      const review = await reviewsService.createOrUpdateReview(requireAuth(request).userId, input);
      return reply.status(201).send(review);
    });

    fastify.get('/release/:releaseId', { preHandler: fastify.optionalAuth }, async (request) => {
      const { releaseId } = ReleaseParamSchema.parse(request.params);
      return reviewsService.getReleaseReviews(releaseId, request.auth?.userId);
    });

    // Toggle a constructive reaction (AGREE / WELL_WRITTEN / DISCOVERED / HEART).
    fastify.post('/reaction', { preHandler: fastify.authenticate }, async (request) => {
      const input = ToggleReactionInputSchema.parse(request.body);
      return reviewsService.toggleReaction(requireAuth(request).userId, input);
    });
  };
}
