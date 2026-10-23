import type { Redis } from 'ioredis';
import type { PrismaClient } from '@openmusic/db';
import { systemClock, type Clock } from '../../lib/upstream';

/** Sorted set userId -> last heartbeat (ms) of users with at least one live socket. */
export const ONLINE_KEY = 'np:online';
const SEEN_THROTTLE_PREFIX = 'np:seen:';

export interface ListeningActivityOptions {
  clock?: Clock;
  /** How often the gateway refreshes its online users. */
  heartbeatMs?: number;
  /** `User.lastSeenAt` is written at most this often per user. */
  seenWriteIntervalSeconds?: number;
  /**
   * Called (at most once per `seenWriteIntervalSeconds`) after `lastSeenAt` is written: the
   * poller resumes accounts it had PAUSED for inactivity.
   */
  onUserSeen?: (userId: string) => Promise<void>;
  /** Called when a user opens a socket (the poller moves their next read closer). */
  onUserOnline?: (userId: string) => Promise<void>;
}

/**
 * Who is in the app right now, across API instances (Redis), and when each user was last seen
 * (Postgres). The now-playing poller reads it to pick a fast interval (user or a follower
 * online), a slow one, or none at all (not seen for N days). ADR-013.
 */
export class ListeningActivity {
  readonly heartbeatMs: number;
  private readonly clock: Clock;
  private readonly seenWriteIntervalSeconds: number;

  constructor(
    private readonly redis: Redis,
    private readonly prisma: PrismaClient,
    private readonly options: ListeningActivityOptions = {}
  ) {
    this.clock = options.clock ?? systemClock;
    this.heartbeatMs = options.heartbeatMs ?? 60_000;
    this.seenWriteIntervalSeconds = options.seenWriteIntervalSeconds ?? 60 * 60;
  }

  /** A heartbeat older than this means the instance holding the socket is gone. */
  private get onlineWindowMs(): number {
    return this.heartbeatMs * 2.5;
  }

  async socketConnected(userId: string): Promise<void> {
    await this.redis.zadd(ONLINE_KEY, this.clock.now(), userId);
    await this.touch(userId);
    await this.options.onUserOnline?.(userId);
  }

  /** The user's last socket on THIS instance closed (another instance re-adds it on heartbeat). */
  async socketsClosed(userId: string): Promise<void> {
    await this.redis.zrem(ONLINE_KEY, userId);
  }

  async heartbeat(userIds: readonly string[]): Promise<void> {
    const now = this.clock.now();
    if (userIds.length > 0) {
      const args = userIds.flatMap((id) => [now, id]);
      await this.redis.zadd(ONLINE_KEY, ...args);
    }
    // Entries no instance refreshed (crash, deploy) expire here.
    await this.redis.zremrangebyscore(ONLINE_KEY, '-inf', now - this.onlineWindowMs);
  }

  /** True when any of `userIds` has a live socket on some instance. */
  async anyOnline(userIds: readonly string[]): Promise<boolean> {
    const threshold = this.clock.now() - this.onlineWindowMs;
    for (let i = 0; i < userIds.length; i += 500) {
      const chunk = userIds.slice(i, i + 500);
      const scores = await this.redis.zmscore(ONLINE_KEY, ...chunk);
      if (scores.some((s) => s !== null && Number(s) >= threshold)) return true;
    }
    return false;
  }

  /**
   * The user opened the app (socket or `GET /api/auth/me`). Writes `lastSeenAt` at most once an
   * hour; accounts paused for inactivity are resumed.
   */
  async touch(userId: string): Promise<void> {
    const first = await this.redis.set(
      `${SEEN_THROTTLE_PREFIX}${userId}`,
      '1',
      'EX',
      this.seenWriteIntervalSeconds,
      'NX'
    );
    if (first !== 'OK') return;
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { lastSeenAt: new Date(this.clock.now()) },
    });
    if (updated.count > 0) await this.options.onUserSeen?.(userId);
  }
}
