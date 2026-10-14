import type { FastifyPluginAsync } from 'fastify';
import {
  CreateReviewInputSchema,
  ToggleReactionInputSchema,
} from '@openmusic/shared';
import type { ReviewsService } from './reviews.service';

export function createReviewsRoutes(reviewsService: ReviewsService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Pubblica o modifica una recensione (richiede autenticazione)
    fastify.post('/', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = CreateReviewInputSchema.parse(request.body);
        const review = await reviewsService.createOrUpdateReview(decoded.userId, input);
        return reply.status(201).send(review);
      } catch (err) {
        return reply.status(401).send({ error: 'Richiesta non autorizzata o input non valido', details: String(err) });
      }
    });

    // 2. Ottieni tutte le recensioni di una release
    fastify.get('/release/:releaseId', async (request, reply) => {
      const { releaseId } = request.params as { releaseId: string };
      let currentUserId: string | undefined;

      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        currentUserId = decoded.userId;
      } catch {
        // Utente non autenticato: visualizzazione pubblica
      }

      const reviews = await reviewsService.getReleaseReviews(releaseId, currentUserId);
      return reply.send(reviews);
    });

    // 3. Aggiungi / Rimuovi una reazione costruttiva (richiede autenticazione)
    fastify.post('/reaction', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = ToggleReactionInputSchema.parse(request.body);
        const result = await reviewsService.toggleReaction(decoded.userId, input);
        return reply.send(result);
      } catch {
        return reply.status(401).send({ error: 'Richiesta non autorizzata' });
      }
    });
  };
}
