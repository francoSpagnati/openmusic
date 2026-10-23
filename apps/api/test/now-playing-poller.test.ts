import { prisma } from '@openmusic/db';
import {
  FriendPresenceSchema,
  NowPlayingSyncStatusSchema,
  type NowPlayingTrack,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../src/app';
import type { FetchLike } from '../src/lib/upstream';
import {
  NowPlayingPoller,
  choosePlayback,
  type Observation,
} from '../src/modules/now-playing/now-playing.poller';
import { PollScheduler } from '../src/modules/now-playing/poll-scheduler';
import { bearer, createRelease, createUser } from './helpers/factories';
import { createFakeClock, createFixtureFetch, type FixtureRoute } from './helpers/fixture-fetch';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

const ACTIVE_MS = 25_000;
const IDLE_MS = 180_000;
const INACTIVE_DAYS = 14;

const SPOTIFY_NOW = /api\.spotify\.com\/v1\/me\/player\/currently-playing/;
const SPOTIFY_TOKEN = /accounts\.spotify\.com\/api\/token/;
const LASTFM_RECENT = /ws\.audioscrobbler\.com\/2\.0\/\?method=user\.getrecenttracks/;

function spotifyTrack(
  id: string,
  options: { isPlaying?: boolean; progressMs?: number; isrc?: string; title?: string } = {}
): string {
  return JSON.stringify({
    is_playing: options.isPlaying ?? true,
    progress_ms: options.progressMs ?? 45_000,
    timestamp: 1_700_000_000_000,
    currently_playing_type: 'track',
    item: {
      id,
      name: options.title ?? `Song ${id}`,
      duration_ms: 240_000,
      uri: `spotify:track:${id}`,
      popularity: 50,
      external_urls: { spotify: `https://open.spotify.com/track/${id}` },
      external_ids: { isrc: options.isrc ?? `GBAAA00000${id.slice(-2)}` },
      artists: [{ name: 'Radiohead' }],
      album: { name: 'In Rainbows', images: [{ url: 'https://i.scdn.co/image/cover' }] },
    },
  });
}

function lastfmRecent(nowPlaying?: { title: string; artist: string }): string {
  const scrobbled = {
    name: 'Older Song',
    mbid: '',
    artist: { name: 'Someone', url: 'https://www.last.fm/music/Someone' },
    album: { '#text': 'Old Album' },
    image: [],
    date: { uts: '1700000000', '#text': '14 Nov 2023, 22:13' },
  };
  const playing = nowPlaying && {
    name: nowPlaying.title,
    mbid: '',
    artist: { name: nowPlaying.artist, url: 'https://www.last.fm/music/x' },
    album: { '#text': 'Live Album' },
    image: [
      { size: 'small', '#text': 'https://lastfm.freetls.fastly.net/i/u/34s/abc.png' },
      { size: 'extralarge', '#text': 'https://lastfm.freetls.fastly.net/i/u/300x300/abc.png' },
    ],
    '@attr': { nowplaying: 'true' },
  };
  return JSON.stringify({
    recenttracks: {
      track: playing ? [playing, scrobbled] : [scrobbled],
      '@attr': { user: 'lfm_user', page: '1', perPage: '1', totalPages: '10', total: '10' },
    },
  });
}

function observation(provider: 'SPOTIFY' | 'LASTFM', isPlaying: boolean, key: string): Observation {
  return {
    provider,
    isPlaying,
    key,
    progressMs: provider === 'SPOTIFY' ? 1_000 : null,
    listened: {
      provider,
      title: key,
      artist: 'Radiohead',
      album: null,
      coverUrl: null,
      isrc: null,
      spotifyId: null,
      durationMs: 0,
    },
  };
}

describe('choosePlayback (ADR-013 precedence)', () => {
  const spotifyPlaying = observation('SPOTIFY', true, 'spotify:a');
  const spotifyPaused = observation('SPOTIFY', false, 'spotify:a');
  const lastfmPlaying = observation('LASTFM', true, 'lastfm:b');

  it('Spotify playing wins over a Last.fm now-playing track', () => {
    expect(choosePlayback(spotifyPlaying, lastfmPlaying)).toBe(spotifyPlaying);
  });
  it('Last.fm now playing wins over a paused Spotify', () => {
    expect(choosePlayback(spotifyPaused, lastfmPlaying)).toBe(lastfmPlaying);
  });
  it('a paused Spotify is shown when Last.fm has nothing', () => {
    expect(choosePlayback(spotifyPaused, null)).toBe(spotifyPaused);
  });
  it('nothing when neither reports anything', () => {
    expect(choosePlayback(null, null)).toBeNull();
    expect(choosePlayback(null, lastfmPlaying)).toBe(lastfmPlaying);
  });
});

describe('Now-playing poller (ADR-013)', () => {
  let ctx: AppContext;
  let poller: NowPlayingPoller;
  const clock = createFakeClock(Date.now());
  const fixtures = createFixtureFetch();
  /** Swappable so a test can slow a call down (lease test). */
  let fetchImpl: FetchLike = fixtures.fetch;

  beforeAll(async () => {
    ctx = await createTestApp({
      providerFetch: (input, init) => fetchImpl(input, init),
      lastFmApiKey: 'test-lastfm-key',
      nowPlayingClock: clock,
      nowPlayingPollerEnabled: true,
      // No 2 s coalescing between two polls of the same test (real time is not faked).
      nowPlayingIntervalMs: 0,
      nowPlayingPoller: {
        activeIntervalMs: ACTIVE_MS,
        idleIntervalMs: IDLE_MS,
        inactiveAfterMs: INACTIVE_DAYS * 24 * 60 * 60 * 1000,
        concurrency: 4,
        jitter: 0,
        random: () => 0,
        spotifyRate: { intervalMs: 0, burst: 1 },
        lastfmRate: { intervalMs: 0, burst: 1 },
      },
    });
    poller = ctx.nowPlayingPoller;
  });

  beforeEach(async () => {
    await ctx.pollerBackground.idle();
    await resetTestState(ctx);
    // Lets circuit breakers opened by a previous test close again.
    await clock.sleep(10 * 60_000);
    fixtures.calls.splice(0);
    fixtures.routes.splice(0);
    fetchImpl = fixtures.fetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  function route(match: RegExp, ...responses: FixtureRoute['responses']): void {
    fixtures.routes.push({ match, responses });
  }

  async function linkSpotify(
    userId: string,
    options: { expired?: boolean; refreshToken?: string | null } = {}
  ) {
    return prisma.connectedAccount.create({
      data: {
        userId,
        provider: 'SPOTIFY',
        providerId: `spotify-${userId.slice(0, 8)}`,
        accessToken: 'access-old',
        refreshToken: options.refreshToken === undefined ? 'refresh-1' : options.refreshToken,
        // Token expiry is checked against the real clock.
        expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 3_600_000)),
      },
    });
  }

  async function linkLastFm(userId: string) {
    return prisma.connectedAccount.create({
      data: { userId, provider: 'LASTFM', providerId: 'lfm_user', accessToken: 'session-key' },
    });
  }

  /** Makes the user due now and runs one full loop iteration (reads + background scrobbles). */
  async function poll(userId: string): Promise<void> {
    await ctx.pollScheduler.schedule(userId, clock.now());
    await poller.runOnce();
    await ctx.pollerBackground.idle();
  }

  async function presenceOf(userId: string) {
    const raw = await ctx.redis.get(`presence:user:${userId}`);
    return raw ? FriendPresenceSchema.parse(JSON.parse(raw)) : null;
  }

  function spyPresence() {
    return vi.spyOn(ctx.nowPlayingService, 'updateUserNowPlaying');
  }

  it('publishes presence and records a verified listen when the track changes', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });
    const spy = spyPresence();

    await poll(user.id);

    expect(spy).toHaveBeenCalledTimes(1);
    const presence = await presenceOf(user.id);
    expect(presence?.currentlyPlaying).toMatchObject({
      title: 'Song track01',
      artistName: 'Radiohead',
      provider: 'SPOTIFY',
      isPlaying: true,
      trackId: 'track01',
    });
    expect(await prisma.scrobbleLog.count({ where: { userId: user.id } })).toBe(1);
    const account = await prisma.connectedAccount.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.syncStatus).toBe('ACTIVE');
    expect(account.lastSyncedAt).not.toBeNull();
    expect(account.syncError).toBeNull();
    // Played just now: next read on the fast interval.
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + ACTIVE_MS);
  });

  it('does not re-publish or re-scrobble the same track, and publishes the next one', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(
      SPOTIFY_NOW,
      { body: spotifyTrack('track01', { progressMs: 45_000 }) },
      { body: spotifyTrack('track01', { progressMs: 70_000 }) },
      { body: spotifyTrack('track02', { progressMs: 5_000 }) }
    );
    const spy = spyPresence();

    await poll(user.id);
    await clock.sleep(ACTIVE_MS);
    await poll(user.id);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await prisma.scrobbleLog.count({ where: { userId: user.id } })).toBe(1);

    await clock.sleep(ACTIVE_MS);
    await poll(user.id);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await presenceOf(user.id))?.currentlyPlaying?.title).toBe('Song track02');
    // 5 s into the new track: not a listen yet.
    expect(await prisma.scrobbleLog.count({ where: { userId: user.id } })).toBe(1);
  });

  it('publishes a play/pause change of the same track', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(
      SPOTIFY_NOW,
      { body: spotifyTrack('track01') },
      { body: spotifyTrack('track01', { isPlaying: false }) }
    );
    const spy = spyPresence();
    await poll(user.id);
    await poll(user.id);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await presenceOf(user.id))?.currentlyPlaying?.isPlaying).toBe(false);
  });

  it('treats Spotify 204 and Last.fm without @attr.nowplaying as nothing playing', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    await linkLastFm(user.id);
    route(SPOTIFY_NOW, { status: 204 });
    route(LASTFM_RECENT, { body: lastfmRecent() });
    const spy = spyPresence();

    await poll(user.id);

    expect(spy).not.toHaveBeenCalled();
    expect(await presenceOf(user.id)).toBeNull();
    expect(await prisma.scrobbleLog.count()).toBe(0);
    expect(fixtures.callsTo(LASTFM_RECENT)).toHaveLength(1);
    // Nothing played, nobody online: slow interval.
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + IDLE_MS);
  });

  it('clears the visible track when playback stops', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') }, { status: 204 });
    await poll(user.id);
    expect((await presenceOf(user.id))?.currentlyPlaying).not.toBeNull();
    await poll(user.id);
    const presence = await presenceOf(user.id);
    expect(presence).not.toBeNull();
    expect(presence?.currentlyPlaying).toBeNull();
  });

  it('refreshes an expired Spotify token silently, then reads', async () => {
    const user = await createUser();
    await linkSpotify(user.id, { expired: true });
    route(SPOTIFY_TOKEN, {
      body: JSON.stringify({ access_token: 'access-new', expires_in: 3600 }),
    });
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });

    await poll(user.id);

    expect(fixtures.callsTo(SPOTIFY_TOKEN)).toHaveLength(1);
    const read = fixtures.callsTo(SPOTIFY_NOW);
    expect(read).toHaveLength(1);
    expect(read[0]?.headers.authorization).toBe('Bearer access-new');
    const account = await prisma.connectedAccount.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.accessToken).toBe('access-new');
    expect(account.syncStatus).toBe('ACTIVE');
    expect((await presenceOf(user.id))?.currentlyPlaying?.title).toBe('Song track01');
  });

  it('on 401 refreshes once and retries once', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_TOKEN, {
      body: JSON.stringify({ access_token: 'access-new', expires_in: 3600 }),
    });
    route(SPOTIFY_NOW, { status: 401, body: '{}' }, { body: spotifyTrack('track01') });

    await poll(user.id);

    expect(fixtures.callsTo(SPOTIFY_TOKEN)).toHaveLength(1);
    expect(fixtures.callsTo(SPOTIFY_NOW).map((c) => c.headers.authorization)).toEqual([
      'Bearer access-old',
      'Bearer access-new',
    ]);
    expect((await presenceOf(user.id))?.currentlyPlaying?.title).toBe('Song track01');
  });

  it('marks a revoked Spotify account as ERROR and stops polling it', async () => {
    const { id: userId } = await createUser();
    await linkSpotify(userId, { expired: true });
    route(SPOTIFY_TOKEN, {
      status: 400,
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token revoked' }),
    });

    await poll(userId);

    const account = await prisma.connectedAccount.findFirstOrThrow({ where: { userId } });
    expect(account.syncStatus).toBe('ERROR');
    expect(account.syncError).toBe('TOKEN_REVOKED');
    expect(fixtures.callsTo(SPOTIFY_NOW)).toHaveLength(0);
    expect(await ctx.pollScheduler.nextDueAt(userId)).toBeNull();

    // Even if something schedules it again (sweep, stale entry), it is not read.
    await poll(userId);
    expect(fixtures.callsTo(SPOTIFY_TOKEN)).toHaveLength(1);
    await poller.sweep();
    expect(await ctx.pollScheduler.nextDueAt(userId)).toBeNull();

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/now-playing/sync-status',
      headers: bearer(ctx, userId),
    });
    expect(res.statusCode).toBe(200);
    const status = NowPlayingSyncStatusSchema.parse(res.json());
    expect(status.providers.SPOTIFY).toMatchObject({
      linked: true,
      status: 'ERROR',
      lastErrorCode: 'TOKEN_REVOKED',
      nextPollInSeconds: null,
    });
    expect(status.providers.SPOTIFY.lastError).toMatch(/ricollega/);
  });

  it('honours Spotify 429 Retry-After for every user (provider-wide)', async () => {
    const a = await createUser();
    const b = await createUser();
    await linkSpotify(a.id);
    await linkSpotify(b.id);
    route(SPOTIFY_NOW, { status: 429, headers: { 'retry-after': '120' }, body: '' });

    await poll(a.id);

    const pausedUntil = await ctx.pollScheduler.backedOffUntil('SPOTIFY');
    expect(pausedUntil).toBe(clock.now() + 120_000);
    expect(await ctx.pollScheduler.nextDueAt(a.id)).toBeGreaterThanOrEqual(clock.now() + 120_000);
    const account = await prisma.connectedAccount.findFirstOrThrow({ where: { userId: a.id } });
    expect(account).toMatchObject({ syncStatus: 'ACTIVE', syncError: 'RATE_LIMITED' });

    // Another user inside the window: no request at all.
    await poll(b.id);
    expect(fixtures.callsTo(SPOTIFY_NOW)).toHaveLength(1);
    expect(await ctx.pollScheduler.nextDueAt(b.id)).toBeGreaterThanOrEqual(pausedUntil);

    // After the window Spotify is called again.
    await clock.sleep(121_000);
    route(SPOTIFY_NOW, { status: 204 });
    await poll(b.id);
    expect(fixtures.callsTo(SPOTIFY_NOW)).toHaveLength(2);
  });

  it('Ghost Mode: no presence is written or broadcast, the verified listen is still recorded', async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { isGhostMode: true } });
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });
    const spy = spyPresence();

    await poll(user.id);

    expect(spy).not.toHaveBeenCalled();
    expect(await presenceOf(user.id)).toBeNull();
    expect(await prisma.scrobbleLog.count({ where: { userId: user.id } })).toBe(1);
  });

  it('Spotify wins when both providers play; Last.fm is used when Spotify is idle', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    await linkLastFm(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') }, { status: 204 });
    route(LASTFM_RECENT, { body: lastfmRecent({ title: 'Reckoner', artist: 'Radiohead' }) });

    await poll(user.id);
    expect((await presenceOf(user.id))?.currentlyPlaying).toMatchObject({
      provider: 'SPOTIFY',
      title: 'Song track01',
    });
    // Spotify playing: Last.fm is not even asked.
    expect(fixtures.callsTo(LASTFM_RECENT)).toHaveLength(0);

    await poll(user.id);
    const current = (await presenceOf(user.id))?.currentlyPlaying;
    expect(current).toMatchObject({
      provider: 'LASTFM',
      title: 'Reckoner',
      artistName: 'Radiohead',
      durationMs: 0,
      coverUrl: 'https://lastfm.freetls.fastly.net/i/u/300x300/abc.png',
    } satisfies Partial<NowPlayingTrack>);
    const call = fixtures.callsTo(LASTFM_RECENT)[0];
    expect(call?.url).toContain('user=lfm_user');
    expect(call?.url).toContain('limit=1');
    expect(call?.url).toContain('extended=1');
    expect(call?.url).toContain('api_key=test-lastfm-key');
  });

  it('Last.fm: a now-playing track counts as a listen after 30 s of observation', async () => {
    const user = await createUser();
    await linkLastFm(user.id);
    route(LASTFM_RECENT, { body: lastfmRecent({ title: 'Reckoner', artist: 'Radiohead' }) });
    await poll(user.id);
    expect(await prisma.scrobbleLog.count()).toBe(0);
    await clock.sleep(31_000);
    await poll(user.id);
    const logs = await prisma.scrobbleLog.findMany({ include: { track: true } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ provider: 'LASTFM', track: { title: 'Reckoner' } });
  });

  it('Last.fm private profile stops polling with PRIVATE_PROFILE', async () => {
    const user = await createUser();
    await linkLastFm(user.id);
    route(LASTFM_RECENT, {
      status: 403,
      body: JSON.stringify({ error: 17, message: 'Login: User required to be logged in' }),
    });
    await poll(user.id);
    const account = await prisma.connectedAccount.findFirstOrThrow({ where: { userId: user.id } });
    expect(account).toMatchObject({ syncStatus: 'ERROR', syncError: 'PRIVATE_PROFILE' });
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBeNull();
  });

  it('records the listen on the catalog track with the same ISRC', async () => {
    const user = await createUser();
    const release = await createRelease('In Rainbows');
    const track = await prisma.track.create({
      data: {
        title: '15 Step',
        artistName: 'Radiohead',
        durationMs: 237_000,
        isrc: 'GBSTK0700001',
        releaseId: release.id,
      },
    });
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track15', { isrc: 'GBSTK0700001' }) });
    await poll(user.id);
    const logs = await prisma.scrobbleLog.findMany({ where: { userId: user.id } });
    expect(logs).toEqual([
      expect.objectContaining({ trackId: track.id, releaseId: release.id, provider: 'SPOTIFY' }),
    ]);
    expect(await prisma.track.count()).toBe(1);
  });

  it('two instances never read the same user at once (Redis lease)', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      entered = resolve;
    });
    fetchImpl = async (input, init) => {
      if (SPOTIFY_NOW.test(input)) {
        entered();
        await gate;
      }
      return fixtures.fetch(input, init);
    };
    const other = new NowPlayingPoller(
      {
        ...ctx.nowPlayingPollerDeps,
        scheduler: new PollScheduler(ctx.redis, { clock, instanceId: 'instance-b' }),
      },
      ctx.nowPlayingPollerOptions
    );

    await ctx.pollScheduler.schedule(user.id, clock.now());
    const first = poller.runOnce();
    await reading;
    // Instance B sees the user as due but cannot take the lease.
    await other.runOnce();
    release();
    await first;
    await ctx.pollerBackground.idle();
    // A late instance after the first one finished finds the user no longer due.
    await other.runOnce();

    expect(fixtures.callsTo(SPOTIFY_NOW)).toHaveLength(1);
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + ACTIVE_MS);
  });

  it('a paused Spotify gives way to Last.fm, and is shown when Last.fm has nothing', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    await linkLastFm(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01', { isPlaying: false }) });
    route(
      LASTFM_RECENT,
      { body: lastfmRecent({ title: 'Reckoner', artist: 'Radiohead' }) },
      { body: lastfmRecent() }
    );

    await poll(user.id);
    expect((await presenceOf(user.id))?.currentlyPlaying).toMatchObject({
      provider: 'LASTFM',
      title: 'Reckoner',
      isPlaying: true,
    });

    await poll(user.id);
    expect((await presenceOf(user.id))?.currentlyPlaying).toMatchObject({
      provider: 'SPOTIFY',
      title: 'Song track01',
      isPlaying: false,
    });
    expect(fixtures.callsTo(LASTFM_RECENT)).toHaveLength(2);
  });

  it('a transient error never overwrites a revocation recorded meanwhile', async () => {
    const user = await createUser();
    const account = await linkSpotify(user.id);
    route(SPOTIFY_NOW, { status: 500, body: '' });
    // The manual sync finds the refresh token revoked while this poll is reading.
    fetchImpl = async (input, init) => {
      if (SPOTIFY_NOW.test(input)) {
        await prisma.connectedAccount.update({
          where: { id: account.id },
          data: { syncStatus: 'ERROR', syncError: 'TOKEN_REVOKED' },
        });
      }
      return fixtures.fetch(input, init);
    };

    await poll(user.id);

    const row = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(row).toMatchObject({ syncStatus: 'ERROR', syncError: 'TOKEN_REVOKED' });
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBeNull();
  });

  it('poller and manual sync refreshing at once: one refresh, the account stays ACTIVE', async () => {
    const user = await createUser();
    await linkSpotify(user.id, { expired: true });
    // Spotify rotates the refresh token: a second refresh with the old one is invalid_grant.
    route(
      SPOTIFY_TOKEN,
      {
        body: JSON.stringify({
          access_token: 'access-new',
          refresh_token: 'refresh-2',
          expires_in: 3600,
        }),
      },
      { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
    );
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });
    fetchImpl = async (input, init) => {
      // A slow token endpoint keeps both callers inside the refresh window.
      if (SPOTIFY_TOKEN.test(input)) await new Promise((resolve) => setTimeout(resolve, 150));
      return fixtures.fetch(input, init);
    };

    const [manual] = await Promise.all([
      ctx.app.inject({
        method: 'POST',
        url: '/api/spotify/sync-playback',
        headers: bearer(ctx, user.id),
      }),
      poll(user.id),
    ]);

    expect(manual.statusCode).toBe(200);
    expect(fixtures.callsTo(SPOTIFY_TOKEN)).toHaveLength(1);
    expect(
      fixtures.callsTo(SPOTIFY_NOW).every((c) => c.headers.authorization === 'Bearer access-new')
    ).toBe(true);
    const row = await prisma.connectedAccount.findFirstOrThrow({ where: { userId: user.id } });
    expect(row).toMatchObject({
      syncStatus: 'ACTIVE',
      accessToken: 'access-new',
      refreshToken: 'refresh-2',
    });
  });

  it('a 401 on a token another request already replaced does not refresh again', async () => {
    const user = await createUser();
    const account = await linkSpotify(user.id);
    route(SPOTIFY_TOKEN, { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) });
    route(SPOTIFY_NOW, { status: 401, body: '{}' }, { body: spotifyTrack('track01') });
    fetchImpl = async (input, init) => {
      const response = await fixtures.fetch(input, init);
      // Someone refreshed (and rotated) the tokens while our first read was in flight.
      if (SPOTIFY_NOW.test(input) && response.status === 401) {
        await prisma.connectedAccount.update({
          where: { id: account.id },
          data: { accessToken: 'access-other', refreshToken: 'refresh-other' },
        });
      }
      return response;
    };

    await poll(user.id);

    expect(fixtures.callsTo(SPOTIFY_TOKEN)).toHaveLength(0);
    expect(fixtures.callsTo(SPOTIFY_NOW).map((c) => c.headers.authorization)).toEqual([
      'Bearer access-old',
      'Bearer access-other',
    ]);
    const row = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(row.syncStatus).toBe('ACTIVE');
  });

  it('a read that outlives its lease is dropped instead of overwriting the newer one', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(
      SPOTIFY_NOW,
      { body: spotifyTrack('track01') }, // stale answer of the slow instance
      { body: spotifyTrack('track02') }
    );
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let first = true;
    fetchImpl = async (input, init) => {
      const response = await fixtures.fetch(input, init);
      if (SPOTIFY_NOW.test(input) && first) {
        first = false;
        entered();
        await gate;
      }
      return response;
    };
    const slow = new NowPlayingPoller(
      {
        ...ctx.nowPlayingPollerDeps,
        scheduler: new PollScheduler(ctx.redis, { clock, instanceId: 'slow' }),
      },
      { ...ctx.nowPlayingPollerOptions, leaseMs: 100 }
    );
    const spy = spyPresence();

    await ctx.pollScheduler.schedule(user.id, clock.now());
    const slowRun = slow.runOnce();
    await reading;
    await new Promise((resolve) => setTimeout(resolve, 200)); // the 100 ms lease expires
    await poller.runOnce(); // another instance takes the user over and publishes track02
    release();
    await slowRun;
    await ctx.pollerBackground.idle();

    expect(spy).toHaveBeenCalledTimes(1);
    expect((await presenceOf(user.id))?.currentlyPlaying?.title).toBe('Song track02');
  });

  it('uses the fast interval when a follower is online, the slow one otherwise', async () => {
    const user = await createUser();
    const follower = await createUser();
    await prisma.follows.create({ data: { followerId: follower.id, followingId: user.id } });
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { status: 204 });

    await poll(user.id);
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + IDLE_MS);

    await ctx.listeningActivity.socketConnected(follower.id);
    await poll(user.id);
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + ACTIVE_MS);

    await ctx.listeningActivity.socketsClosed(follower.id);
    await poll(user.id);
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + IDLE_MS);
  });

  it('stops polling users not seen for N days and resumes them when they come back', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    await linkLastFm(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(clock.now() - (INACTIVE_DAYS + 1) * 86_400_000) },
    });
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });

    await poll(user.id);
    expect(fixtures.callsTo(SPOTIFY_NOW)).toHaveLength(0);
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBeNull();
    const accounts = await prisma.connectedAccount.findMany({ where: { userId: user.id } });
    expect(accounts.map((a) => a.syncStatus)).toEqual(['PAUSED', 'PAUSED']);
    // The sweep does not bring them back either.
    await poller.sweep();
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBeNull();

    // Opening the app (GET /api/auth/me) resumes and schedules an immediate read.
    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: bearer(ctx, user.id),
    });
    expect(me.statusCode).toBe(200);
    await vi.waitFor(async () => {
      expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now());
    });
    const resumed = await prisma.connectedAccount.findMany({ where: { userId: user.id } });
    expect(resumed.map((a) => a.syncStatus)).toEqual(['ACTIVE', 'ACTIVE']);
  });

  it('the sweep schedules every user with an active linked account, once', async () => {
    const a = await createUser();
    const b = await createUser();
    await createUser(); // nothing linked
    await linkSpotify(a.id);
    await linkLastFm(b.id);
    await poller.sweep();
    expect(await ctx.pollScheduler.scheduledCount()).toBe(2);
    expect(await ctx.pollScheduler.nextDueAt(a.id)).toBe(clock.now());
  });

  it('GET /api/now-playing/sync-status reports linked providers and the next read', async () => {
    const unauth = await ctx.app.inject({ method: 'GET', url: '/api/now-playing/sync-status' });
    expect(unauth.statusCode).toBe(401);

    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { status: 204 });
    await poll(user.id);
    await clock.sleep(30_000);

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/now-playing/sync-status',
      headers: bearer(ctx, user.id),
    });
    const status = NowPlayingSyncStatusSchema.parse(res.json());
    expect(status.autoSyncEnabled).toBe(true);
    expect(status.providers.LASTFM).toMatchObject({ linked: false, status: null });
    expect(status.providers.SPOTIFY).toMatchObject({
      linked: true,
      status: 'ACTIVE',
      lastErrorCode: null,
      lastError: null,
      nextPollInSeconds: IDLE_MS / 1000 - 30,
    });
    expect(status.providers.SPOTIFY.lastSyncedAt).not.toBeNull();
  });

  it('the manual sync (POST /api/spotify/sync-playback) still works as a fallback', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { body: spotifyTrack('track01') });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/spotify/sync-playback',
      headers: bearer(ctx, user.id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ isPlaying: true, loggedScrobble: true });
    expect((await presenceOf(user.id))?.currentlyPlaying?.title).toBe('Song track01');

    // Then the poller sees the same track: the 3-minute dedup prevents a second listen.
    await poll(user.id);
    await ctx.pollerBackground.idle();
    expect(await prisma.scrobbleLog.count({ where: { userId: user.id } })).toBe(1);
  });

  it('stop() waits for in-flight reads (graceful shutdown)', async () => {
    const user = await createUser();
    await linkSpotify(user.id);
    route(SPOTIFY_NOW, { status: 204 });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      entered = resolve;
    });
    fetchImpl = async (input, init) => {
      entered();
      await gate;
      return fixtures.fetch(input, init);
    };
    await ctx.pollScheduler.schedule(user.id, clock.now());
    const run = poller.runOnce();
    await reading;
    let stopped = false;
    const stopping = poller.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    release();
    await Promise.all([run, stopping]);
    expect(stopped).toBe(true);
    // The read finished and its next due time was written before the lease was released.
    expect(await ctx.pollScheduler.nextDueAt(user.id)).toBe(clock.now() + IDLE_MS);
    expect(await ctx.redis.exists(`np:poll:lease:${user.id}`)).toBe(0);
  });
});
