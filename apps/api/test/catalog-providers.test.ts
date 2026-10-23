import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dominantColorOf } from '../src/lib/dominant-color';
import {
  MemoryResponseCache,
  RateLimiter,
  UpstreamClient,
  UpstreamRequestError,
} from '../src/lib/upstream';
import { createCatalogProviders, musicBrainzUserAgent } from '../src/modules/catalog/providers';
import { upscaleItunesArtwork } from '../src/modules/catalog/providers/itunes.provider';
import { topGenres } from '../src/modules/catalog/providers/musicbrainz.provider';
import {
  createFakeClock,
  createFixtureFetch,
  imageFixture,
  inRainbowsRoutes,
  type FixtureRoute,
} from './helpers/fixture-fetch';

function providers(extraRoutes: FixtureRoute[] = []) {
  const fixtures = createFixtureFetch([...inRainbowsRoutes(), ...extraRoutes]);
  const clock = createFakeClock();
  const cache = new MemoryResponseCache(clock);
  const p = createCatalogProviders({
    fetch: fixtures.fetch,
    clock,
    cache,
    musicbrainzContact: 'https://github.com/francoSpagnati/openmusic',
  });
  return { p, fixtures, clock };
}

describe('UpstreamClient', () => {
  const Schema = z.object({ ok: z.boolean() });

  function client(
    routes: FixtureRoute[],
    overrides: Partial<ConstructorParameters<typeof UpstreamClient>[0]> = {}
  ) {
    const fixtures = createFixtureFetch(routes);
    const clock = createFakeClock();
    return {
      fixtures,
      clock,
      http: new UpstreamClient({ provider: 'test', fetch: fixtures.fetch, clock, ...overrides }),
    };
  }

  it('retries 429/5xx with exponential backoff and honours Retry-After', async () => {
    const { http, fixtures, clock } = client([
      {
        match: /example/,
        responses: [
          { status: 503 },
          { status: 429, headers: { 'retry-after': '2' } },
          { body: '{"ok":true}' },
        ],
      },
    ]);
    await expect(http.getJson('https://example.test/a', Schema)).resolves.toEqual({ ok: true });
    expect(fixtures.calls).toHaveLength(3);
    expect(clock.sleeps[0]).toBeGreaterThanOrEqual(300);
    expect(clock.sleeps[1]).toBeGreaterThanOrEqual(2_000); // Retry-After wins over 600ms
  });

  it('retries network failures only once', async () => {
    const { http, fixtures } = client([{ match: /dns/, responses: [{ networkError: true }] }], {
      maxRetries: 3,
    });
    await expect(http.getJson('https://example.test/dns', Schema)).rejects.toMatchObject({
      kind: 'NETWORK',
    });
    expect(fixtures.calls).toHaveLength(2);
  });

  it('does not retry client errors and maps 404 to null', async () => {
    const { http, fixtures } = client([
      { match: /bad/, responses: [{ status: 400 }] },
      { match: /missing/, responses: [{ status: 404 }] },
    ]);
    await expect(http.getJson('https://example.test/bad', Schema)).rejects.toMatchObject({
      kind: 'HTTP',
      status: 400,
    });
    expect(fixtures.calls).toHaveLength(1);
    await expect(http.getJson('https://example.test/missing', Schema)).resolves.toBeNull();
  });

  it('retries a provider-specific throttle status only where it is configured', async () => {
    const routes = (): FixtureRoute[] => [
      { match: /throttled/, responses: [{ status: 403 }, { body: '{"ok":true}' }] },
    ];
    const plain = client(routes());
    await expect(
      plain.http.getJson('https://example.test/throttled', Schema)
    ).rejects.toMatchObject({ kind: 'HTTP', status: 403 });
    expect(plain.fixtures.calls).toHaveLength(1);

    const throttled = client(routes(), { throttleStatuses: [403], baseBackoffMs: 1_000 });
    await expect(throttled.http.getJson('https://example.test/throttled', Schema)).resolves.toEqual(
      {
        ok: true,
      }
    );
    expect(throttled.fixtures.calls).toHaveLength(2);
    expect(throttled.clock.sleeps[0]).toBeGreaterThanOrEqual(1_000);
  });

  it('rejects bodies that do not match the documented shape', async () => {
    const { http } = client([{ match: /x/, responses: [{ body: '{"ok":"yes"}' }] }]);
    await expect(http.getJson('https://example.test/x', Schema)).rejects.toMatchObject({
      kind: 'INVALID_RESPONSE',
    });
  });

  it('serves repeated requests from the cache (including cached 404s)', async () => {
    const clock = createFakeClock();
    const fixtures = createFixtureFetch([
      { match: /hit/, responses: [{ body: '{"ok":true}' }] },
      { match: /gone/, responses: [{ status: 404 }] },
    ]);
    const http = new UpstreamClient({
      provider: 'test',
      fetch: fixtures.fetch,
      clock,
      cache: new MemoryResponseCache(clock),
    });
    await http.getJson('https://example.test/hit', Schema);
    await http.getJson('https://example.test/hit', Schema);
    await http.getJson('https://example.test/gone', Schema);
    await http.getJson('https://example.test/gone', Schema);
    expect(fixtures.calls).toHaveLength(2);
  });

  it('opens the circuit after repeated failures and skips the provider for a while', async () => {
    const { http, fixtures, clock } = client(
      [{ match: /down/, responses: [{ networkError: true }] }],
      {
        maxRetries: 0,
        circuitThreshold: 2,
        circuitCooldownMs: 30_000,
      }
    );
    for (let i = 0; i < 2; i++) {
      await expect(http.getJson('https://example.test/down', Schema)).rejects.toMatchObject({
        kind: 'NETWORK',
      });
    }
    await expect(http.getJson('https://example.test/down', Schema)).rejects.toMatchObject({
      kind: 'CIRCUIT_OPEN',
    });
    expect(fixtures.calls).toHaveLength(2);
    await clock.sleep(30_001);
    await expect(http.getJson('https://example.test/down', Schema)).rejects.toMatchObject({
      kind: 'NETWORK',
    });
  });
});

describe('RateLimiter', () => {
  it('spaces requests by the minimum interval', async () => {
    const clock = createFakeClock();
    const limiter = new RateLimiter(1_000, clock);
    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
    expect(clock.sleeps).toEqual([1_000, 1_000]);
  });

  it('allows a burst, then one request per interval (token bucket)', async () => {
    const clock = createFakeClock();
    const limiter = new RateLimiter(3_000, clock, Number.POSITIVE_INFINITY, 3);
    await Promise.all([1, 2, 3, 4, 5].map(() => limiter.acquire()));
    expect(clock.sleeps).toEqual([3_000, 3_000]);
    // Idle time refills the bucket up to the burst size, not beyond.
    await clock.sleep(60_000);
    clock.sleeps.splice(0);
    await Promise.all([1, 2, 3, 4].map(() => limiter.acquire()));
    expect(clock.sleeps).toEqual([3_000]);
  });

  it('fails fast when the queue is full', async () => {
    const clock = createFakeClock();
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowClock = { now: clock.now, sleep: () => blocked };
    const limiter = new RateLimiter(1_000, slowClock, 1);
    await limiter.acquire(); // takes the slot; the next one has to wait
    const waiting = limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow('queue full');
    release();
    await waiting;
  });
});

describe('DeezerProvider', () => {
  it('maps album search hits with 1000px covers and record types', async () => {
    const { p } = providers();
    const page = await p.deezer.searchAlbums('in rainbows', { limit: 10, offset: 0 });
    expect(page.total).toBe(3);
    expect(page.items[0]).toMatchObject({
      provider: 'DEEZER',
      externalId: '302127',
      title: 'In Rainbows',
      releaseType: 'ALBUM',
      trackCount: 10,
      artist: { externalId: '399', name: 'Radiohead' },
    });
    expect(page.items[0]?.coverUrl).toMatch(/\/1000x1000-000000-80-0-0\.jpg$/);
  });

  it('maps album detail: label, UPC, date, genres and the tracklist with ISRCs', async () => {
    const { p } = providers();
    const album = await p.deezer.getAlbum('302127');
    expect(album).toMatchObject({
      label: 'XL Recordings',
      upc: '0634904032463',
      releaseDate: '2007-12-28',
      genres: ['Alternative', 'Rock'],
      trackCount: 10,
    });
    expect(album?.tracks).toHaveLength(10);
    expect(album?.tracks?.[6]).toMatchObject({
      externalId: '3135559',
      title: 'Reckoner',
      isrc: 'GBSTK0700007',
      durationMs: 290_000,
      trackNumber: 7,
      discNumber: 1,
    });
    expect(album?.tracks?.[6]?.previewUrl).toMatch(/^https:\/\/cdnt-preview\.dzcdn\.net\//);
  });

  it('reads tracks by id and by ISRC', async () => {
    const { p } = providers();
    expect((await p.deezer.getTrack('3135559'))?.isrc).toBe('GBSTK0700007');
    expect((await p.deezer.getTrackByIsrc('GB-STK-07-00007'))?.externalId).toBe('3135559');
  });

  it('treats error 800 as not found and retries quota errors (code 4)', async () => {
    const { p, fixtures } = providers([
      {
        match: /api\.deezer\.com\/album\/42$/,
        responses: [{ file: 'deezer-error-quota.json' }, { file: 'deezer-album-302127.json' }],
      },
      {
        match: /api\.deezer\.com\/album\/42\/tracks/,
        responses: [{ file: 'deezer-album-302127-tracks.json' }],
      },
    ]);
    expect(await p.deezer.getAlbum('999')).toBeNull();
    const album = await p.deezer.getAlbum('42');
    expect(album?.title).toBe('In Rainbows');
    expect(fixtures.callsTo(/album\/42$/)).toHaveLength(2);
  });
});

describe('ItunesProvider', () => {
  it('upscales artwork to 1000x1000 and reads the release type from the name', async () => {
    const { p } = providers();
    const page = await p.itunes.searchAlbums('in rainbows', 5);
    expect(page.items.map((r) => [r.title, r.releaseType])).toEqual([
      ['In Rainbows', 'ALBUM'],
      ['Reckoner', 'SINGLE'],
    ]);
    expect(page.items[0]?.coverUrl).toMatch(/\/1000x1000bb\.jpg$/);
    expect(page.items[0]?.releaseDate).toBe('2007-10-10');
    expect(upscaleItunesArtwork('http://a1.mzstatic.com/x/source/100x100bb.jpg', 600)).toBe(
      'https://a1.mzstatic.com/x/source/600x600bb.jpg'
    );
  });

  it('looks up an album with its songs in disc/track order, and song previews', async () => {
    const { p } = providers();
    const album = await p.itunes.getAlbum('1109714933');
    expect(album?.tracks?.map((t) => [t.trackNumber, t.title])).toEqual([
      [1, '15 Step'],
      [7, 'Reckoner'],
    ]);
    const songs = await p.itunes.searchTracks('reckoner', 1);
    expect(songs.items[0]?.previewUrl).toMatch(/^https:\/\/audio-ssl\.itunes\.apple\.com\//);
  });

  it('treats HTTP 403 as throttling: backs off and retries (iTunes only)', async () => {
    const { p, fixtures, clock } = providers([
      {
        match: /itunes\.apple\.com\/search\?.*entity=album/,
        responses: [{ status: 403 }, { status: 403 }, { file: 'itunes-search-album.json' }],
      },
      { match: /api\.deezer\.com\/search\/album\?/, responses: [{ status: 403 }] },
    ]);
    const page = await p.itunes.searchAlbums('in rainbows', 5);
    expect(page.items[0]?.title).toBe('In Rainbows');
    expect(fixtures.callsTo(/itunes\.apple\.com\/search/)).toHaveLength(3);
    const backoffs = clock.sleeps.filter((ms) => ms >= 3_000);
    expect(backoffs).toHaveLength(2);
    expect(backoffs[1]).toBeGreaterThanOrEqual(6_000);

    // Other providers keep treating 403 as a permanent refusal.
    await expect(
      p.deezer.searchAlbums('in rainbows', { limit: 5, offset: 0 })
    ).rejects.toMatchObject({ kind: 'HTTP', status: 403 });
    expect(fixtures.callsTo(/api\.deezer\.com\/search/)).toHaveLength(1);
  });

  it('gives up after the retries when iTunes keeps answering 403', async () => {
    const { p, fixtures } = providers([
      { match: /itunes\.apple\.com\/lookup\?/, responses: [{ status: 403 }] },
    ]);
    await expect(p.itunes.getAlbum('1109714933')).rejects.toMatchObject({
      provider: 'itunes',
      kind: 'HTTP',
      status: 403,
    });
    expect(fixtures.callsTo(/itunes\.apple\.com\/lookup/)).toHaveLength(3);
  });

  it('waits iTunes throttling out much longer in batch scripts', async () => {
    const fixtures = createFixtureFetch([
      ...inRainbowsRoutes(),
      { match: /itunes\.apple\.com\/lookup\?/, responses: [{ status: 403 }] },
    ]);
    const clock = createFakeClock();
    const p = createCatalogProviders({
      fetch: fixtures.fetch,
      clock,
      musicbrainzContact: 'https://github.com/francoSpagnati/openmusic',
      batch: true,
    });
    await expect(p.itunes.getAlbum('1109714933')).rejects.toMatchObject({ status: 403 });
    expect(fixtures.callsTo(/itunes\.apple\.com\/lookup/)).toHaveLength(5);
    const backoffs = clock.sleeps.filter((ms) => ms >= 5_000);
    expect(backoffs).toHaveLength(4);
    expect(backoffs[3]).toBeGreaterThanOrEqual(40_000);
  });
});

describe('MusicBrainzProvider', () => {
  it('sends the mandatory User-Agent and keeps to one request per second', async () => {
    const { p, fixtures, clock } = providers();
    await p.musicbrainz.searchReleases({ barcode: '0634904032463' });
    await p.musicbrainz.searchReleases({ title: 'In Rainbows', artist: 'Radiohead' });
    await p.musicbrainz.getRelease('0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
    const calls = fixtures.callsTo(/musicbrainz\.org/);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.headers['user-agent']).toBe(
        musicBrainzUserAgent('https://github.com/francoSpagnati/openmusic')
      );
      expect(call.url).toContain('fmt=json');
    }
    expect(musicBrainzUserAgent('x@y.z')).toMatch(/^OpenMusic\/\d+\.\d+\.\d+ \( x@y\.z \)$/);
    // Two waits of >= 1.1 s between the three requests.
    expect(clock.sleeps.filter((ms) => ms >= 1_000)).toHaveLength(2);
  });

  it('maps a release lookup: MBIDs, label, barcode and recordings with ISRCs', async () => {
    const { p } = providers();
    const release = await p.musicbrainz.getRelease('0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
    expect(release).toMatchObject({
      provider: 'MUSICBRAINZ',
      title: 'In Rainbows',
      label: 'XL Recordings',
      upc: '634904032463',
      releaseDate: '2008-01-01',
      releaseType: 'ALBUM',
      musicbrainzReleaseGroupId: '6e335887-60ba-38f0-95af-fae7774336bf',
      hasFrontCover: true,
      coverUrl: null,
    });
    expect(release?.tracks?.[6]).toMatchObject({ title: 'Reckoner', isrc: 'GBSTK0700007' });
    expect(release?.tracks?.[6]?.musicbrainzId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await p.musicbrainz.getRelease('not-an-mbid')).toBeNull();
  });

  it('turns release-group genres into ranked, title-cased labels', async () => {
    const { p } = providers();
    expect(
      await p.musicbrainz.getReleaseGroupGenres('6e335887-60ba-38f0-95af-fae7774336bf')
    ).toEqual(['Art Rock', 'Alternative Rock', 'Electronic']);
    expect(
      topGenres(
        [],
        [
          { name: 'shoegaze', count: 3 },
          { name: 'seen live', count: 1 },
        ]
      )
    ).toEqual(['Shoegaze', 'Seen Live']);
  });

  it('escapes title searches as Lucene phrases', async () => {
    const { p, fixtures } = providers();
    await p.musicbrainz.searchReleases({ title: 'Say "Hi"', artist: 'AC/DC' });
    const url = new URL(fixtures.callsTo(/musicbrainz/)[0]?.url ?? '');
    expect(url.searchParams.get('query')).toBe('release:"Say \\"Hi\\"" AND artist:"AC/DC"');
  });
});

describe('CoverArtArchiveProvider', () => {
  it('picks the front image, prefers the 1200px thumbnail and upgrades to https', async () => {
    const { p } = providers();
    const cover = await p.coverArt.getFrontCover('0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
    expect(cover?.url).toBe(
      'https://coverartarchive.org/release/0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01/2222-1200.jpg'
    );
    expect(cover?.thumbnailUrl).toMatch(/2222-250\.jpg$/);
  });

  it('returns null when there is no artwork (404)', async () => {
    const { p } = providers([
      { match: /coverartarchive\.org\/release\/1/, responses: [{ status: 404 }] },
    ]);
    expect(await p.coverArt.getFrontCover('1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9')).toBeNull();
  });
});

describe('thumbnails and dominant color', () => {
  it('requests 64px artwork from Deezer and iTunes CDNs and refuses unknown hosts', () => {
    const { p } = providers();
    expect(
      p.thumbnailFor('https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg')
    ).toBe('https://cdn-images.dzcdn.net/images/cover/abc/64x64-000000-80-0-0.jpg');
    expect(p.thumbnailFor('https://is1-ssl.mzstatic.com/image/thumb/x/1000x1000bb.jpg')).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/x/64x64bb.jpg'
    );
    expect(p.thumbnailFor('https://images.unsplash.com/photo-1?w=600')).toBeNull();
    expect(p.thumbnailFor('http://cdn-images.dzcdn.net/x.jpg')).toBeNull();
    // Suffix look-alikes are not provider CDNs: the server must not download from them.
    expect(
      p.thumbnailFor('https://evildzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg')
    ).toBeNull();
    expect(p.thumbnailFor('https://notmzstatic.com/image/thumb/x/1000x1000bb.jpg')).toBeNull();
    expect(p.thumbnailFor('https://fakearchive.org/x-1200.jpg')).toBeNull();
  });

  it.each([
    ['red-baseline-420.jpg', [192, 57, 43]],
    ['red-baseline-444.jpg', [192, 57, 43]],
    ['blue-progressive.jpg', [41, 98, 255]],
    ['blue-restart.jpg', [41, 98, 255]],
    ['gray.jpg', [120, 120, 120]],
    ['green.png', [30, 160, 90]],
    ['green-palette.png', [30, 160, 90]],
    ['orange-rgba.png', [200, 120, 20]],
  ] as const)('finds the dominant color of %s', (file, expected) => {
    const hex = dominantColorOf(imageFixture(file));
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    const rgb = [1, 3, 5].map((i) => parseInt((hex ?? '').slice(i, i + 2), 16));
    rgb.forEach((channel, i) =>
      expect(Math.abs(channel - (expected[i] ?? -1))).toBeLessThanOrEqual(6)
    );
  });

  it('returns null for unsupported or corrupt images instead of throwing', () => {
    expect(dominantColorOf(Buffer.from('GIF89a'))).toBeNull();
    const jpeg = imageFixture('red-baseline-420.jpg');
    expect(() => dominantColorOf(jpeg.subarray(0, 200))).not.toThrow();
    expect(dominantColorOf(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });

  it('does not inflate a PNG beyond what its header declares (zlib bomb)', () => {
    const chunk = (type: string, body: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(body.length);
      return Buffer.concat([length, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(2, 0); // 2 x 2 RGB, 8-bit
    ihdr.writeUInt32BE(2, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    // ~64 KB of zlib that expands to 64 MB.
    const bomb = deflateSync(Buffer.alloc(64 * 1024 * 1024), { level: 9 });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', bomb),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    expect(png.length).toBeLessThan(200_000);
    expect(dominantColorOf(png)).toBeNull();
  });

  it('rejects images larger than the limit', async () => {
    const { p } = providers([{ match: /big\.jpg$/, responses: [{ body: Buffer.alloc(10_000) }] }]);
    await expect(p.images.getBytes('https://cdn.test/big.jpg', 1_000)).rejects.toBeInstanceOf(
      UpstreamRequestError
    );
  });
});
