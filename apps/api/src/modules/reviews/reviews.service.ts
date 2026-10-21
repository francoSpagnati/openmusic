import type { PrismaClient, ReactionType } from '@openmusic/db';
import type { ReviewItem, ToggleReactionInput, UserRole } from '@openmusic/shared';
import type { CreateReviewInputSchema } from '@openmusic/shared';
import type { z } from 'zod';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import type { NotificationsService } from '../notifications/notifications.service';
import { aggregateScore } from './score';

type CreateReviewInput = z.output<typeof CreateReviewInputSchema>;

/** ADR-002: an album review is "verified" after this many distinct tracks were scrobbled. */
export const VERIFIED_MIN_DISTINCT_TRACKS = 3;

export class ReviewsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * ADR-002 "Ascolto Verificato": a track review needs one scrobble of that track; a release
   * review needs scrobbles of at least 3 distinct tracks (or all of them for shorter releases).
   */
  private async isVerifiedListen(
    userId: string,
    target: { releaseId?: string; trackId?: string }
  ): Promise<boolean> {
    if (target.trackId) {
      const plays = await this.prisma.scrobbleLog.count({
        where: { userId, trackId: target.trackId },
      });
      return plays > 0;
    }
    if (!target.releaseId) return false;
    const [distinct, trackCount] = await Promise.all([
      this.prisma.scrobbleLog.findMany({
        where: {
          userId,
          OR: [{ releaseId: target.releaseId }, { track: { releaseId: target.releaseId } }],
        },
        distinct: ['trackId'],
        select: { trackId: true },
      }),
      this.prisma.track.count({ where: { releaseId: target.releaseId } }),
    ]);
    const required = Math.max(1, Math.min(VERIFIED_MIN_DISTINCT_TRACKS, trackCount));
    return distinct.length >= required;
  }

  /**
   * Crea o aggiorna una recensione (ADR-001 Rating Duale + ADR-004 Scrobble Verificato).
   * Ricalcola istantaneamente Audience Score (Media e % Fresh stile Rotten Tomatoes).
   */
  async createOrUpdateReview(userId: string, input: CreateReviewInput): Promise<ReviewItem> {
    const { releaseId, trackId, rating, content, vibeTags } = input;

    if (!releaseId && !trackId) {
      throw new BadRequestError('Specificare releaseId o trackId per la recensione');
    }

    // 1. ADR-002: verified listen from the user's scrobble history
    const isVerifiedListen = await this.isVerifiedListen(userId, { releaseId, trackId });

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
  /**
   * ADR-001/ADR-002: weighted mean (0.5..5.0) and weighted fresh share (ratings >= 70), where a
   * verified listen weighs 1.5x. Public via `recalculateAudienceScore` for the seed and tests.
   */
  async recalculateAudienceScore(releaseId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: { releaseId, isCritic: false },
      select: { rating: true, isVerifiedListen: true },
    });
    const score = aggregateScore(reviews);
    await this.prisma.release.update({
      where: { id: releaseId },
      data: {
        audienceAvg: score.avg,
        audienceFreshPct: score.freshPct,
        audienceCount: score.count,
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

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true },
    });
    if (!review) throw new NotFoundError('Recensione non trovata');
    const target = {
      recipientId: review.userId,
      actorId: userId,
      type: 'REVIEW_REACTION',
      reviewId,
    } as const;

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
      const remaining = await this.prisma.reviewReaction.count({ where: { reviewId, userId } });
      if (remaining === 0) await this.notifications.retract(target);
      return { added: false, type: type as ReactionType };
    }

    await this.prisma.reviewReaction.create({
      data: {
        reviewId,
        userId,
        type: type as ReactionType,
      },
    });
    const alreadyNotified = await this.prisma.notification.count({
      where: { ...target, readAt: null },
    });
    if (alreadyNotified === 0) await this.notifications.notify(target);

    return { added: true, type: type as ReactionType };
  }

  /**
   * Recupera le recensioni di una Release con aggregazione reazioni
   */
  async getReleaseReviews(releaseId: string, currentUserId?: string): Promise<ReviewItem[]> {
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
        role: r.user.role as UserRole,
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
