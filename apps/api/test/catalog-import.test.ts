import { prisma } from '@openmusic/db';
import {
  ApiErrorBodySchema,
  CatalogReleaseSchema,
  CatalogResolveResultSchema,
  SearchResultSchema,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../src/app';
import { CatalogImportService } from '../src/modules/catalog/catalog-import.service';
import { CuratedAlbumSchema, importCuratedAlbums } from '../src/modules/catalog/curated-import';
import { signedInUser } from './helpers/factories';
import {
  createFakeClock,
  createFixtureFetch,
  inRainbowsRoutes,
  type FixtureRoute,
} from './helpers/fixture-fetch';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Catalog import from external databases', () => {
  let ctx: AppContext;
  let fixtures: ReturnType<typeof createFixtureFetch>;
  const clock = createFakeClock();

  beforeAll(async () => {
    fixtures = createFixtureFetch(inRainbowsRoutes());
    ctx = await createTestApp({ catalogFetch: fixtures.fetch, catalogClock: clock });
  });

  beforeEach(async () => {
    await ctx.catalogBackground.idle();
    await resetTestState(ctx);
    // Lets circuit breakers opened by a previous "provider down" test close again.
    await clock.sleep(10 * 60_000);
    fixtures.calls.splice(0);
    fixtures.routes.splice(0, fixtures.routes.length, ...inRainbowsRoutes());
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  /** Replaces the routes for one test (later routes win over the defaults). */
  function override(...routes: FixtureRoute[]): void {
    fixtures.routes.push(...routes);
  }

  async function search(query: string) {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/search?${query}` });
    expect(res.statusCode).toBe(200);
    return SearchResultSchema.parse(res.json());
  }

  async function resolve(query: string) {
    return ctx.app.inject({ method: 'GET', url: `/api/catalog/resolve?${query}` });
  }

  it('imports Deezer search hits with internal UUIDs, deduplicated', async () => {
    const result = await search('q=in%20rainbows');
    expect(result.sources).toEqual(['DEEZER']);
    expect(result.releases.map((r) => r.title)).toEqual(['In Rainbows', 'In Rainbows (Disk 2)']);
    for (const r of result.releases) expect(r.id).toMatch(UUID);
    expect(result.releases[0]).toMatchObject({
      artistName: 'Radiohead',
      coverSource: 'DEEZER',
      externalIds: { deezer: '302127' },
    });
    expect(result.releases[0]?.coverUrl).toMatch(/1000x1000/);
    // The duplicated Reckoner hit is imported once, on the same release as the album hit.
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      title: 'Reckoner',
      releaseId: result.releases[0]?.id,
    });
    expect(result.tracks[0]?.id).toMatch(UUID);
    expect(await prisma.artist.count()).toBe(1);
  });

  it('is idempotent: repeating a search creates no duplicates', async () => {
    const first = await search('q=in%20rainbows');
    const counts = async () => [
      await prisma.release.count(),
      await prisma.track.count(),
      await prisma.artist.count(),
    ];
    const before = await counts();
    const second = await search('q=in%20rainbows');
    expect(await counts()).toEqual(before);
    expect(second.releases.map((r) => r.id)).toEqual(first.releases.map((r) => r.id));
    expect(second.sources).toEqual(['LOCAL', 'DEEZER']);
  });

  it('merges into an existing local (seed) release instead of duplicating it', async () => {
    const seeded = await prisma.release.create({
      data: {
        title: 'In Rainbows',
        artistName: 'Radiohead',
        coverUrl: 'https://images.unsplash.com/photo-1?w=600',
        dominantColor: '#D97736',
        genres: ['Art Rock'],
        tracks: {
          create: [
            {
              title: 'Reckoner',
              artistName: 'Radiohead',
              durationMs: 290_000,
              isrc: 'ZZOMS2600007',
            },
            { title: 'Nude', artistName: 'Radiohead', durationMs: 255_000, isrc: 'ZZOMS2600003' },
          ],
        },
      },
      include: { tracks: true },
    });
    const author = await signedInUser(ctx);
    await prisma.review.create({
      data: { userId: author.user.id, releaseId: seeded.id, rating: 90 },
    });

    const result = await search('q=in%20rainbows');
    expect(result.releases[0]?.id).toBe(seeded.id);
    expect(result.sources).toEqual(['LOCAL', 'DEEZER']);

    // Opening it imports the full Deezer detail into the same row.
    const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${seeded.id}` });
    expect(res.statusCode).toBe(200);
    const release = CatalogReleaseSchema.parse(res.json());
    expect(release).toMatchObject({
      id: seeded.id,
      label: 'XL Recordings',
      upc: '634904032463',
      trackCount: 10,
      coverSource: 'DEEZER',
      releaseDate: '2007-12-28T00:00:00.000Z',
    });
    // Seed genre first, then Deezer's and MusicBrainz' (background enrichment), max 5.
    expect(release.genres[0]).toBe('Art Rock');
    expect(release.genres).toEqual(expect.arrayContaining(['Alternative', 'Rock']));
    expect(release.genres.length).toBeLessThanOrEqual(5);
    expect(release.tracks).toHaveLength(10);
    expect(release.tracks?.map((t) => t.trackNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Seed tracks were upgraded in place (same ids, real ISRCs), not duplicated.
    const reckoner = release.tracks?.find((t) => t.title === 'Reckoner');
    expect(reckoner?.id).toBe(seeded.tracks.find((t) => t.title === 'Reckoner')?.id);
    expect(reckoner?.isrc).toBe('GBSTK0700007');
    expect(reckoner?.externalIds?.deezer).toBe('3135559');
    expect(await prisma.review.count({ where: { releaseId: seeded.id } })).toBe(1);
  });

  it('opens a search hit: fetches the tracklist once and computes the cover color', async () => {
    const { releases } = await search('q=in%20rainbows&type=releases');
    const id = releases[0]?.id ?? '';
    expect(releases[0]?.tracks).toBeUndefined();

    const open = async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${id}` });
      return CatalogReleaseSchema.parse(res.json());
    };
    const release = await open();
    expect(release.tracks).toHaveLength(10);
    expect(release.tracks?.every((t) => t.isrc && t.previewUrl?.startsWith('https://'))).toBe(true);

    await ctx.catalogBackground.idle();
    const again = await open();
    // red-baseline-420.jpg is served for the 64px Deezer thumbnail.
    expect(again.dominantColor).toBe('#C1392B');
    expect(fixtures.callsTo(/album\/302127$/)).toHaveLength(1);
    expect(fixtures.callsTo(/64x64-000000-80-0-0\.jpg$/).length).toBeGreaterThanOrEqual(1);
  });

  it('enriches from MusicBrainz in the background (MBIDs, genres, recordings)', async () => {
    const { releases } = await search('q=in%20rainbows&type=releases');
    const id = releases[0]?.id ?? '';
    await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${id}` });
    await ctx.catalogBackground.idle();

    const row = await prisma.release.findUniqueOrThrow({
      where: { id },
      include: { tracks: true },
    });
    expect(row.musicbrainzId).toBe('0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
    expect(row.musicbrainzReleaseGroupId).toBe('6e335887-60ba-38f0-95af-fae7774336bf');
    expect([...row.genres].sort()).toEqual([
      'Alternative',
      'Alternative Rock',
      'Art Rock',
      'Electronic',
      'Rock',
    ]);
    expect(row.enrichedAt).not.toBeNull();
    expect(row.tracks.filter((t) => t.musicbrainzId).length).toBe(10);
    for (const call of fixtures.callsTo(/musicbrainz\.org/)) {
      expect(call.headers['user-agent']).toMatch(/^OpenMusic\/0\.1\.0 \( .+ \)$/);
    }
  });

  it('enrichment never hits the unique MBID index for a recording another edition owns', async () => {
    // Another edition (ADR-012) already holds one recording MBID of In Rainbows (15 Step) and the
    // MusicBrainz release id itself (duplicate edition row).
    const other = await prisma.release.create({
      data: {
        title: 'Live Bootlegs',
        artistName: 'Radiohead Tribute Band',
        deezerId: '999000111',
        musicbrainzId: '0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01',
        tracks: {
          create: {
            title: '15 Step',
            artistName: 'Radiohead',
            durationMs: 237_000,
            musicbrainzId: '9e2d0000-0000-4000-8000-000000000000',
          },
        },
      },
    });
    // Prisma prints every query error (`prisma:error`, P2002 included) even when the caller
    // catches it: that is the noise live imports showed.
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    try {
      const { releases } = await search('q=in%20rainbows&type=releases');
      const id = releases[0]?.id ?? '';
      expect(id).not.toBe(other.id);
      await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${id}` });
      await ctx.catalogBackground.idle();

      const prismaErrors = [...log.mock.calls, ...error.mock.calls]
        .map((args) => args.map(String).join(' '))
        .filter((line) => /prisma:error|Unique constraint/.test(line));
      expect(prismaErrors).toEqual([]);

      const row = await prisma.release.findUniqueOrThrow({
        where: { id },
        include: { tracks: true },
      });
      expect(row.enrichedAt).not.toBeNull();
      expect(row.musicbrainzId).toBeNull(); // owned by the other row
      expect(row.musicbrainzReleaseGroupId).toBe('6e335887-60ba-38f0-95af-fae7774336bf');
      // The other nine recordings are linked; 15 Step stays with the edition that had it.
      expect(row.tracks.filter((t) => t.musicbrainzId).length).toBe(9);
      expect(row.tracks.find((t) => t.title === '15 Step')?.musicbrainzId).toBeNull();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it('resolves provider ids to internal releases, idempotently', async () => {
    const first = await resolve('provider=deezer&id=302127');
    expect(first.statusCode).toBe(200);
    const a = CatalogResolveResultSchema.parse(first.json());
    expect(a.release.id).toMatch(UUID);
    expect(a.release.tracks).toHaveLength(10);
    expect(a.trackId).toBeNull();
    expect(a.release.dominantColor).toBe('#C1392B');

    const b = CatalogResolveResultSchema.parse((await resolve('provider=deezer&id=302127')).json());
    expect(b.release.id).toBe(a.release.id);

    const track = CatalogResolveResultSchema.parse(
      (await resolve('provider=deezer&type=track&id=3135559')).json()
    );
    expect(track.release.id).toBe(a.release.id);
    const reckoner = a.release.tracks?.find((t) => t.title === 'Reckoner');
    expect(track.trackId).toBe(reckoner?.id);

    // Ids issued by the old search keep working.
    const legacy = CatalogResolveResultSchema.parse(
      (await resolve('provider=deezer&id=deezer-trk-3135559')).json()
    );
    expect(legacy.trackId).toBe(reckoner?.id);
    expect(await prisma.release.count()).toBe(1);
  });

  it('concurrent imports of the same album converge on one release and one tracklist', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => resolve('provider=deezer&id=302127'))
    );
    const ids = new Set(
      results.map((res) => {
        expect(res.statusCode).toBe(200);
        return CatalogResolveResultSchema.parse(res.json()).release.id;
      })
    );
    expect(ids.size).toBe(1);
    expect(await prisma.release.count()).toBe(1);
    expect(await prisma.track.count()).toBe(10);
    expect(await prisma.artist.count()).toBe(1);
  });

  it('two API processes importing the same album converge via the unique constraints', async () => {
    // Separate importers = separate in-process locks, like two API instances.
    const importers = Array.from(
      { length: 3 },
      () => new CatalogImportService(prisma, ctx.catalogProviders)
    );
    const album = await ctx.catalogProviders.deezer.getAlbum('302127');
    if (!album) throw new Error('fixture missing');
    const results = await Promise.all(importers.map((imp) => imp.importRelease(album)));
    expect(new Set(results.map((r) => r.release.id)).size).toBe(1);
    expect(await prisma.release.count()).toBe(1);
    expect(await prisma.release.count({ where: { deezerId: '302127' } })).toBe(1);
    expect(await prisma.track.count()).toBe(10);
  });

  it('concurrent search hits do not duplicate releases or tracks', async () => {
    await Promise.all(Array.from({ length: 4 }, () => search('q=in%20rainbows')));
    expect(await prisma.release.count()).toBe(2);
    expect(await prisma.track.count()).toBe(1);
  });

  it('merges the same album from iTunes and Deezer into one row', async () => {
    const itunes = CatalogResolveResultSchema.parse(
      (await resolve('provider=itunes&id=1109714933')).json()
    );
    expect(itunes.release.coverUrl).toMatch(/1000x1000bb\.jpg$/);
    expect(itunes.release.coverSource).toBe('ITUNES');
    // The iTunes artwork fixture is blue.
    expect(itunes.release.dominantColor).toBe('#2963FE');

    const deezer = CatalogResolveResultSchema.parse(
      (await resolve('provider=deezer&id=302127')).json()
    );
    expect(deezer.release.id).toBe(itunes.release.id);
    expect(deezer.release.externalIds).toMatchObject({ deezer: '302127', itunes: '1109714933' });
    // Deezer's 1000px cover is preferred over iTunes.
    expect(deezer.release.coverSource).toBe('DEEZER');
    expect(deezer.release.tracks).toHaveLength(10);
    expect(await prisma.release.count()).toBe(1);
  });

  it('resolves MusicBrainz releases with a Cover Art Archive cover', async () => {
    const res = await resolve('provider=musicbrainz&id=0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
    expect(res.statusCode).toBe(200);
    const { release } = CatalogResolveResultSchema.parse(res.json());
    expect(release).toMatchObject({
      coverSource: 'COVER_ART_ARCHIVE',
      label: 'XL Recordings',
      externalIds: { musicbrainz: '0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01' },
    });
    expect(release.coverUrl).toMatch(/^https:\/\/coverartarchive\.org\/.*2222-1200\.jpg$/);
    expect(release.dominantColor).toBe('#1EA05A');
  });

  it('validates resolve input and maps provider failures', async () => {
    expect((await resolve('provider=deezer&id=abc')).statusCode).toBe(400);
    expect((await resolve('provider=musicbrainz&id=123')).statusCode).toBe(400);
    expect((await resolve('provider=spotify&id=1')).statusCode).toBe(400);
    expect((await resolve('provider=deezer&id=999')).statusCode).toBe(404);

    override({ match: /api\.deezer\.com\/album\/777/, responses: [{ status: 503 }] });
    const down = await resolve('provider=deezer&id=777');
    expect(down.statusCode).toBe(502);
    expect(ApiErrorBodySchema.parse(down.json()).code).toBe('UPSTREAM_ERROR');
  });

  it('falls back to iTunes when Deezer is down', async () => {
    override({ match: /api\.deezer\.com/, responses: [{ networkError: true }] });
    const result = await search('q=in%20rainbows');
    expect(result.sources).toEqual(['ITUNES']);
    expect(result.releases.map((r) => [r.title, r.releaseType])).toEqual([
      ['In Rainbows', 'ALBUM'],
      ['Reckoner', 'SINGLE'],
    ]);
    expect(result.releases[0]?.coverUrl).toMatch(/1000x1000bb\.jpg$/);
    expect(result.tracks[0]?.title).toBe('Reckoner');
  });

  it('still answers from the local catalog when every provider is down', async () => {
    await prisma.release.create({ data: { title: 'In Rainbows', artistName: 'Radiohead' } });
    override({ match: /./, responses: [{ networkError: true }] });
    const result = await search('q=rainbows');
    expect(result.sources).toEqual(['LOCAL']);
    expect(result.releases).toHaveLength(1);
  });

  it('does not call external databases when external=false', async () => {
    const result = await search('q=in%20rainbows&external=false');
    expect(result).toMatchObject({ releases: [], tracks: [], sources: [] });
    expect(fixtures.calls).toHaveLength(0);
  });

  it('paginates: hasMore follows the provider total', async () => {
    override({
      match: /api\.deezer\.com\/search\/album\?/,
      responses: [{ body: JSON.stringify({ data: [], total: 40 }) }],
    });
    const result = await search('q=radiohead&type=releases&limit=5&page=2');
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(true);
    const url = new URL(fixtures.callsTo(/search\/album/)[0]?.url ?? '');
    expect(url.searchParams.get('index')).toBe('5');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  describe('curated import (npm run catalog:import)', () => {
    const inRainbows = CuratedAlbumSchema.parse({
      artist: 'Radiohead',
      title: 'In Rainbows',
      year: 2007,
      genres: ['Art Rock', 'Alternative Rock'],
    });
    const deps = () => ({
      prisma,
      providers: ctx.catalogProviders,
      importer: ctx.catalogImportService,
      enrichment: ctx.catalogEnrichmentService,
    });
    const options = { dryRun: false, enrich: true, onlyLocal: false };

    it('finds the album by artist + title, imports it fully and is idempotent', async () => {
      const [first] = await importCuratedAlbums(deps(), [inRainbows], options);
      expect(first).toMatchObject({
        status: 'imported',
        source: 'DEEZER',
        externalId: '302127',
        tracks: 10,
        dominantColor: '#C1392B',
        enrichment: 'enriched',
      });
      const release = await prisma.release.findUniqueOrThrow({
        where: { id: first?.releaseId ?? '' },
      });
      expect(release.genres.slice(0, 2)).toEqual(['Art Rock', 'Alternative Rock']);
      expect(release.musicbrainzId).not.toBeNull();

      const counts = async () => [await prisma.release.count(), await prisma.track.count()];
      const before = await counts();
      const [second] = await importCuratedAlbums(deps(), [inRainbows], options);
      expect(second?.releaseId).toBe(first?.releaseId);
      expect(await counts()).toEqual(before);
    });

    it('uses the advanced Deezer query alone when it finds the album', async () => {
      const [result] = await importCuratedAlbums(deps(), [inRainbows], {
        ...options,
        dryRun: true,
      });
      expect(result).toMatchObject({ status: 'imported', externalId: '302127' });
      const queries = fixtures
        .callsTo(/search\/album/)
        .map((c) => new URL(c.url).searchParams.get('q'));
      expect(queries).toEqual(['artist:"Radiohead" album:"In Rainbows"']);
    });

    it('falls back to a plain Deezer query when the advanced one finds no match', async () => {
      // Live behaviour: `artist:"Michael Jackson" album:"Thriller"` only returns covers by other
      // artists, while "Michael Jackson Thriller" returns the original album (Deezer 96126).
      override(
        {
          match: /api\.deezer\.com\/search\/album\?q=artist/,
          responses: [{ file: 'deezer-search-album-thriller-advanced.json' }],
        },
        {
          match: /api\.deezer\.com\/search\/album\?q=Michael\+Jackson\+Thriller&/,
          responses: [{ file: 'deezer-search-album-thriller.json' }],
        },
        {
          match: /api\.deezer\.com\/album\/96126$/,
          responses: [{ file: 'deezer-album-96126.json' }],
        }
      );
      const thriller = CuratedAlbumSchema.parse({
        artist: 'Michael Jackson',
        title: 'Thriller',
        year: 1982,
        genres: ['Pop'],
      });
      const [result] = await importCuratedAlbums(deps(), [thriller], { ...options, enrich: false });
      expect(result).toMatchObject({
        status: 'imported',
        source: 'DEEZER',
        externalId: '96126',
        tracks: 3,
      });
      const queries = fixtures
        .callsTo(/search\/album/)
        .map((c) => new URL(c.url).searchParams.get('q'));
      expect(queries).toEqual([
        'artist:"Michael Jackson" album:"Thriller"',
        'Michael Jackson Thriller',
      ]);
      // The exact-title album wins over the remix single and the deluxe reissues.
      expect(fixtures.callsTo(/api\.deezer\.com\/album\/\d+$/).map((c) => c.url)).toEqual([
        'https://api.deezer.com/album/96126',
      ]);
      expect(fixtures.callsTo(/itunes\.apple\.com/)).toHaveLength(0);
      const release = await prisma.release.findUniqueOrThrow({
        where: { id: result?.releaseId ?? '' },
      });
      expect(release).toMatchObject({ title: 'Thriller', artistName: 'Michael Jackson' });
    });

    it('supports dry runs, local-only mode and reports albums it cannot find', async () => {
      const unknown = CuratedAlbumSchema.parse({ artist: 'Nobody', title: 'Nothing At All' });
      const results = await importCuratedAlbums(deps(), [inRainbows, unknown], {
        ...options,
        dryRun: true,
      });
      expect(results.map((r) => r.status)).toEqual(['imported', 'not-found']);
      expect(await prisma.release.count()).toBe(0);

      const [skipped] = await importCuratedAlbums(deps(), [inRainbows], {
        ...options,
        onlyLocal: true,
      });
      expect(skipped?.status).toBe('skipped');
      await prisma.release.create({ data: { title: 'In Rainbows', artistName: 'Radiohead' } });
      const [upgraded] = await importCuratedAlbums(deps(), [inRainbows], {
        ...options,
        onlyLocal: true,
        enrich: false,
      });
      expect(upgraded?.status).toBe('imported');
      expect(await prisma.release.count()).toBe(1);
    });
  });
});

describe('CATALOG_EXTERNAL_ENABLED=false', () => {
  let ctx: AppContext;
  let fixtures: ReturnType<typeof createFixtureFetch>;

  beforeAll(async () => {
    fixtures = createFixtureFetch(inRainbowsRoutes());
    ctx = await createTestApp({
      catalogFetch: fixtures.fetch,
      catalogClock: createFakeClock(),
      catalogExternalEnabled: false,
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('makes no outbound call for search, resolve or audio previews', async () => {
    await resetTestState(ctx);
    const search = await ctx.app.inject({ method: 'GET', url: '/api/catalog/search?q=reckoner' });
    expect(search.statusCode).toBe(200);
    const resolve = await ctx.app.inject({
      method: 'GET',
      url: '/api/catalog/resolve?provider=deezer&id=302127',
    });
    expect(resolve.statusCode).toBe(404);
    const preview = await ctx.app.inject({
      method: 'GET',
      url: '/api/catalog/preview?title=Reckoner&artist=Radiohead',
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ previewUrl: null, source: 'NONE' });
    const tooLong = await ctx.app.inject({
      method: 'GET',
      url: `/api/catalog/preview?title=${'a'.repeat(301)}&artist=Radiohead`,
    });
    expect(tooLong.statusCode).toBe(400);
    expect(fixtures.calls).toHaveLength(0);
  });
});
