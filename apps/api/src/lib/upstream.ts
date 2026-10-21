import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { z } from 'zod';

/** Upper bound for any call to a third-party API (Deezer, iTunes, Spotify, Last.fm). */
export const UPSTREAM_TIMEOUT_MS = 5_000;

/**
 * Abort signal for an upstream `fetch`: without it a slow provider holds the request (and a
 * socket) open indefinitely, and public endpoints like catalog search become an easy DoS lever.
 */
export function upstreamSignal(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}

/** `fetch` with the upstream timeout applied (unless the caller passes its own signal). */
export function upstreamFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? upstreamSignal() });
}

// ---------------------------------------------------------------------------
// Catalog upstream client: retries, rate limiting, circuit breaker, response cache
// ---------------------------------------------------------------------------

/** The subset of `fetch` the upstream client needs; tests inject a fixture-backed fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type UpstreamFailureKind =
  | 'HTTP' // non-2xx status after retries
  | 'NETWORK' // DNS / connection / proxy refusal / timeout
  | 'INVALID_RESPONSE' // body is not the documented shape
  | 'PROVIDER_ERROR' // 2xx with an error payload (Deezer does this)
  | 'CIRCUIT_OPEN' // too many recent failures: provider skipped for a while
  | 'QUEUE_FULL'; // too many requests already waiting for the rate limiter

/** Internal failure of an external catalog provider. Never sent to clients as-is. */
export class UpstreamRequestError extends Error {
  /** From a 429/503 `Retry-After` header: the next attempt waits at least this long. */
  retryAfterMs?: number;

  constructor(
    readonly provider: string,
    readonly kind: UpstreamFailureKind,
    message: string,
    readonly status?: number
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'UpstreamRequestError';
  }
}

/**
 * Token bucket shared by all requests to one provider, served in FIFO order: up to `burst`
 * requests go out at once, then one every `intervalMs` (MusicBrainz: burst 1 / 1.1 s; iTunes:
 * burst 3 / 3 s ≈ 20 per minute; Deezer: burst 10 / 100 ms ≈ 50 per 5 s).
 */
export class RateLimiter {
  private tail: Promise<void> = Promise.resolve();
  private tokens: number;
  private lastRefill: number;
  private waiting = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly clock: Clock = systemClock,
    private readonly maxQueue = Number.POSITIVE_INFINITY,
    private readonly burst = 1
  ) {
    this.tokens = burst;
    this.lastRefill = clock.now();
  }

  get pending(): number {
    return this.waiting;
  }

  /** Resolves when the caller may send its request. Rejects at once when the queue is full. */
  async acquire(): Promise<void> {
    if (this.waiting >= this.maxQueue) throw new Error('rate limiter queue full');
    this.waiting++;
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await previous;
      if (this.intervalMs <= 0) return;
      this.refill();
      if (this.tokens < 1) {
        await this.clock.sleep(Math.max(0, this.lastRefill + this.intervalMs - this.clock.now()));
        this.refill();
      }
      this.tokens = Math.max(0, this.tokens - 1);
    } finally {
      this.waiting--;
      release();
    }
  }

  private refill(): void {
    const now = this.clock.now();
    const earned = Math.floor((now - this.lastRefill) / this.intervalMs);
    if (earned <= 0) return;
    this.tokens = Math.min(this.burst, this.tokens + earned);
    this.lastRefill = this.tokens === this.burst ? now : this.lastRefill + earned * this.intervalMs;
  }
}

/** Key/value cache for upstream responses. Implementations must never throw. */
export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/** Redis-backed cache; silently disabled while Redis is not connected. */
export class RedisResponseCache implements ResponseCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    if (this.redis.status !== 'ready') return null;
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis.status !== 'ready') return;
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      // A cache write failure only costs a future upstream call.
    }
  }
}

/** In-process cache for scripts and tests. */
export class MemoryResponseCache implements ResponseCache {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly clock: Clock = systemClock) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.clock.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.clock.now() + ttlSeconds * 1000 });
  }
}

export interface UpstreamClientOptions {
  /** Short provider name, used in cache keys and logs (`deezer`, `musicbrainz`, ...). */
  provider: string;
  fetch?: FetchLike;
  clock?: Clock;
  cache?: ResponseCache;
  /** Spacing between requests once the burst is used up (0 = unlimited). */
  minIntervalMs?: number;
  /** Requests allowed back to back before the spacing applies. Default 1. */
  burst?: number;
  /** Requests allowed to wait for the rate limiter before new ones fail fast. */
  maxQueue?: number;
  /** Retries after the first attempt, on 429 / 5xx / network errors. */
  maxRetries?: number;
  /** First backoff delay; doubles at every retry (plus jitter), capped by `maxBackoffMs`. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  /** Default cache TTL for successful responses. */
  defaultTtlSeconds?: number;
  /** Headers sent with every request (e.g. MusicBrainz' mandatory User-Agent). */
  headers?: Record<string, string>;
  /** Consecutive failures that open the circuit, and for how long it stays open. */
  circuitThreshold?: number;
  circuitCooldownMs?: number;
  /**
   * Inspects a 2xx JSON body for provider-level errors (Deezer answers 200 with `{ error }`).
   * Return null when the body is fine.
   */
  detectError?: (
    body: unknown
  ) => { message: string; retryable: boolean; notFound?: boolean } | null;
}

export interface GetJsonOptions {
  ttlSeconds?: number;
  /** Cache the absence of a resource (404) for this many seconds. Default: 1 hour. */
  notFoundTtlSeconds?: number;
}

const NOT_FOUND_SENTINEL = '__openmusic_not_found__';

/**
 * HTTP client for one external catalog provider. Every request goes through: response cache →
 * circuit breaker → rate limiter → `fetch` with timeout → retry with exponential backoff on
 * 429/5xx/network errors (honouring `Retry-After`) → Zod validation of the documented shape.
 */
export class UpstreamClient {
  readonly provider: string;
  private readonly fetchImpl: FetchLike;
  private readonly clock: Clock;
  private readonly cache: ResponseCache | null;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly timeoutMs: number;
  private readonly defaultTtlSeconds: number;
  private readonly headers: Record<string, string>;
  private readonly circuitThreshold: number;
  private readonly circuitCooldownMs: number;
  private readonly detectError: UpstreamClientOptions['detectError'];
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(options: UpstreamClientOptions) {
    this.provider = options.provider;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.clock = options.clock ?? systemClock;
    this.cache = options.cache ?? null;
    this.limiter = new RateLimiter(
      options.minIntervalMs ?? 0,
      this.clock,
      options.maxQueue,
      options.burst ?? 1
    );
    this.maxRetries = options.maxRetries ?? 2;
    this.baseBackoffMs = options.baseBackoffMs ?? 300;
    this.maxBackoffMs = options.maxBackoffMs ?? 5_000;
    this.timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 60 * 60;
    this.headers = { Accept: 'application/json', ...options.headers };
    this.circuitThreshold = options.circuitThreshold ?? 3;
    this.circuitCooldownMs = options.circuitCooldownMs ?? 30_000;
    this.detectError = options.detectError;
  }

  /**
   * GET a JSON resource and validate it. Returns null when the provider says the resource does
   * not exist (HTTP 404 or a provider "not found" payload).
   */
  async getJson<S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    options: GetJsonOptions = {}
  ): Promise<z.output<S> | null> {
    const cacheKey = `upstream:${this.provider}:${createHash('sha1').update(url).digest('hex')}`;
    const cached = this.cache ? await this.cache.get(cacheKey) : null;
    if (cached === NOT_FOUND_SENTINEL) return null;
    if (cached !== null) {
      const parsed = this.parseBody(cached, schema);
      if (parsed !== undefined) return parsed;
    }

    const result = await this.request(url, 'json');
    if (result === null) {
      await this.cache?.set(cacheKey, NOT_FOUND_SENTINEL, options.notFoundTtlSeconds ?? 60 * 60);
      return null;
    }
    const text = result.toString('utf8');
    const parsed = this.parseBody(text, schema);
    if (parsed === undefined) {
      throw new UpstreamRequestError(
        this.provider,
        'INVALID_RESPONSE',
        `unexpected response shape from ${redactUrl(url)}`
      );
    }
    await this.cache?.set(cacheKey, text, options.ttlSeconds ?? this.defaultTtlSeconds);
    return parsed;
  }

  /** GET raw bytes (cover images for the dominant color). Not cached. */
  async getBytes(url: string, maxBytes: number): Promise<Buffer | null> {
    const body = await this.request(url, 'bytes');
    if (body && body.length > maxBytes) {
      throw new UpstreamRequestError(this.provider, 'INVALID_RESPONSE', 'image too large');
    }
    return body;
  }

  private parseBody<S extends z.ZodTypeAny>(text: string, schema: S): z.output<S> | undefined {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return undefined;
    }
    const result = schema.safeParse(json);
    return result.success ? (result.data as z.output<S>) : undefined;
  }

  private async request(url: string, mode: 'json' | 'bytes'): Promise<Buffer | null> {
    if (this.clock.now() < this.circuitOpenUntil) {
      throw new UpstreamRequestError(this.provider, 'CIRCUIT_OPEN', 'temporarily disabled');
    }

    let lastError: UpstreamRequestError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await this.clock.sleep(this.backoff(attempt, lastError));
      try {
        await this.limiter.acquire();
      } catch {
        throw new UpstreamRequestError(this.provider, 'QUEUE_FULL', 'too many pending requests');
      }

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: this.headers,
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'follow',
        });
      } catch (err) {
        lastError = new UpstreamRequestError(this.provider, 'NETWORK', describeNetworkError(err));
        // DNS failures, refused connections and timeouts rarely heal in milliseconds: one retry.
        if (attempt >= 1) break;
        continue;
      }

      if (response.status === 404) {
        this.recordSuccess();
        return null;
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new UpstreamRequestError(
          this.provider,
          'HTTP',
          `HTTP ${response.status}`,
          response.status
        );
        lastError.retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
        continue;
      }
      if (!response.ok) {
        this.recordFailure();
        throw new UpstreamRequestError(
          this.provider,
          'HTTP',
          `HTTP ${response.status}`,
          response.status
        );
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (mode === 'json' && this.detectError) {
        let json: unknown = null;
        try {
          json = JSON.parse(body.toString('utf8'));
        } catch {
          // Shape validation reports it.
        }
        const providerError = this.detectError(json);
        if (providerError?.notFound) {
          this.recordSuccess();
          return null;
        }
        if (providerError) {
          lastError = new UpstreamRequestError(
            this.provider,
            'PROVIDER_ERROR',
            providerError.message
          );
          if (providerError.retryable) continue;
          this.recordFailure();
          throw lastError;
        }
      }
      this.recordSuccess();
      return body;
    }

    this.recordFailure();
    throw lastError ?? new UpstreamRequestError(this.provider, 'NETWORK', 'request failed');
  }

  private backoff(attempt: number, lastError: UpstreamRequestError | null): number {
    const exponential = this.baseBackoffMs * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * this.baseBackoffMs * 0.25);
    const retryAfter = lastError?.retryAfterMs ?? 0;
    return Math.min(Math.max(exponential + jitter, retryAfter), this.maxBackoffMs);
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.circuitThreshold) {
      this.circuitOpenUntil = this.clock.now() + this.circuitCooldownMs;
      this.consecutiveFailures = 0;
    }
  }
}

/** `fetch failed` hides the reason in `cause` (DNS, refused, proxy, timeout): surface it. */
function describeNetworkError(err: unknown): string {
  if (!(err instanceof Error)) return 'network error';
  const cause = err.cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: unknown }).code;
    return `${err.message}: ${typeof code === 'string' ? `${code} ` : ''}${cause.message}`;
  }
  return err.message;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Drops query strings from URLs before they reach logs or error messages. */
function redactUrl(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}
