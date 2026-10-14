import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CriticAccreditationRequestSchema } from '@openmusic/shared';
import type { CriticService } from './critic.service';

const PublishCriticReviewSchema = z.object({
  releaseId: z.string().uuid(),
  rating: z.number().int().min(10).max(100),
  content: z.string().min(10).max(5000),
  originalReviewUrl: z.string().url().optional(),
});

export function createCriticRoutes(criticService: CriticService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Richiesta di accreditamento Critico / Webzine
    fastify.post('/accredit', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = CriticAccreditationRequestSchema.parse(request.body);
        const result = await criticService.applyForAccreditation(decoded.userId, input);
        return reply.send(result);
      } catch (err) {
        return reply.status(401).send({ error: 'Operazione non autorizzata', details: String(err) });
      }
    });

    // 2. Pubblica una recensione della Critica Accreditata
    fastify.post('/reviews', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const input = PublishCriticReviewSchema.parse(request.body);
        const review = await criticService.publishCriticReview(decoded.userId, input);
        return reply.status(201).send(review);
      } catch (err) {
        return reply.status(403).send({ error: 'Impossibile pubblicare recensione della critica', details: String(err) });
      }
    });

    // 3. Punteggio Duale dell'album (Audience + Critic Score)
    fastify.get('/dual-score/:releaseId', async (request, reply) => {
      const { releaseId } = request.params as { releaseId: string };
      const scores = await criticService.getDualScores(releaseId);
      if (!scores) {
        return reply.status(404).send({ error: 'Album non trovato' });
      }
      return reply.send(scores);
    });

    // 4. Recensioni dei critici per un'opera
    fastify.get('/release/:releaseId', async (request, reply) => {
      const { releaseId } = request.params as { releaseId: string };
      const reviews = await criticService.getReleaseCriticReviews(releaseId);
      return reply.send(reviews);
    });
  };
}
