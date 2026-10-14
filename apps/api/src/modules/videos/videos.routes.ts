import type { FastifyPluginAsync } from 'fastify';
import {
  CreateVideoContentInputSchema,
  VideoCategorySchema,
} from '@openmusic/shared';
import type { VideosService } from './videos.service';

export function createVideosRoutes(videosService: VideosService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Pubblica un nuovo video-contenuto a tema musicale
    fastify.post('/', async (request, reply) => {
      try {
        const input = CreateVideoContentInputSchema.parse(request.body);
        const video = await videosService.publishVideo(input);
        return reply.status(201).send(video);
      } catch (err) {
        return reply.status(400).send({ error: 'Dati video non validi', details: String(err) });
      }
    });

    // 2. Video collegati a un album/release
    fastify.get('/release/:releaseId', async (request, reply) => {
      const { releaseId } = request.params as { releaseId: string };
      const list = await videosService.getVideosByRelease(releaseId);
      return reply.send(list);
    });

    // 3. Feed video generale (opzionalmente filtrato per categoria)
    fastify.get('/feed', async (request, reply) => {
      const { category } = request.query as { category?: string };
      const parsedCat = category ? VideoCategorySchema.parse(category) : undefined;
      const feed = await videosService.getFeedVideos(parsedCat);
      return reply.send(feed);
    });
  };
}
