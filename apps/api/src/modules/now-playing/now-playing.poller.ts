import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { PrismaClient } from '@openmusic/db';
import {
  SyncedProviderSchema,
  type NowPlayingTrack,
  type ProviderSyncErrorCode,
  type SyncedProvider,
} from '@openmusic/shared';
import type { BackgroundQueue } from '../../lib/background';
import { followerIdsOf } from '../../lib/follows';
import { CircuitBreaker, RateLimiter, systemClock, type Clock } from '../../lib/upstream';
import { SpotifyTokenRevokedError, type SpotifyService } from '../auth/spotify.service';
import type { LastFmService } from '../auth/lastfm.service';
import { isScrobbleEligible, spotifyListenedTrack } from '../spotify/spotify-sync.service';
import type { ListeningActivity } from './listening-activity';
import type { PollScheduler } from './poll-scheduler';
import {
  SYNCED_PROVIDERS,
  type ProviderSyncStore,
  type SyncedAccount,
} from './provider-sync.store';
import { ScrobbleRecorder, type ListenedTrack } from './scrobble-recorder';

const STATE_PREFIX = 'np:poll:state:';
const STATE_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_COLOR = '#D97736';
/** A 429 without `Retry-After` pauses the provider this long. */
const DEFAULT_RETRY_AFTER_MS = 30_000;
const LASTFM_RATE_LIMIT_PAUSE_MS = 60_000;

export interface PollerLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

/** What the poller needs from Spotify tokens (SpotifySyncService). */
export interface SpotifyTokenSource {
  getValidAccessToken(
    userId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<{ accessToken: string }>;
}

/** Where presence goes: the shared socket throttle + NowPlayingService (Ghost Mode handled by the poller). */
export interface PresenceSink {
  submit(userId: string, track: NowPlayingTrack): Promise<unknown>;
  /** Same track still playing: extend the TTL. False = nothing visible, publish again. */
  refresh(userId: string): Promise<boolean>;
  clear(userId: string): Promise<void>;
}

export interface NowPlayingPollerDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: PollerLogger;
  scheduler: PollScheduler;
  activity: ListeningActivity;
  store: ProviderSyncStore;
  spotify: SpotifyService;
  spotifyTokens: SpotifyTokenSource;
  lastfm: LastFmService;
  presence: PresenceSink;
  scrobbles: ScrobbleRecorder;
  /** Catalog resolution + ScrobbleLog writes run here, off the polling loop. */
  background: BackgroundQueue;
}

export interface NowPlayingPollerOptions {
  /** Interval while the user or a follower is online, or something played recently. */
  activeIntervalMs: number;
  /** Interval for idle users. */
  idleIntervalMs: number;
  /** Not seen in the app for this long: accounts PAUSED, user unscheduled. */
  inactiveAfterMs: number;
  /** Users read in parallel by this instance. */
  concurrency: number;
  /** "Played something recently" window that keeps the fast interval. Default 10 min. */
  recentPlayMs?: number;
  /** ± fraction of random jitter on every interval. Default 0.2. */
  jitter?: number;
  /** Main loop period. Default 1 s. */
  tickMs?: number;
  /** DB reconciliation period (schedule linked users, pause idle ones). Default 60 s. */
  sweepIntervalMs?: number;
  /** Per-user lease; longer than any single poll. Default 60 s. */
  leaseMs?: number;
  /** Per-instance request budget per provider (token bucket). */
  spotifyRate?: { intervalMs: number; burst: number };
  lastfmRate?: { intervalMs: number; burst: number };
  clock?: Clock;
  random?: () => number;
}

/** Normalized playback from either provider. */
interface Observation {
  provider: SyncedProvider;
  listened: ListenedTrack;
  isPlaying: boolean;
  /** Spotify only; Last.fm has no progress. */
  progressMs: number | null;
  /** Identity of the track for change detection. */
  key: string;
}

/** Last thing seen for a user, in Redis so any instance can continue from it. */
const PollStateSchema = z.object({
  key: z.string().nullable(),
  isPlaying: z.boolean(),
  provider: SyncedProviderSchema.nullable(),
  firstSeenAt: z.number(),
  lastPlayingAt: z.number(),
  scrobbled: z.boolean(),
});
type PollState = z.infer<typeof PollStateSchema>;

type ReadResult =
  /** `observation` null = the provider says nothing is playing. */
  | { kind: 'ok'; observation: Observation | null }
  /** Not read now (backoff, circuit open, request budget exhausted): retry at `retryAt`. */
  | { kind: 'skipped'; retryAt: number }
  /** Read failed (temporary) or the account was stopped. */
  | { kind: 'failed' };

/**
 * Background reader of what users are playing on Spotify and Last.fm (ADR-013).
 *
 * Every instance runs the same loop: take due users from the Redis schedule, lease each one
 * (`SET NX PX`), read its providers, publish presence / record scrobbles only on change, and
 * schedule the next read with an adaptive interval. A periodic sweep (one instance at a time)
 * reconciles the schedule with the database.
 */
export class NowPlayingPoller {
  private readonly clock: Clock;
  private readonly random: () => number;
  private readonly spotifyLimiter: RateLimiter;
  private readonly lastfmLimiter: RateLimiter;
  private readonly spotifyCircuit: CircuitBreaker;
  private readonly lastfmCircuit: CircuitBreaker;
  private readonly inFlight = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopping = false;
  private nextSweepAt = 0;
  private lastSweepSummary = '';

  constructor(
    private readonly deps: NowPlayingPollerDeps,
    private readonly options: NowPlayingPollerOptions
  ) {
    this.clock = options.clock ?? systemClock;
    this.random = options.random ?? Math.random;
    const queue = Math.max(4, options.concurrency * 4);
    const spotifyRate = options.spotifyRate ?? { intervalMs: 100, burst: 5 };
    const lastfmRate = options.lastfmRate ?? { intervalMs: 250, burst: 4 };
    this.spotifyLimiter = new RateLimiter(
      spotifyRate.intervalMs,
      this.clock,
      queue,
      spotifyRate.burst
    );
    this.lastfmLimiter = new RateLimiter(
      lastfmRate.intervalMs,
      this.clock,
      queue,
      lastfmRate.burst
    );
    this.spotifyCircuit = new CircuitBreaker(this.clock, 5, 60_000);
    this.lastfmCircuit = new CircuitBreaker(this.clock, 5, 60_000);
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.stopping = false;
    this.deps.logger.info(
      {
        instance: this.deps.scheduler.instanceId,
        activeIntervalS: Math.round(this.options.activeIntervalMs / 1000),
        idleIntervalS: Math.round(this.options.idleIntervalMs / 1000),
        inactiveAfterDays: Math.round(this.options.inactiveAfterMs / 86_400_000),
        concurrency: this.options.concurrency,
        lastfm: this.deps.lastfm.canReadRecentTracks ? 'enabled' : 'no API key',
      },
      'Now-playing poller started'
    );
    this.timer = setInterval(() => void this.tick(), this.options.tickMs ?? 1_000);
    this.timer.unref();
    void this.tick();
  }

  /** Stops scheduling new reads and waits for the ones in flight (graceful shutdown). */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    const wasRunning = this.timer !== null;
    this.timer = null;
    await Promise.allSettled([...this.inFlight.values()]);
    if (wasRunning) this.deps.logger.info({}, 'Now-playing poller stopped');
  }

  /** One loop iteration, awaited to the end (tests drive the poller with this). */
  async runOnce(options: { sweep?: boolean } = {}): Promise<void> {
    if (options.sweep) await this.sweep();
    await this.startDue();
    await Promise.allSettled([...this.inFlight.values()]);
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      if (this.clock.now() >= this.nextSweepAt) {
        this.nextSweepAt = this.clock.now() + (this.options.sweepIntervalMs ?? 60_000);
        await this.sweep();
      }
      await this.startDue();
    } catch (err) {
      this.deps.logger.warn({ err }, 'Now-playing poller tick failed');
    } finally {
      this.ticking = false;
    }
  }

  private async startDue(): Promise<void> {
    const free = this.options.concurrency - this.inFlight.size;
    if (free <= 0 || this.stopping) return;
    const due = await this.deps.scheduler.due(free * 2);
    for (const userId of due) {
      if (this.stopping) break;
      if (this.inFlight.size >= this.options.concurrency) break;
      if (this.inFlight.has(userId)) continue;
      const run = this.runUser(userId)
        .catch((err: unknown) => this.deps.logger.warn({ err, userId }, 'Now-playing poll failed'))
        .finally(() => this.inFlight.delete(userId));
      this.inFlight.set(userId, run);
    }
  }

  /**
   * DB reconciliation: pauses accounts of users not seen for `inactiveAfterMs`, resumes the
   * others, and makes sure every user with an ACTIVE account is in the schedule (new links,
   * Redis flushed). Runs on one instance per period.
   */
  async sweep(): Promise<void> {
    const { prisma, scheduler, logger } = this.deps;
    const period = this.options.sweepIntervalMs ?? 60_000;
    if (!(await scheduler.acquireSweep(Math.max(1_000, period - 1_000)))) return;
    const cutoff = new Date(this.clock.now() - this.options.inactiveAfterMs);
    const providers = { in: [...SYNCED_PROVIDERS] };

    const paused = await prisma.connectedAccount.updateMany({
      where: { provider: providers, syncStatus: 'ACTIVE', user: { lastSeenAt: { lt: cutoff } } },
      data: { syncStatus: 'PAUSED' },
    });
    const resumed = await prisma.connectedAccount.updateMany({
      where: { provider: providers, syncStatus: 'PAUSED', user: { lastSeenAt: { gte: cutoff } } },
      data: { syncStatus: 'ACTIVE' },
    });

    let added = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await prisma.connectedAccount.findMany({
        where: { provider: providers, syncStatus: 'ACTIVE' },
        select: { id: true, userId: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        // Spread first reads over one active interval instead of a burst at boot.
        const at = this.clock.now() + Math.floor(this.random() * this.options.activeIntervalMs);
        if (await scheduler.ensureScheduled(row.userId, at)) added++;
      }
      cursor = rows[rows.length - 1]?.id;
      if (rows.length < 500) break;
    }

    const scheduled = await scheduler.scheduledCount();
    const summary = `${scheduled}/${added}/${paused.count}/${resumed.count}`;
    if (summary !== this.lastSweepSummary) {
      this.lastSweepSummary = summary;
      logger.info(
        { scheduled, added, paused: paused.count, resumed: resumed.count },
        'Now-playing sweep'
      );
    }
  }

  private async runUser(userId: string): Promise<void> {
    const { scheduler } = this.deps;
    const lease = await scheduler.acquireLease(userId, this.options.leaseMs ?? 60_000);
    if (!lease) return; // another instance is reading this user
    try {
      // The other instance may have finished between our ZRANGE and our lease.
      if (!(await scheduler.isDue(userId))) return;
      let next: number | null;
      try {
        next = await this.pollUser(userId);
      } catch (err) {
        this.deps.logger.warn({ err, userId }, 'Now-playing poll failed');
        next = this.clock.now() + this.withJitter(this.options.idleIntervalMs);
      }
      if (next === null) await scheduler.unschedule(userId);
      else await scheduler.schedule(userId, next);
    } finally {
      await scheduler.releaseLease(userId, lease);
    }
  }

  /** Reads one user. Returns when to read them next, or null to stop polling them. */
  async pollUser(userId: string): Promise<number | null> {
    const { prisma } = this.deps;
    const now = this.clock.now();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isGhostMode: true,
        lastSeenAt: true,
        connectedAccounts: {
          where: { provider: { in: [...SYNCED_PROVIDERS] } },
          select: {
            id: true,
            provider: true,
            providerId: true,
            syncStatus: true,
            lastSyncedAt: true,
            syncError: true,
          },
        },
      },
    });
    if (!user) return null;
    const accounts = user.connectedAccounts.filter((a) => a.syncStatus === 'ACTIVE');
    if (accounts.length === 0) return null; // unlinked, ERROR or PAUSED
    if (user.lastSeenAt && now - user.lastSeenAt.getTime() >= this.options.inactiveAfterMs) {
      await this.deps.store.pauseUser(userId);
      return null;
    }

    const spotifyAccount = accounts.find((a) => a.provider === 'SPOTIFY');
    const lastfmAccount = accounts.find((a) => a.provider === 'LASTFM');
    let retryAt = 0;
    let allRead = true;

    let spotifyObs: Observation | null = null;
    if (spotifyAccount) {
      const result = await this.readSpotify(userId, spotifyAccount);
      if (result.kind === 'ok') spotifyObs = result.observation;
      else allRead = false;
      if (result.kind === 'skipped') retryAt = Math.max(retryAt, result.retryAt);
    }

    // Spotify wins while it is playing: Last.fm is not even asked (request budget).
    let lastfmObs: Observation | null = null;
    if (lastfmAccount && !spotifyObs?.isPlaying) {
      const result = await this.readLastFm(lastfmAccount);
      if (result.kind === 'ok') lastfmObs = result.observation;
      else allRead = false;
      if (result.kind === 'skipped') retryAt = Math.max(retryAt, result.retryAt);
    }

    // Precedence: Spotify playing > Last.fm now playing > Spotify paused > nothing.
    const chosen = spotifyObs?.isPlaying ? spotifyObs : (lastfmObs ?? spotifyObs);
    const state = await this.apply(userId, user.isGhostMode, chosen, allRead);

    // The account may have just been stopped (revoked, forbidden): nothing left to read.
    const stillActive = await prisma.connectedAccount.count({
      where: { userId, provider: { in: [...SYNCED_PROVIDERS] }, syncStatus: 'ACTIVE' },
    });
    if (stillActive === 0) return null;

    const interval = (await this.isActive(userId, state))
      ? this.options.activeIntervalMs
      : this.options.idleIntervalMs;
    const next = now + this.withJitter(interval);
    return retryAt > next ? retryAt + this.withJitter(1_000) : next;
  }

  /** Presence and scrobbles, only when something changed. Returns the new state. */
  private async apply(
    userId: string,
    isGhostMode: boolean,
    chosen: Observation | null,
    allRead: boolean
  ): Promise<PollState | null> {
    const { presence, scrobbles, background, logger } = this.deps;
    const now = this.clock.now();
    const prev = await this.loadState(userId);

    if (!chosen) {
      // Unknown (a provider was skipped or failed): never clear on missing information.
      if (!allRead) return prev;
      if (prev?.key) {
        if (!isGhostMode) await presence.clear(userId);
        const cleared: PollState = {
          key: null,
          isPlaying: false,
          provider: null,
          firstSeenAt: now,
          lastPlayingAt: prev.lastPlayingAt,
          scrobbled: false,
        };
        await this.saveState(userId, cleared);
        return cleared;
      }
      return prev;
    }

    const sameTrack = prev?.key === chosen.key;
    const changed = !sameTrack || prev?.isPlaying !== chosen.isPlaying;
    const firstSeenAt = sameTrack && prev ? prev.firstSeenAt : now;

    // Ghost Mode (Nielsen #3): nothing is written to presence or sent to followers.
    if (!isGhostMode) {
      if (changed) {
        await presence.submit(userId, this.toNowPlaying(chosen, now));
      } else if (!(await presence.refresh(userId))) {
        // Expired, cleared by a disconnect, or Ghost Mode just turned off: show it again.
        await presence.submit(userId, this.toNowPlaying(chosen, now));
      }
    }

    // Verified listen (ADR-002), also in Ghost Mode: it is private and only weighs the user's
    // own reviews. Last.fm has no progress: we count the time we have seen it playing.
    let scrobbled = sameTrack && prev ? prev.scrobbled : false;
    const progress = chosen.progressMs ?? now - firstSeenAt;
    if (
      chosen.isPlaying &&
      !scrobbled &&
      isScrobbleEligible(progress, chosen.listened.durationMs)
    ) {
      scrobbled = true;
      if (await scrobbles.claim(userId, chosen.listened)) {
        const listened = chosen.listened;
        const playedAt = new Date(now);
        background.enqueue(`scrobble:${userId}:${ScrobbleRecorder.dedupId(listened)}`, () =>
          scrobbles.record(userId, listened, playedAt).catch((err: unknown) => {
            logger.warn({ err, userId }, 'Scrobble from poller failed');
          })
        );
      }
    }

    const next: PollState = {
      key: chosen.key,
      isPlaying: chosen.isPlaying,
      provider: chosen.provider,
      firstSeenAt,
      lastPlayingAt: chosen.isPlaying ? now : (prev?.lastPlayingAt ?? 0),
      scrobbled,
    };
    await this.saveState(userId, next);
    return next;
  }

  /** Fast interval: something played recently, or the user / a follower has the app open. */
  private async isActive(userId: string, state: PollState | null): Promise<boolean> {
    const recentPlayMs = this.options.recentPlayMs ?? 10 * 60_000;
    if (state && state.lastPlayingAt > 0 && this.clock.now() - state.lastPlayingAt < recentPlayMs) {
      return true;
    }
    const followers = await followerIdsOf(this.deps.prisma, userId);
    return this.deps.activity.anyOnline([userId, ...followers]);
  }

  private withJitter(ms: number): number {
    const jitter = this.options.jitter ?? 0.2;
    return Math.max(1, Math.round(ms * (1 + (this.random() * 2 - 1) * jitter)));
  }

  // -- Spotify -------------------------------------------------------------------------------

  private async readSpotify(userId: string, account: SyncedAccount): Promise<ReadResult> {
    const { scheduler, store, spotifyTokens, logger } = this.deps;
    const backedOff = await scheduler.backedOffUntil('SPOTIFY');
    if (backedOff) return { kind: 'skipped', retryAt: backedOff };
    if (this.spotifyCircuit.isOpen) {
      return { kind: 'skipped', retryAt: this.clock.now() + this.options.activeIntervalMs };
    }

    let token: string;
    try {
      token = (await spotifyTokens.getValidAccessToken(userId)).accessToken;
    } catch (err) {
      return this.spotifyTokenFailure(userId, account, err);
    }

    let result = await this.callSpotify(token);
    if (result === null) {
      return { kind: 'skipped', retryAt: this.clock.now() + this.options.activeIntervalMs };
    }
    if (result.kind === 'unauthorized') {
      // Expired early or revoked: one silent refresh, then a single retry.
      try {
        token = (await spotifyTokens.getValidAccessToken(userId, { forceRefresh: true }))
          .accessToken;
      } catch (err) {
        return this.spotifyTokenFailure(userId, account, err);
      }
      result = await this.callSpotify(token);
      if (result === null) {
        return { kind: 'skipped', retryAt: this.clock.now() + this.options.activeIntervalMs };
      }
    }

    switch (result.kind) {
      case 'ok': {
        this.spotifyCircuit.recordSuccess();
        await store.markSuccess(account);
        const playback = result.playback;
        // Ads and podcasts come with no track: treated as nothing playing.
        if (!playback?.track) return { kind: 'ok', observation: null };
        const listened = spotifyListenedTrack(playback.track);
        return {
          kind: 'ok',
          observation: {
            provider: 'SPOTIFY',
            listened,
            isPlaying: playback.isPlaying,
            progressMs: playback.progressMs,
            key: `spotify:${playback.track.id}`,
          },
        };
      }
      case 'rate_limited': {
        const wait = result.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
        await scheduler.backOff('SPOTIFY', wait);
        logger.warn({ retryAfterMs: wait }, 'Spotify rate limit: pausing the poller for Spotify');
        await store.markError(account, 'RATE_LIMITED', false);
        return { kind: 'skipped', retryAt: this.clock.now() + wait };
      }
      case 'forbidden':
        await store.markError(account, 'ACCESS_DENIED', true);
        return { kind: 'failed' };
      case 'unauthorized':
        // A token refreshed a moment ago was refused again: report it, try later.
        await store.markError(account, 'UPSTREAM_ERROR', false);
        return { kind: 'failed' };
      case 'error':
        this.spotifyCircuit.recordFailure();
        logger.warn({ userId, detail: result.detail }, 'Spotify currently-playing failed');
        await store.markError(account, 'UPSTREAM_ERROR', false);
        return { kind: 'failed' };
    }
  }

  /** Spotify call inside the per-provider request budget; null when the budget queue is full. */
  private async callSpotify(token: string) {
    try {
      await this.spotifyLimiter.acquire();
    } catch {
      return null;
    }
    return this.deps.spotify.fetchCurrentlyPlaying(token);
  }

  private async spotifyTokenFailure(
    userId: string,
    account: SyncedAccount,
    err: unknown
  ): Promise<ReadResult> {
    if (err instanceof SpotifyTokenRevokedError) {
      // getValidAccessToken already set the account to ERROR / TOKEN_REVOKED.
      this.deps.logger.info({ userId }, 'Spotify token revoked: polling stopped until relinked');
      return { kind: 'failed' };
    }
    this.spotifyCircuit.recordFailure();
    this.deps.logger.warn({ err, userId }, 'Spotify token refresh failed');
    await this.deps.store.markError(account, 'UPSTREAM_ERROR', false);
    return { kind: 'failed' };
  }

  // -- Last.fm -------------------------------------------------------------------------------

  private async readLastFm(account: SyncedAccount): Promise<ReadResult> {
    const { scheduler, store, lastfm, logger } = this.deps;
    const backedOff = await scheduler.backedOffUntil('LASTFM');
    if (backedOff) return { kind: 'skipped', retryAt: backedOff };
    if (this.lastfmCircuit.isOpen) {
      return { kind: 'skipped', retryAt: this.clock.now() + this.options.activeIntervalMs };
    }
    try {
      await this.lastfmLimiter.acquire();
    } catch {
      return { kind: 'skipped', retryAt: this.clock.now() + this.options.activeIntervalMs };
    }

    const result = await lastfm.getRecentTracks(account.providerId);
    const fail = async (code: ProviderSyncErrorCode, stop: boolean): Promise<ReadResult> => {
      await store.markError(account, code, stop);
      return { kind: 'failed' };
    };
    switch (result.kind) {
      case 'ok': {
        this.lastfmCircuit.recordSuccess();
        await store.markSuccess(account);
        const np = result.nowPlaying;
        if (!np) return { kind: 'ok', observation: null };
        const listened: ListenedTrack = {
          provider: 'LASTFM',
          title: np.title,
          artist: np.artist,
          album: np.album,
          coverUrl: np.coverUrl,
          isrc: null,
          spotifyId: null,
          durationMs: 0, // unknown: Last.fm "now playing" has no duration
        };
        return {
          kind: 'ok',
          observation: {
            provider: 'LASTFM',
            listened,
            isPlaying: true,
            progressMs: null,
            key: `lastfm:${ScrobbleRecorder.dedupId(listened)}`,
          },
        };
      }
      case 'rate_limited':
        await scheduler.backOff('LASTFM', LASTFM_RATE_LIMIT_PAUSE_MS);
        logger.warn({}, 'Last.fm rate limit: pausing the poller for Last.fm');
        await store.markError(account, 'RATE_LIMITED', false);
        return { kind: 'skipped', retryAt: this.clock.now() + LASTFM_RATE_LIMIT_PAUSE_MS };
      case 'not_found':
        return fail('ACCOUNT_NOT_FOUND', true);
      case 'private':
        return fail('PRIVATE_PROFILE', true);
      case 'not_configured':
        return fail('NOT_CONFIGURED', false);
      case 'error':
        this.lastfmCircuit.recordFailure();
        logger.warn({ detail: result.detail }, 'Last.fm recent tracks failed');
        return fail('UPSTREAM_ERROR', false);
    }
  }

  // -- Helpers -------------------------------------------------------------------------------

  private toNowPlaying(obs: Observation, now: number): NowPlayingTrack {
    const { listened } = obs;
    const cover = listened.coverUrl && /^https?:\/\//.test(listened.coverUrl);
    return {
      ...(listened.spotifyId ? { trackId: listened.spotifyId } : {}),
      ...(listened.isrc ? { isrc: listened.isrc } : {}),
      title: listened.title,
      artistName: listened.artist,
      ...(listened.album ? { albumTitle: listened.album } : {}),
      ...(cover && listened.coverUrl ? { coverUrl: listened.coverUrl } : {}),
      dominantColor: DEFAULT_COLOR,
      durationMs: listened.durationMs,
      progressMs: obs.progressMs ?? 0,
      provider: obs.provider,
      isPlaying: obs.isPlaying,
      updatedAt: now,
    };
  }

  private async loadState(userId: string): Promise<PollState | null> {
    const raw = await this.deps.redis.get(`${STATE_PREFIX}${userId}`);
    if (!raw) return null;
    try {
      const parsed = PollStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async saveState(userId: string, state: PollState): Promise<void> {
    await this.deps.redis.set(
      `${STATE_PREFIX}${userId}`,
      JSON.stringify(state),
      'EX',
      STATE_TTL_SECONDS
    );
  }
}
