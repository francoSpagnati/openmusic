import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Clock, FetchLike } from '../../src/lib/upstream';

const FIXTURES = path.resolve(__dirname, '../fixtures');

export function catalogFixture(name: string): string {
  return readFileSync(path.join(FIXTURES, 'catalog', name), 'utf8');
}

export function imageFixture(name: string): Buffer {
  return readFileSync(path.join(FIXTURES, 'images', name));
}

export interface FixtureResponse {
  status?: number;
  /** JSON fixture file name under fixtures/catalog. */
  file?: string;
  body?: string | Buffer;
  headers?: Record<string, string>;
  /** Simulates a network failure (DNS, proxy 403 on CONNECT, reset). */
  networkError?: boolean;
}

export interface FixtureRoute {
  match: RegExp;
  /** Served in order; the last one repeats. */
  responses: FixtureResponse[];
}

export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
}

/**
 * Fake `fetch` for the catalog providers: maps URLs to recorded fixture responses and records
 * every call (URL + headers). Unmatched URLs fail like a blocked network.
 */
export function createFixtureFetch(initial: FixtureRoute[] = []): {
  fetch: FetchLike;
  calls: RecordedCall[];
  routes: FixtureRoute[];
  callsTo(pattern: RegExp): RecordedCall[];
} {
  const routes = [...initial];
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url: input, headers });
    // Later routes win, so a test can override the defaults by pushing a new route.
    const route = [...routes].reverse().find((r) => r.match.test(input));
    if (!route) throw new TypeError(`fetch failed (no fixture for ${input})`);
    const response = route.responses.length > 1 ? route.responses.shift() : route.responses[0];
    if (!response || response.networkError) throw new TypeError('fetch failed');
    const raw = response.file ? catalogFixture(response.file) : (response.body ?? '');
    const body = typeof raw === 'string' ? raw : new Uint8Array(raw);
    return new Response(body, {
      status: response.status ?? 200,
      headers: {
        'content-type': response.file ? 'application/json' : 'application/octet-stream',
        ...response.headers,
      },
    });
  };
  return {
    fetch,
    calls,
    routes,
    callsTo: (pattern) => calls.filter((c) => pattern.test(c.url)),
  };
}

/** A clock whose `sleep` returns at once but advances `now`, recording every wait. */
export function createFakeClock(start = 1_700_000_000_000): Clock & { sleeps: number[] } {
  let now = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

const json = (file: string): FixtureResponse[] => [{ file }];

/** Default routes: the "In Rainbows" world, served for every provider. */
export function inRainbowsRoutes(): FixtureRoute[] {
  return [
    // Unknown Deezer ids: "no data" (listed first so the specific routes below win).
    {
      match: /api\.deezer\.com\/(album|track)\/(?!302127|3135559)/,
      responses: json('deezer-error-no-data.json'),
    },
    {
      match: /api\.deezer\.com\/search\/album\?/,
      responses: json('deezer-search-album-in-rainbows.json'),
    },
    {
      match: /api\.deezer\.com\/search\/track\?/,
      responses: json('deezer-search-track-reckoner.json'),
    },
    {
      match: /api\.deezer\.com\/album\/302127\/tracks/,
      responses: json('deezer-album-302127-tracks.json'),
    },
    { match: /api\.deezer\.com\/album\/302127$/, responses: json('deezer-album-302127.json') },
    { match: /api\.deezer\.com\/album\/upc:/, responses: json('deezer-album-302127.json') },
    {
      match: /api\.deezer\.com\/track\/(3135559|isrc:GBSTK0700007)$/,
      responses: json('deezer-track-3135559.json'),
    },
    {
      match: /itunes\.apple\.com\/search\?.*entity=album/,
      responses: json('itunes-search-album.json'),
    },
    {
      match: /itunes\.apple\.com\/search\?.*entity=song/,
      responses: json('itunes-search-song.json'),
    },
    { match: /itunes\.apple\.com\/lookup\?/, responses: json('itunes-lookup-album.json') },
    {
      match: /musicbrainz\.org\/ws\/2\/release\?query=barcode/,
      responses: json('musicbrainz-search-barcode.json'),
    },
    {
      match: /musicbrainz\.org\/ws\/2\/release\?query=release/,
      responses: json('musicbrainz-search-title.json'),
    },
    {
      match: /musicbrainz\.org\/ws\/2\/release\/[0-9a-f-]{36}\?/,
      responses: json('musicbrainz-release.json'),
    },
    {
      match: /musicbrainz\.org\/ws\/2\/release-group\//,
      responses: json('musicbrainz-release-group.json'),
    },
    { match: /musicbrainz\.org\/ws\/2\/isrc\//, responses: json('musicbrainz-isrc.json') },
    { match: /coverartarchive\.org\/release\//, responses: json('coverartarchive-release.json') },
    // Artwork thumbnails used for the dominant color.
    {
      match: /dzcdn\.net\/images\/cover\/.*\/64x64-/,
      responses: [{ body: imageFixture('red-baseline-420.jpg') }],
    },
    {
      match: /mzstatic\.com\/.*\/64x64bb\.jpg$/,
      responses: [{ body: imageFixture('blue-progressive.jpg') }],
    },
    {
      match: /coverartarchive\.org\/release\/.*-250\.jpg$/,
      responses: [{ body: imageFixture('green.png') }],
    },
  ];
}
