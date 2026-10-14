import type { PrismaClient } from '@prisma/client';
import type { UserProfileData, ReviewItem, HeavyRotationItem } from '@openmusic/shared';

export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserProfile(userId: string): Promise<UserProfileData | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    // 1. Recensioni recenti dell'utente
    const reviews = await this.prisma.review.findMany({
      where: { userId },
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
      take: 10,
    });

    const mappedReviews: ReviewItem[] = reviews.map((r) => {
      const reactionCounts = {
        AGREE: 0,
        WELL_WRITTEN: 0,
        DISCOVERED: 0,
        HEART: 0,
      };
      for (const rx of r.reactions) {
        reactionCounts[rx.type] = (reactionCounts[rx.type] || 0) + 1;
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
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    // 2. Rotazione Pesante (ultimi 30 giorni)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentScrobbles = await this.prisma.scrobbleLog.findMany({
      where: {
        userId,
        playedAt: { gte: thirtyDaysAgo },
      },
      include: {
        track: {
          include: { release: true },
        },
      },
      orderBy: { playedAt: 'desc' },
    });

    // Raggruppa per traccia
    const trackCounts = new Map<string, { count: number; lastPlayed: Date; track: typeof recentScrobbles[0]['track'] }>();

    for (const scrobble of recentScrobbles) {
      const existing = trackCounts.get(scrobble.trackId);
      if (existing) {
        existing.count += 1;
      } else {
        trackCounts.set(scrobble.trackId, {
          count: 1,
          lastPlayed: scrobble.playedAt,
          track: scrobble.track,
        });
      }
    }

    const heavyRotation: HeavyRotationItem[] = Array.from(trackCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ track, count, lastPlayed }) => ({
        track: {
          id: track.id,
          isrc: track.isrc,
          title: track.title,
          artistName: track.artistName,
          durationMs: track.durationMs,
          previewUrl: track.previewUrl,
          releaseId: track.releaseId,
          coverUrl: track.release.coverUrl,
        },
        playCount: count,
        lastPlayedAt: lastPlayed.toISOString(),
      }));

    // 3. Statistiche complessive
    const totalReviews = await this.prisma.review.count({ where: { userId } });
    const verifiedReviews = await this.prisma.review.count({
      where: { userId, isVerifiedListen: true },
    });
    const totalScrobbles = await this.prisma.scrobbleLog.count({ where: { userId } });

    const avgRatingAgg = await this.prisma.review.aggregate({
      where: { userId },
      _avg: { rating: true },
    });
    const averageRating = avgRatingAgg._avg.rating
      ? Math.round((avgRatingAgg._avg.rating / 20) * 10) / 10
      : null;

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        isGhostMode: user.isGhostMode,
        createdAt: user.createdAt.toISOString(),
      },
      recentReviews: mappedReviews,
      heavyRotation,
      stats: {
        totalReviews,
        verifiedReviews,
        totalScrobbles,
        averageRating,
      },
    };
  }
}
