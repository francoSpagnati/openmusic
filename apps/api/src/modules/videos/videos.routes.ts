import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CreateVideoContentInputSchema, VideoFeedQuerySchema } from '@openmusic/shared';
import type { VideosService } from './videos.service';

const ReleaseParamSchema = z.object({ releaseId: z.string().uuid() });

export function createVideosRoutes(videosService: VideosService): FastifyPluginAsync {
  return async (fastify) => {
    // Editorial content: accredited critics and staff only.
    fastify.post(
      '/',
      { preHandler: [fastify.authenticate, fastify.requireRole('CRITIC', 'MODERATOR', 'ADMIN')] },
      async (request, reply) => {
        const input = CreateVideoContentInputSchema.parse(request.body);
        const video = await videosService.publishVideo(input);
        return reply.status(201).send(video);
      }
    );

    fastify.get('/release/:releaseId', async (request) => {
      const { releaseId } = ReleaseParamSchema.parse(request.params);
      return videosService.getVideosByRelease(releaseId);
    });

    fastify.get('/feed', async (request) => {
      const { category } = VideoFeedQuerySchema.parse(request.query);
      return videosService.getFeedVideos(category);
    });
  };
}
