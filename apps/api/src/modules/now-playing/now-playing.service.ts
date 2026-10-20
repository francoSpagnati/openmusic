import type { Redis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { type FriendPresence, NowPlayingTrackSchema } from '@openmusic/shared';

const PRESENCE_TTL_SECONDS = 300; // 5 minuti di TTL automatico in Redis

export class NowPlayingService {
  constructor(
    private readonly redis: Redis,
    private readonly prisma: PrismaClient
  ) {}

  private getKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  /**
   * Aggiorna il brano in ascolto in Redis.
   * Rispetta rigorosamente l'Euristica #3 di Nielsen (Ghost Mode):
   * se l'utente è in Ghost Mode, non trasmette il brano agli amici.
   */
  async updateUserNowPlaying(
    userId: string,
    rawTrack: unknown
  ): Promise<FriendPresence | null> {
    const parsedTrack = NowPlayingTrackSchema.parse(rawTrack);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isGhostMode: true,
      },
    });

    if (!user) return null;

    const presence: FriendPresence = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      isGhostMode: user.isGhostMode,
      // Se Ghost Mode è attiva, oscuriamo l'ascolto live verso l'esterno
      currentlyPlaying: user.isGhostMode ? null : parsedTrack,
    };

    await this.redis.setex(
      this.getKey(userId),
      PRESENCE_TTL_SECONDS,
      JSON.stringify(presence)
    );

    return presence;
  }

  /**
   * Attiva/Disattiva la Ghost Mode a 1-tap e pulisce istantaneamente la cache live
   */
  async setGhostMode(userId: string, isGhostMode: boolean): Promise<FriendPresence | null> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isGhostMode },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isGhostMode: true,
      },
    });

    const presence: FriendPresence = {
      userId: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      isOnline: true,
      isGhostMode: updatedUser.isGhostMode,
      currentlyPlaying: null,
    };

    await this.redis.setex(
      this.getKey(userId),
      PRESENCE_TTL_SECONDS,
      JSON.stringify(presence)
    );

    return presence;
  }

  /**
   * Recupera in un'unica chiamata Redis MGET (O(N) ultra-veloce in RAM)
   * lo stato live di tutti gli amici seguiti dall'utente.
   */
  async getFriendsLivePresence(userId: string): Promise<FriendPresence[]> {
    const following = await this.prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    if (following.length === 0) return [];

    const keys = following.map((f) => this.getKey(f.followingId));
    const rawStates = await this.redis.mget(...keys);

    return rawStates
      .filter((raw): raw is string => raw !== null)
      .map((raw) => JSON.parse(raw) as FriendPresence);
  }
}