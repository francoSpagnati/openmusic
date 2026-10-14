import type { PrismaClient } from '@prisma/client';
import type {
  CriticAccreditationRequest,
  CriticReviewItem,
  DualScoreDetails,
} from '@openmusic/shared';

export class CriticService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Richiesta e approvazione accreditamento critico / webzine
   */
  async applyForAccreditation(
    userId: string,
    input: CriticAccreditationRequest
  ): Promise<{ success: boolean; outletName: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'CRITIC',
        criticOutlet: input.outletName.trim(),
        criticVerifiedAt: new Date(),
        bio: input.bio?.trim() || undefined,
      },
    });

    return { success: true, outletName: input.outletName };
  }

  /**
   * Pubblica una recensione ufficiale della critica e ricalcola il Critic Score
   */
  async publishCriticReview(
    userId: string,
    input: {
      releaseId: string;
      rating: number; // 10..100
      content: string;
      originalReviewUrl?: string;
    }
  ): Promise<CriticReviewItem> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'CRITIC') {
      throw new Error('Solo i critici musicali accreditati possono pubblicare un Critic Score');
    }

    const outletName = user.criticOutlet ?? 'Webzine Indipendente';

    const review = await this.prisma.review.upsert({
      where: {
        userId_releaseId: {
          userId,
          releaseId: input.releaseId,
        },
      },
      update: {
        rating: input.rating,
        content: input.content,
        isCritic: true,
        outletName,
        originalReviewUrl: input.originalReviewUrl,
      },
      create: {
        userId,
        releaseId: input.releaseId,
        rating: input.rating,
        content: input.content,
        isCritic: true,
        outletName,
        originalReviewUrl: input.originalReviewUrl,
      },
    });

    // Ricalcola Critic Score dell'album
    await this.recalculateCriticScore(input.releaseId);

    return {
      id: review.id,
      criticId: user.id,
      criticName: user.displayName ?? user.username,
      criticAvatarUrl: user.avatarUrl,
      outletName,
      originalReviewUrl: review.originalReviewUrl,
      rating: review.rating,
      quoteSnippet: input.content.slice(0, 200),
      releaseId: input.releaseId,
      createdAt: review.createdAt.toISOString(),
    };
  }

  /**
   * Ricalcola il Critic Score (Media e % Fresh dei critici accreditati)
   */
  private async recalculateCriticScore(releaseId: string): Promise<void> {
    const criticReviews = await this.prisma.review.findMany({
      where: { releaseId, isCritic: true },
      select: { rating: true },
    });

    if (criticReviews.length === 0) {
      await this.prisma.release.update({
        where: { id: releaseId },
        data: {
          criticAvg: null,
          criticFreshPct: null,
          criticCount: 0,
        },
      });
      return;
    }

    const count = criticReviews.length;
    const sum = criticReviews.reduce((acc, r) => acc + r.rating, 0);
    const criticAvg = Math.round((sum / count / 20) * 10) / 10;
    const freshCount = criticReviews.filter((r) => r.rating >= 70).length;
    const criticFreshPct = Math.round((freshCount / count) * 100);

    await this.prisma.release.update({
      where: { id: releaseId },
      data: {
        criticAvg,
        criticFreshPct,
        criticCount: count,
      },
    });
  }

  /**
   * Recupera il punteggio duale (Audience Score + Critic Score)
   */
  async getDualScores(releaseId: string): Promise<DualScoreDetails | null> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        audienceAvg: true,
        audienceFreshPct: true,
        audienceCount: true,
        criticAvg: true,
        criticFreshPct: true,
        criticCount: true,
      },
    });

    if (!release) return null;

    return {
      releaseId: release.id,
      audienceAvg: release.audienceAvg,
      audienceFreshPct: release.audienceFreshPct,
      audienceCount: release.audienceCount,
      criticAvg: release.criticAvg,
      criticFreshPct: release.criticFreshPct,
      criticCount: release.criticCount,
    };
  }

  /**
   * Elenco recensioni della critica per un album
   */
  async getReleaseCriticReviews(releaseId: string): Promise<CriticReviewItem[]> {
    const reviews = await this.prisma.review.findMany({
      where: { releaseId, isCritic: true },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      id: r.id,
      criticId: r.user.id,
      criticName: r.user.displayName ?? r.user.username,
      criticAvatarUrl: r.user.avatarUrl,
      outletName: r.outletName ?? 'Critica Indipendente',
      originalReviewUrl: r.originalReviewUrl,
      rating: r.rating,
      quoteSnippet: r.content ?? '',
      releaseId,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
