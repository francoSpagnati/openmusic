import type { NowPlayingTrack } from '@openmusic/shared';

const PRUNE_THRESHOLD = 10_000;

/**
 * Leading + trailing throttle per user: the first update is broadcast at once, later ones within
 * the interval are coalesced and only the latest is sent when the interval ends. Scrubbing a
 * track or a buggy client can no longer flood every follower. One instance is shared by the
 * socket gateway and the background poller (ADR-013), so both sources obey the same limit.
 */
export class NowPlayingThrottle {
  private readonly lastSent = new Map<string, number>();
  private readonly pending = new Map<string, { track: NowPlayingTrack; timer: NodeJS.Timeout }>();
  private nextPruneAt = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly publish: (userId: string, track: NowPlayingTrack) => Promise<unknown>,
    private readonly onError: (err: unknown, userId: string) => void
  ) {}

  /** Returns true when the update was published now, false when it was deferred. */
  async submit(userId: string, track: NowPlayingTrack): Promise<boolean> {
    const now = Date.now();
    const last = this.lastSent.get(userId) ?? 0;
    const queued = this.pending.get(userId);
    if (!queued && now - last >= this.intervalMs) {
      this.prune(now);
      this.lastSent.set(userId, now);
      await this.publish(userId, track);
      return true;
    }
    if (queued) {
      queued.track = track;
      return false;
    }
    const timer = setTimeout(
      () => {
        const entry = this.pending.get(userId);
        this.pending.delete(userId);
        if (!entry) return;
        this.lastSent.set(userId, Date.now());
        this.publish(userId, entry.track).catch((err: unknown) => this.onError(err, userId));
      },
      this.intervalMs - (now - last)
    );
    timer.unref();
    this.pending.set(userId, { track, timer });
    return false;
  }

  /**
   * `lastSent` only matters inside the interval: with the background poller publishing for
   * every listening user (not only connected sockets), old entries are dropped so the map stays
   * proportional to recent activity instead of growing with every user ever seen.
   */
  private prune(now: number): void {
    if (this.lastSent.size < PRUNE_THRESHOLD || now < this.nextPruneAt) return;
    this.nextPruneAt = now + Math.max(this.intervalMs, 1_000);
    for (const [userId, sentAt] of this.lastSent) {
      if (now - sentAt >= this.intervalMs && !this.pending.has(userId)) {
        this.lastSent.delete(userId);
      }
    }
  }

  /** Drops a pending update (user went offline / session revoked). */
  cancel(userId: string): void {
    const entry = this.pending.get(userId);
    if (entry) clearTimeout(entry.timer);
    this.pending.delete(userId);
    this.lastSent.delete(userId);
  }

  dispose(): void {
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
    this.lastSent.clear();
  }
}
