import type { PrismaClient, ReactionType } from '@prisma/client';
import type {
  CreateReviewInput,
  ReviewItem,
  ToggleReactionInput,
} from '@openmusic/shared';

export class ReviewsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Crea o aggiorna una recensione (ADR-001 Rating Duale + ADR-004 Scrobble Verificato).
   * Ricalcola istantaneamente Audience Score (Media e % Fresh stile Rotten Tomatoes).
   */
  async createOrUpdateReview(
    userId: string,
    input: CreateReviewInput
  ): Promise<ReviewItem> {
    const { releaseId, trackId, rating, content, vibeTags } = input;

    if (!releaseId && !trackId) {
      throw new Error('Specificare releaseId o trackId per la recensione');
    }

    // 1. ADR-004: Verifica se l'utente ha davvero ascoltato il brano/album nei suoi scrobble
    const scrobble = await this.prisma.scrobbleLog.findFirst({
      where: {
        userId,
        OR: [
          releaseId ? { releaseId } : {},
          trackId ? { trackId } : {},
        ],
      },
    });

    const isVerifiedListen = Boolean(scrobble);

    // 2. Controllo se l'utente è un critico verificato
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isCritic = user?.role === 'CRITIC';

    // 3. Upsert della recensione
    let review;
    if (releaseId) {
      review = await this.prisma.review.upsert({
        where: {
          userId_releaseId: {
            userId,
            releaseId,
          },
        },
        update: {
          rating,
          content,
          vibeTags,
          isVerifiedListen,
          isCritic,
        },
        create: {
          userId,
          releaseId,
          rating,
          content,
          vibeTags,
          isVerifiedListen,
          isCritic,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          },
          reactions: true,
        },
      });

      // 4. ADR-001: Ricalcola l'Audience Score sull'album
      await this.recalculateAudienceScore(releaseId);
    } else {
      // Recensione di singola traccia
      review = await this.prisma.review.create({
        data: {
          userId,
          trackId,
          rating,
          content,
          vibeTags,
          isVerifiedListen,
          isCritic,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          },
          reactions: true,
        },
      });
    }

    return this.mapReviewItem(review, userId);
  }

  /**
   * Ricalcola la media (0.5 - 5.0) e la percentuale "Fresh" (% voti >= 70 / 3.5 stelle)
   */
  private async recalculateAudienceScore(releaseId: string): Promise<void> {
    const allReviews = await this.prisma.review.findMany({
      where: { releaseId, isCritic: false },
      select: { rating: true },
    });

    if (allReviews.length === 0) {
      await this.prisma.release.update({
        where: { id: releaseId },
        data: {
          audienceAvg: null,
          audienceFreshPct: null,
          audienceCount: 0,
        },
      });
      return;
    }

    const count = allReviews.length;
    const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
    // Converti da 10..100 a scala 0.5..5.0 con 1 cifra decimale
    const audienceAvg = Math.round((sum / count / 20) * 10) / 10;

    // Voti >= 70 corrispondono a >= 3.5 stelle su 5.0
    const freshCount = allReviews.filter((r) => r.rating >= 70).length;
    const audienceFreshPct = Math.round((freshCount / count) * 100);

    await this.prisma.release.update({
      where: { id: releaseId },
      data: {
        audienceAvg,
        audienceFreshPct,
        audienceCount: count,
      },
    });
  }

  /**
   * Aggiunge o rimuove una reazione costruttiva (Euristica #3: Libertà/Undo)
   */
  async toggleReaction(
    userId: string,
    input: ToggleReactionInput
  ): Promise<{ added: boolean; type: ReactionType }> {
    const { reviewId, type } = input;

    const existing = await this.prisma.reviewReaction.findUnique({
      where: {
        reviewId_userId_type: {
          reviewId,
          userId,
          type: type as ReactionType,
        },
      },
    });

    if (existing) {
      await this.prisma.reviewReaction.delete({
        where: { id: existing.id },
      });
      return { added: false, type: type as ReactionType };
    }

    await this.prisma.reviewReaction.create({
      data: {
        reviewId,
        userId,
        type: type as ReactionType,
      },
    });

    return { added: true, type: type as ReactionType };
  }

  /**
   * Recupera le recensioni di una Release con aggregazione reazioni
   */
  async getReleaseReviews(
    releaseId: string,
    currentUserId?: string
  ): Promise<ReviewItem[]> {
    const reviews = await this.prisma.review.findMany({
      where: { releaseId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true,
          },
        },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapReviewItem(r, currentUserId));
  }

  private mapReviewItem(
    r: {
      id: string;
      userId: string;
      user: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        role: string;
      };
      releaseId: string | null;
      trackId: string | null;
      rating: number;
      content: string | null;
      vibeTags: string[];
      isCritic: boolean;
      isVerifiedListen: boolean;
      createdAt: Date;
      updatedAt: Date;
      reactions: Array<{ type: ReactionType; userId: string }>;
    },
    currentUserId?: string
  ): ReviewItem {
    const reactionCounts: Record<ReactionType, number> = {
      AGREE: 0,
      WELL_WRITTEN: 0,
      DISCOVERED: 0,
      HEART: 0,
    };

    let userReaction: ReactionType | null = null;

    for (const rx of r.reactions) {
      reactionCounts[rx.type] = (reactionCounts[rx.type] || 0) + 1;
      if (currentUserId && rx.userId === currentUserId) {
        userReaction = rx.type;
      }
    }

    return {
      id: r.id,
      userId: r.userId,
      user: {
        id: r.user.id,
        username: r.user.username,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        role: r.user.role as 'USER' | 'CRITIC' | 'MODERATOR',
      },
      releaseId: r.releaseId,
      trackId: r.trackId,
      rating: r.rating,
      content: r.content,
      vibeTags: r.vibeTags,
      isCritic: r.isCritic,
      isVerifiedListen: r.isVerifiedListen,
      reactions: reactionCounts,
      userReaction,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
