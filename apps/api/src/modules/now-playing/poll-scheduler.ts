import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { SyncedProvider } from '@openmusic/shared';
import { systemClock, type Clock } from '../../lib/upstream';

/** Sorted set userId -> next due time (ms). Shared by every API instance. */
export const DUE_KEY = 'np:poll:due';
const LEASE_PREFIX = 'np:poll:lease:';
const BACKOFF_PREFIX = 'np:poll:backoff:';
const SWEEP_LOCK_KEY = 'np:poll:sweep';

// Deletes the key only while it still holds our token (a lease that expired and was taken by
// another instance must not be released by us).
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

export interface PollSchedulerOptions {
  clock?: Clock;
  /** Identifies this instance in lease values (logs/debugging). */
  instanceId?: string;
}

/**
 * Redis state of the now-playing poller (ADR-013), so it survives restarts and scales out:
 * - `np:poll:due`: when each user must be read next;
 * - `np:poll:lease:<userId>`: `SET NX PX` lease, so two instances never read one user at once;
 * - `np:poll:backoff:<provider>`: a provider-wide pause after a 429 (`Retry-After`);
 * - `np:poll:sweep`: lease for the periodic DB reconciliation (one instance at a time).
 */
export class PollScheduler {
  readonly instanceId: string;
  private readonly clock: Clock;

  constructor(
    private readonly redis: Redis,
    options: PollSchedulerOptions = {}
  ) {
    this.clock = options.clock ?? systemClock;
    this.instanceId = options.instanceId ?? randomUUID();
  }

  /** Users whose next read is due, oldest first. */
  async due(limit: number): Promise<string[]> {
    return this.redis.zrangebyscore(DUE_KEY, '-inf', this.clock.now(), 'LIMIT', 0, limit);
  }

  async isDue(userId: string): Promise<boolean> {
    const score = await this.redis.zscore(DUE_KEY, userId);
    return score !== null && Number(score) <= this.clock.now();
  }

  async schedule(userId: string, at: number): Promise<void> {
    await this.redis.zadd(DUE_KEY, Math.round(at), userId);
  }

  /** Adds the user only if not scheduled yet (DB reconciliation). Returns true when added. */
  async ensureScheduled(userId: string, at: number): Promise<boolean> {
    const added = await this.redis.zadd(DUE_KEY, 'NX', Math.round(at), userId);
    return Number(added) === 1;
  }

  /** Moves an already scheduled read earlier (never later): a user just opened the app. */
  async expedite(userId: string, at: number): Promise<void> {
    await this.redis.zadd(DUE_KEY, 'XX', 'LT', Math.round(at), userId);
  }

  /** Schedules a read at `at` whether or not the user was scheduled (account just linked). */
  async wake(userId: string, at = this.clock.now()): Promise<void> {
    // `LT` only lowers existing scores and still adds missing members (Redis >= 6.2).
    await this.redis.zadd(DUE_KEY, 'LT', Math.round(at), userId);
  }

  async unschedule(userId: string): Promise<void> {
    await this.redis.zrem(DUE_KEY, userId);
  }

  async nextDueAt(userId: string): Promise<number | null> {
    const score = await this.redis.zscore(DUE_KEY, userId);
    return score === null ? null : Number(score);
  }

  async scheduledCount(): Promise<number> {
    return this.redis.zcard(DUE_KEY);
  }

  /** Returns a release token when this instance now holds the user's lease, else null. */
  async acquireLease(userId: string, ttlMs: number): Promise<string | null> {
    const token = `${this.instanceId}:${randomUUID()}`;
    const ok = await this.redis.set(`${LEASE_PREFIX}${userId}`, token, 'PX', ttlMs, 'NX');
    return ok === 'OK' ? token : null;
  }

  async releaseLease(userId: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, `${LEASE_PREFIX}${userId}`, token);
  }

  /** Provider-wide pause (429 Retry-After), visible to every instance. */
  async backOff(provider: SyncedProvider, ms: number): Promise<void> {
    const until = this.clock.now() + ms;
    const key = `${BACKOFF_PREFIX}${provider}`;
    const current = Number((await this.redis.get(key)) ?? 0);
    if (current >= until) return;
    await this.redis.set(key, String(until), 'PX', Math.max(1, Math.ceil(ms)));
  }

  /** When the provider may be called again (ms), or 0 when it is not backed off. */
  async backedOffUntil(provider: SyncedProvider): Promise<number> {
    const value = await this.redis.get(`${BACKOFF_PREFIX}${provider}`);
    const until = value ? Number(value) : 0;
    return until > this.clock.now() ? until : 0;
  }

  /** Lease for the DB sweep; true when this instance should run it now. */
  async acquireSweep(ttlMs: number): Promise<boolean> {
    const ok = await this.redis.set(SWEEP_LOCK_KEY, this.instanceId, 'PX', ttlMs, 'NX');
    return ok === 'OK';
  }
}
