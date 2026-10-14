import type { PrismaClient } from '@prisma/client';
import type {
  CreateVideoContentInput,
  MusicVideoItem,
  VideoCategory,
} from '@openmusic/shared';

export class VideosService {
  constructor(private readonly prisma: PrismaClient) {}

  async publishVideo(input: CreateVideoContentInput): Promise<MusicVideoItem> {
    const video = await this.prisma.musicVideoContent.create({
      data: {
        title: input.title.trim(),
        creatorName: input.creatorName.trim(),
        videoUrl: input.videoUrl,
        thumbnailUrl: input.thumbnailUrl || null,
        durationSeconds: input.durationSeconds,
        releaseId: input.releaseId || null,
        category: input.category,
      },
    });

    return {
      id: video.id,
      title: video.title,
      creatorName: video.creatorName,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
      releaseId: video.releaseId,
      category: video.category as VideoCategory,
      createdAt: video.createdAt.toISOString(),
    };
  }

  async getVideosByRelease(releaseId: string): Promise<MusicVideoItem[]> {
    const videos = await this.prisma.musicVideoContent.findMany({
      where: { releaseId },
      orderBy: { createdAt: 'desc' },
    });

    return videos.map((v) => ({
      id: v.id,
      title: v.title,
      creatorName: v.creatorName,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
      releaseId: v.releaseId,
      category: v.category as VideoCategory,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getFeedVideos(category?: VideoCategory): Promise<MusicVideoItem[]> {
    const videos = await this.prisma.musicVideoContent.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return videos.map((v) => ({
      id: v.id,
      title: v.title,
      creatorName: v.creatorName,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
      releaseId: v.releaseId,
      category: v.category as VideoCategory,
      createdAt: v.createdAt.toISOString(),
    }));
  }
}
