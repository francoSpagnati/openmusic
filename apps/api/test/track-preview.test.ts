import { prisma } from '@openmusic/db';
import { ApiErrorBodySchema } from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { deezerPreviewExpiry, publicPreviewUrl, trackPreviewPath } from '../src/lib/preview-url';
import { toCatalogTrack } from '../src/lib/mappers';
import { createRelease } from './helpers/factories';
import {
  catalogFixture,
  createFakeClock,
  createFixtureFetch,
  inRainbowsRoutes,
} from './helpers/fixture-fetch';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

const nowSeconds = () => Math.floor(Date.now() / 1000);
const signed = (exp: number, name = 'abc') =>
  `https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/${name}.mp3?hdnea=exp=${exp}~acl=*~hmac=00`;
const ITUNES = 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/x/clip.m4a';

describe('preview URL helpers', () => {
  it('reads the expiry of Deezer signed URLs only', () => {
    expect(deezerPreviewExpiry(signed(1793293916))).toBe(1793293916);
    expect(deezerPreviewExpiry(ITUNES)).toBeNull();
    expect(deezerPreviewExpiry('https://example.com/a.mp3?hdnea=exp=1')).toBeNull();
    expect(deezerPreviewExpiry('not a url')).toBeNull();
  });

  it('exposes expiring URLs as the endpoint path and keeps the others', () => {
    expect(publicPreviewUrl('t1', signed(1793293916))).toBe('/api/catalog/tracks/t1/preview');
    expect(publicPreviewUrl('t1', ITUNES)).toBe(ITUNES);
    expect(publicPreviewUrl('t1', null)).toBeNull();
  });

  it('rewrites the previewUrl of serialized tracks', () => {
    const base = {
      id: 'tr-1',
      isrc: null,
      title: 'Reckoner',
      artistName: 'Radiohead',
      durationMs: 1000,
      releaseId: 'rel',
      trackNumber: 1,
      discNumber: 1,
      deezerId: null,
      itunesId: null,
      musicbrainzId: null,
      spotifyId: null,
      release: { coverUrl: null },
    };
    const out = toCatalogTrack({ ...base, previewUrl: signed(1793293916) } as never);
    expect(out.previewUrl).toBe(trackPreviewPath('tr-1'));
  });
});

describe('GET /api/catalog/tracks/:trackId/preview', () => {
  let ctx: AppContext;
  let fixtures: ReturnType<typeof createFixtureFetch>;
  const clock = createFakeClock();

  beforeAll(async () => {
    fixtures = createFixtureFetch(inRainbowsRoutes());
    ctx = await createTestApp({ catalogFetch: fixtures.fetch, catalogClock: clock });
  });

  beforeEach(async () => {
    await resetTestState(ctx);
    await clock.sleep(10 * 60_000);
    fixtures.calls.splice(0);
    fixtures.routes.splice(0, fixtures.routes.length, ...inRainbowsRoutes());
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function track(data: { previewUrl?: string | null; deezerId?: string | null }) {
    const release = await createRelease();
    return prisma.track.create({
      data: {
        title: 'Reckoner',
        artistName: 'Radiohead',
        durationMs: 290_000,
        releaseId: release.id,
        ...data,
      },
    });
  }

  const get = (id: string) =>
    ctx.app.inject({ method: 'GET', url: `/api/catalog/tracks/${id}/preview` });

  it('redirects to a stored URL that is not expiring or still valid, without upstream calls', async () => {
    const itunes = await track({ previewUrl: ITUNES });
    const res = await get(itunes.id);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(ITUNES);

    const valid = signed(nowSeconds() + 600);
    const deezer = await track({ previewUrl: valid, deezerId: '3135559' });
    const res2 = await get(deezer.id);
    expect(res2.statusCode).toBe(302);
    expect(res2.headers.location).toBe(valid);
    expect(fixtures.calls).toHaveLength(0);
  });

  it('refreshes an expired Deezer URL by Deezer id, caches and persists it', async () => {
    const fresh = signed(nowSeconds() + 900, 'fresh');
    const body = catalogFixture('deezer-track-3135559.json').replace(
      /"preview": "[^"]*"/,
      `"preview": "${fresh}"`
    );
    fixtures.routes.push({ match: /api\.deezer\.com\/track\/3135559$/, responses: [{ body }] });
    const t = await track({ previewUrl: signed(nowSeconds() - 10), deezerId: '3135559' });

    const res = await get(t.id);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(fresh);
    expect((await prisma.track.findUniqueOrThrow({ where: { id: t.id } })).previewUrl).toBe(fresh);
    const ttl = await ctx.redis.ttl(`preview:track:${t.id}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(840);

    // Second request: served from the stored/fresh URL, Deezer is not called again.
    const calls = fixtures.calls.length;
    expect((await get(t.id)).headers.location).toBe(fresh);
    expect(fixtures.calls).toHaveLength(calls);
  });

  it('falls back to the preview resolver when the Deezer lookup yields nothing', async () => {
    // Unknown Deezer id -> "no data"; the resolver finds the clip on iTunes.
    const t = await track({ previewUrl: signed(nowSeconds() - 10), deezerId: '999' });
    fixtures.routes.push({
      match: /api\.deezer\.com\/search\/track\?/,
      responses: [{ file: 'deezer-search-empty.json' }],
    });
    const res = await get(t.id);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/audio-ssl\.itunes\.apple\.com\//);
  });

  it('answers 404 when the track or its preview does not exist', async () => {
    const missing = await get('00000000-0000-4000-8000-000000000000');
    expect(missing.statusCode).toBe(404);
    expect(ApiErrorBodySchema.safeParse(missing.json()).success).toBe(true);

    const t = await track({ previewUrl: null });
    fixtures.routes.push(
      {
        match: /api\.deezer\.com\/search\/track\?/,
        responses: [{ file: 'deezer-search-empty.json' }],
      },
      {
        match: /itunes\.apple\.com\/search\?/,
        responses: [{ body: '{"resultCount":0,"results":[]}' }],
      }
    );
    expect((await get(t.id)).statusCode).toBe(404);
  });
});
