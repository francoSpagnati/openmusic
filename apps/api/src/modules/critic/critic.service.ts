import type { PrismaClient } from '@openmusic/db';
import type {
  CriticAccreditationRequest,
  CriticAccreditationStatus,
  CriticReviewItem,
  DualScoreDetails,
  PendingCriticRequest,
  PublishCriticReviewInput,
} from '@openmusic/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { NotificationsService } from '../notifications/notifications.service';
import { recalculateReleaseScores } from '../reviews/release-scores';

export class CriticService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Files (or updates) an accreditation request. The role does NOT change here: an ADMIN must
   * approve it through `verify`.
   */
  async applyForAccreditation(
    userId: string,
    input: CriticAccreditationRequest
  ): Promise<CriticAccreditationStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    if (user.role === 'CRITIC') throw new ConflictError('Sei già un critico accreditato');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        criticOutlet: input.outletName.trim(),
        criticPortfolioUrl: input.portfolioUrl,
        criticRequestedAt: new Date(),
        bio: input.bio?.trim() || undefined,
      },
    });
    return this.getAccreditationStatus(userId);
  }

  async getAccreditationStatus(userId: string): Promise<CriticAccreditationStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, criticOutlet: true, criticRequestedAt: true, criticVerifiedAt: true },
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    const status =
      user.role === 'CRITIC' ? 'APPROVED' : user.criticRequestedAt ? 'PENDING' : 'NONE';
    return {
      status,
      outletName: user.criticOutlet,
      requestedAt: user.criticRequestedAt?.toISOString() ?? null,
      verifiedAt: user.criticVerifiedAt?.toISOString() ?? null,
    };
  }

  /** ADMIN queue of pending requests, oldest first. */
  async listPendingRequests(): Promise<PendingCriticRequest[]> {
    const users = await this.prisma.user.findMany({
      where: { criticRequestedAt: { not: null }, role: { not: 'CRITIC' } },
      orderBy: { criticRequestedAt: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        criticOutlet: true,
        criticPortfolioUrl: true,
        criticRequestedAt: true,
      },
    });
    return users.flatMap((u) =>
      u.criticRequestedAt && u.criticOutlet
        ? [
            {
              userId: u.id,
              username: u.username,
              displayName: u.displayName,
              outletName: u.criticOutlet,
              portfolioUrl: u.criticPortfolioUrl,
              requestedAt: u.criticRequestedAt.toISOString(),
            },
          ]
        : []
    );
  }

  /** ADMIN decision on a pending request. Approval grants the CRITIC role and notifies the user. */
  async verify(
    adminId: string,
    userId: string,
    approve: boolean
  ): Promise<CriticAccreditationStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, criticRequestedAt: true },
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    if (!user.criticRequestedAt)
      throw new BadRequestError('Nessuna richiesta di accredito in attesa');
    if (user.role !== 'USER' && user.role !== 'CRITIC') {
      throw new BadRequestError('Il ruolo di questo utente non può essere modificato');
    }

    if (approve) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'CRITIC', criticVerifiedAt: new Date(), criticRequestedAt: null },
      });
      await this.notifications.notify({
        recipientId: userId,
        actorId: adminId,
        type: 'CRITIC_APPROVED',
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { criticRequestedAt: null, criticPortfolioUrl: null },
      });
    }
    return this.getAccreditationStatus(userId);
  }

  /**
   * Pubblica una recensione ufficiale della critica e ricalcola il Critic Score
   */
  async publishCriticReview(
    userId: string,
    input: PublishCriticReviewInput
  ): Promise<CriticReviewItem> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'CRITIC') {
      throw new ForbiddenError('Solo i critici accreditati possono pubblicare un Critic Score');
    }
    const release = await this.prisma.release.count({ where: { id: input.releaseId } });
    if (release === 0) throw new NotFoundError('Album non trovato');

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

    // Both pools: the upsert may turn the critic's earlier audience review into a critic one.
    await recalculateReleaseScores(this.prisma, input.releaseId);

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
