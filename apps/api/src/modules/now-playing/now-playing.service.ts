import type { Redis } from 'ioredis';
import type { PrismaClient } from '@openmusic/db';
import {
  type FriendPresence,
  FriendPresenceSchema,
  NowPlayingTrackSchema,
} from '@openmusic/shared';
import { NotFoundError } from '../../lib/errors';
import { followerIdsOf } from '../../lib/follows';
import type { RealtimeEmitter } from '../../lib/realtime';

const PRESENCE_TTL_SECONDS = 300; // 5 minuti di TTL automatico in Redis

const PRESENCE_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isGhostMode: true,
} as const;

/**
 * Live "now playing" presence in Redis. Every change is pushed ONLY to the user's followers
 * (their `user:<id>` rooms), never broadcast to all sockets.
 */
export class NowPlayingService {
  constructor(
    private readonly redis: Redis,
    private readonly prisma: PrismaClient,
    private readonly realtime: RealtimeEmitter
  ) {}

  private getKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  private async publish(presence: FriendPresence): Promise<void> {
    const followers = await followerIdsOf(this.prisma, presence.userId);
    this.realtime.toUsers(followers, 'now_playing:friend_presence_changed', presence);
  }

  private async loadUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PRESENCE_USER_SELECT,
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    return user;
  }

  /**
   * Stores the track the user is playing and notifies followers. Nielsen #3 (Ghost Mode): in
   * ghost mode the track is never exposed.
   */
  async updateUserNowPlaying(userId: string, rawTrack: unknown): Promise<FriendPresence> {
    const parsedTrack = NowPlayingTrackSchema.parse(rawTrack);
    const user = await this.loadUser(userId);

    const presence: FriendPresence = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      isGhostMode: user.isGhostMode,
      currentlyPlaying: user.isGhostMode ? null : parsedTrack,
    };

    await this.redis.setex(this.getKey(userId), PRESENCE_TTL_SECONDS, JSON.stringify(presence));
    await this.publish(presence);
    return presence;
  }

  /** One-tap Ghost Mode: persists the flag, clears the live track, notifies followers. */
  async setGhostMode(userId: string, isGhostMode: boolean): Promise<FriendPresence> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isGhostMode },
      select: PRESENCE_USER_SELECT,
    });

    const presence: FriendPresence = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      isGhostMode: user.isGhostMode,
      currentlyPlaying: null,
    };

    await this.redis.setex(this.getKey(userId), PRESENCE_TTL_SECONDS, JSON.stringify(presence));
    await this.publish(presence);
    return presence;
  }

  /**
   * Same track still playing (background poller): extends the presence TTL without notifying
   * anyone. Returns false when there is no visible track to extend (expired, cleared, Ghost Mode
   * just turned off), so the caller publishes it again.
   */
  async refreshTrack(userId: string): Promise<boolean> {
    const raw = await this.redis.get(this.getKey(userId));
    if (!raw) return false;
    const stored = FriendPresenceSchema.safeParse(JSON.parse(raw));
    if (!stored.success || !stored.data.currentlyPlaying) return false;
    await this.redis.expire(this.getKey(userId), PRESENCE_TTL_SECONDS);
    return true;
  }

  /** Playback stopped on the provider: followers see the user without a track. */
  async clearTrack(userId: string): Promise<void> {
    const raw = await this.redis.get(this.getKey(userId));
    if (!raw) return;
    const stored = FriendPresenceSchema.safeParse(JSON.parse(raw));
    if (!stored.success || !stored.data.currentlyPlaying) return;
    const presence: FriendPresence = { ...stored.data, currentlyPlaying: null };
    await this.redis.setex(this.getKey(userId), PRESENCE_TTL_SECONDS, JSON.stringify(presence));
    await this.publish(presence);
  }

  /** Called when the user's last socket disconnects. */
  async setOffline(userId: string): Promise<void> {
    await this.redis.del(this.getKey(userId));
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PRESENCE_USER_SELECT,
    });
    if (!user) return;
    await this.publish({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOnline: false,
      isGhostMode: user.isGhostMode,
      currentlyPlaying: null,
    });
  }

  /** Live presence of everyone the user follows, in one Redis MGET. */
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
