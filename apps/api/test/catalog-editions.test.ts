import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma, type Prisma } from '@openmusic/db';
import {
  CatalogReleaseSchema,
  CatalogResolveResultSchema,
  ReleaseGroupDetailSchema,
  SearchResultSchema,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import {
  auditCatalog,
  repairGroupMatchKeys,
  splitRelease,
} from '../src/modules/catalog/catalog-audit';
import type { ProviderRelease, ProviderTrack } from '../src/modules/catalog/providers/types';
import { createUser } from './helpers/factories';
import {
  catalogFixture,
  createFakeClock,
  createFixtureFetch,
  inRainbowsRoutes,
  type FixtureRoute,
} from './helpers/fixture-fetch';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

/** Deezer serves `/album/{id}/tracks` as a list; the album fixture embeds the same tracks. */
function deezerAlbumRoutes(id: number, file: string): FixtureRoute[] {
  const album = JSON.parse(catalogFixture(file)) as { tracks: { data: unknown[] } };
  return [
    {
      match: new RegExp(`api\\.deezer\\.com/album/${id}/tracks`),
      responses: [
        { body: JSON.stringify({ data: album.tracks.data, total: album.tracks.data.length }) },
      ],
    },
    { match: new RegExp(`api\\.deezer\\.com/album/${id}$`), responses: [{ file }] },
  ];
}

function editionRoutes(): FixtureRoute[] {
  return [
    ...inRainbowsRoutes(),
    ...deezerAlbumRoutes(7001001, 'deezer-album-weezer-1994.json'),
    ...deezerAlbumRoutes(7001002, 'deezer-album-weezer-2001.json'),
    {
      match: /api\.deezer\.com\/search\/album\?q=weezer/,
      responses: [{ file: 'deezer-search-album-weezer.json' }],
    },
    {
      match: /musicbrainz\.org\/ws\/2\/release\?release-group=/,
      responses: [{ file: 'musicbrainz-browse-release-group.json' }],
    },
  ];
}

/** Provider-neutral release, as every provider maps its response (see providers/types.ts). */
function providerRelease(
  overrides: Partial<ProviderRelease> & Pick<ProviderRelease, 'provider' | 'externalId' | 'title'>
): ProviderRelease {
  const artistName = overrides.artist?.name ?? 'The Beatles';
  return {
    artist: { provider: overrides.provider, externalId: null, name: artistName, pictureUrl: null },
    releaseType: 'ALBUM',
    coverUrl: null,
    releaseDate: null,
    genres: [],
    label: null,
    upc: null,
    trackCount: null,
    tracks: null,
    ...overrides,
  };
}

function tracksFor(
  provider: ProviderRelease['provider'],
  prefix: string,
  n: number
): ProviderTrack[] {
  return Array.from({ length: n }, (_, i) => ({
    provider,
    externalId: `${prefix}${i + 1}`,
    title: `Song ${i + 1}`,
    artist: { provider, externalId: null, name: 'The Beatles', pictureUrl: null },
    durationMs: 180_000,
    isrc: null,
    previewUrl: null,
    trackNumber: i + 1,
    discNumber: 1,
    release: null,
  }));
}

describe('Editions and release groups (ADR-012)', () => {
  let ctx: AppContext;
  let fixtures: ReturnType<typeof createFixtureFetch>;
  const clock = createFakeClock();

  beforeAll(async () => {
    fixtures = createFixtureFetch(editionRoutes());
    ctx = await createTestApp({ catalogFetch: fixtures.fetch, catalogClock: clock });
  });

  beforeEach(async () => {
    await ctx.catalogBackground.idle();
    await resetTestState(ctx);
    await clock.sleep(10 * 60_000);
    fixtures.calls.splice(0);
    fixtures.routes.splice(0, fixtures.routes.length, ...editionRoutes());
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  const importer = () => ctx.catalogImportService;

  async function resolve(query: string) {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/resolve?${query}` });
    expect(res.statusCode).toBe(200);
    return CatalogResolveResultSchema.parse(res.json());
  }

  async function group(id: string) {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/release-groups/${id}` });
    expect(res.statusCode).toBe(200);
    return ReleaseGroupDetailSchema.parse(res.json());
  }

  describe('merge rules', () => {
    it('keeps a remaster separate from the original, in the same release group', async () => {
      const original = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '9001',
          title: 'Abbey Road',
          releaseDate: '1969-09-26',
          trackCount: 17,
        })
      );
      const remaster = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '9002',
          title: 'Abbey Road (Remastered 2009)',
          releaseDate: '2009-09-09',
          trackCount: 17,
        })
      );
      // The same remaster from iTunes (same markers, year, track count) joins its row.
      const sameRemaster = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '1441164426',
          title: 'Abbey Road (2009 Remaster)',
          releaseDate: '2009-09-09',
          trackCount: 17,
        })
      );
      expect(remaster.release.id).not.toBe(original.release.id);
      expect(sameRemaster.release.id).toBe(remaster.release.id);
      expect(sameRemaster.release).toMatchObject({ deezerId: '9002', itunesId: '1441164426' });
      expect(remaster.release.editionLabel).toBe('Remastered 2009');
      expect(remaster.release.releaseGroupId).toBe(original.release.releaseGroupId);
      const work = await prisma.releaseGroup.findUniqueOrThrow({
        where: { id: original.release.releaseGroupId ?? '' },
      });
      expect(work).toMatchObject({ title: 'Abbey Road', firstReleaseYear: 1969 });
    });

    it('keeps an unmarked remaster separate even with the same year and track count', async () => {
      const a = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '1',
          title: 'Abbey Road',
          releaseDate: '2009-09-09',
          trackCount: 17,
        })
      );
      const b = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '2',
          title: 'Abbey Road (Remastered)',
          releaseDate: '2009-09-09',
          trackCount: 17,
        })
      );
      expect(b.release.id).not.toBe(a.release.id);
    });

    it('keeps deluxe and super deluxe editions separate', async () => {
      const titles = [
        'Abbey Road',
        'Abbey Road (Deluxe Edition)',
        'Abbey Road (Super Deluxe Edition)',
      ];
      const ids: string[] = [];
      for (const [i, title] of titles.entries()) {
        const { release } = await importer().importRelease(
          providerRelease({
            provider: 'DEEZER',
            externalId: String(100 + i),
            title,
            releaseDate: i === 0 ? '1969-09-26' : '2019-09-27',
            trackCount: [17, 23, 40][i] ?? null,
          })
        );
        ids.push(release.id);
      }
      expect(new Set(ids).size).toBe(3);
      expect(await prisma.releaseGroup.count()).toBe(1);
      // A Deezer search hit (no date) for the deluxe edition finds its row, not the original.
      const hit = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '777',
          title: 'Abbey Road [Deluxe Version]',
          trackCount: 23,
        })
      );
      expect(hit.release.id).toBe(ids[1]);
    });

    it('merges the explicit and clean version of the same edition', async () => {
      const explicit = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '5555',
          title: 'Blonde',
          artist: { provider: 'DEEZER', externalId: '1', name: 'Frank Ocean', pictureUrl: null },
          releaseDate: '2016-08-20',
          trackCount: 17,
        })
      );
      const clean = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '6666',
          title: 'Blonde (Clean)',
          artist: { provider: 'ITUNES', externalId: '2', name: 'Frank Ocean', pictureUrl: null },
          releaseDate: '2016-08-20',
          trackCount: 17,
        })
      );
      expect(clean.release.id).toBe(explicit.release.id);
      expect(await prisma.release.count()).toBe(1);
    });

    it('merges by barcode (UPC-A vs EAN-13) even when the dates disagree', async () => {
      const deezer = await resolve('provider=deezer&id=302127');
      const mb = await resolve('provider=musicbrainz&id=0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
      expect(mb.release.id).toBe(deezer.release.id);
      expect(mb.release.externalIds).toMatchObject({
        deezer: '302127',
        musicbrainz: '0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01',
      });
      expect(await prisma.release.count()).toBe(1);
    });

    it('merges by MusicBrainz release id (browsed skeleton, then the full release)', async () => {
      const siblings = await ctx.catalogProviders.musicbrainz.browseReleaseGroupReleases(
        '6e335887-60ba-38f0-95af-fae7774336bf'
      );
      const gb = siblings.find((s) => s.externalId === '0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
      if (!gb) throw new Error('fixture missing');
      expect(gb).toMatchObject({ country: 'GB', format: 'CD', trackCount: 10, tracks: null });
      const skeleton = await importer().importRelease({ ...gb, upc: null });
      const full = await resolve('provider=musicbrainz&id=0a5d4e66-3a5e-4a69-8ad5-1b0f4d1e1a01');
      expect(full.release.id).toBe(skeleton.release.id);
      expect(full.release.tracks).toHaveLength(10);
      expect(full.release.group?.firstYear).toBe(2007);
    });
    it('never enriches a remaster with the MusicBrainz id of the original', async () => {
      const { release } = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '424242',
          title: 'In Rainbows (Remastered)',
          artist: { provider: 'ITUNES', externalId: '657515', name: 'Radiohead', pictureUrl: null },
          releaseDate: '2017-06-23',
          trackCount: 10,
        })
      );
      // The title search returns the 2008 original (fixture): same work, different edition.
      expect(await ctx.catalogEnrichmentService.enrichRelease(release.id)).toBe('no-match');
      const row = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      expect(row.musicbrainzId).toBeNull();
      expect(fixtures.callsTo(/musicbrainz\.org\/ws\/2\/release\?query=release/).length).toBe(1);
    });
  });

  describe('same title, different albums (Weezer)', () => {
    it('imports the 1994 and the 2001 self-titled albums as two albums', async () => {
      const blue = await resolve('provider=deezer&id=7001001');
      const green = await resolve('provider=deezer&id=7001002');
      expect(green.release.id).not.toBe(blue.release.id);
      expect(blue.release.tracks?.map((t) => t.title)).toEqual([
        'My Name Is Jonas',
        'No One Else',
        'Buddy Holly',
      ]);
      expect(green.release.tracks?.map((t) => t.title)).toEqual([
        "Don't Let Go",
        'Photograph',
        'Hash Pipe',
      ]);
      expect(blue.release.group?.id).toBeDefined();
      expect(green.release.group?.id).not.toBe(blue.release.group?.id);
      expect(blue.release.group?.firstYear).toBe(1994);
      expect(green.release.group?.firstYear).toBe(2001);
      expect(await auditCatalog(prisma)).toEqual([]);
    });

    it('never attaches a dateless search hit to an album another provider imported in full', async () => {
      const blue = await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '1440820935',
          title: 'Weezer',
          artist: { provider: 'ITUNES', externalId: '115234', name: 'Weezer', pictureUrl: null },
          releaseDate: '1994-05-10',
          trackCount: 3,
          tracks: tracksFor('ITUNES', 'it-blue-', 3),
        })
      );
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/catalog/search?q=weezer&type=releases',
      });
      const search = SearchResultSchema.parse(res.json());
      expect(search.releases).toHaveLength(2);
      const hit = search.releases.find((r) => r.id !== blue.release.id);
      expect(hit?.externalIds?.deezer).toBe('7001002');
      const blueRow = await prisma.release.findUniqueOrThrow({ where: { id: blue.release.id } });
      expect(blueRow.deezerId).toBeNull();
    });

    it('repairs a seed row that a search hit of another album was attached to', async () => {
      // Dev seed: the 1994 album, no provider ids.
      const seed = await prisma.release.create({
        data: {
          title: 'Weezer',
          artistName: 'Weezer',
          releaseDate: new Date('1994-05-10T00:00:00Z'),
          tracks: {
            create: ['My Name Is Jonas', 'No One Else', 'Buddy Holly'].map((title, i) => ({
              title,
              artistName: 'Weezer',
              durationMs: 200_000,
              trackNumber: i + 1,
              isrc: `ZZOMS2699${String(i).padStart(3, '0')}`,
            })),
          },
        },
      });
      // The dateless Deezer hit for the 2001 album is the only candidate: attached to the seed...
      await ctx.app.inject({ method: 'GET', url: '/api/catalog/search?q=weezer&type=releases' });
      expect((await prisma.release.findUniqueOrThrow({ where: { id: seed.id } })).deezerId).toBe(
        '7001002'
      );

      // ...until opening it fetches the full detail (2001): the id moves to its own album.
      const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${seed.id}` });
      const opened = CatalogReleaseSchema.parse(res.json());
      expect(opened.id).toBe(seed.id);
      expect(opened.tracks?.map((t) => t.title)).toEqual([
        'My Name Is Jonas',
        'No One Else',
        'Buddy Holly',
      ]);
      expect(opened.externalIds?.deezer).toBeNull();
      const green = await prisma.release.findFirstOrThrow({
        where: { deezerId: '7001002' },
        include: { tracks: true },
      });
      expect(green.id).not.toBe(seed.id);
      expect(green.tracks.map((t) => t.title).sort()).toEqual([
        "Don't Let Go",
        'Hash Pipe',
        'Photograph',
      ]);
      expect(green.releaseGroupId).not.toBe(opened.group?.id);
      expect(await auditCatalog(prisma)).toEqual([]);
    });

    it('moves a dateless search hit out of the wrong album once its year is known', async () => {
      const blue = await resolve('provider=deezer&id=7001001');
      // The dateless hit for the 2001 album is filed under the only "Weezer" album known...
      await ctx.app.inject({ method: 'GET', url: '/api/catalog/search?q=weezer&type=releases' });
      const hit = await prisma.release.findFirstOrThrow({ where: { deezerId: '7001002' } });
      expect(hit.releaseDate).toBeNull();

      // ...until opening it fetches the full detail (2001): another album, not an edition of 1994.
      const res = await ctx.app.inject({ method: 'GET', url: `/api/catalog/releases/${hit.id}` });
      const green = CatalogReleaseSchema.parse(res.json());
      expect(green.group?.id).toBeDefined();
      expect(green.group?.id).not.toBe(blue.release.group?.id);
      expect(green.group?.firstYear).toBe(2001);
      const blueGroup = await group(blue.release.group?.id ?? '');
      expect(blueGroup.editions.map((e) => e.id)).toEqual([blue.release.id]);
      expect(blueGroup.firstYear).toBe(1994);
    });

    it('does not guess when two albums could match a search hit', async () => {
      await resolve('provider=deezer&id=7001001');
      await importer().importRelease(
        providerRelease({
          provider: 'ITUNES',
          externalId: '1',
          title: 'Weezer',
          artist: { provider: 'ITUNES', externalId: '115234', name: 'Weezer', pictureUrl: null },
          releaseDate: '2008-06-03',
          trackCount: 3,
        })
      );
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/catalog/search?q=weezer&type=releases&external=true',
      });
      expect(res.statusCode).toBe(200);
      const hit = await prisma.release.findFirstOrThrow({ where: { deezerId: '7001002' } });
      expect(hit.releaseDate).toBeNull();
      expect(await prisma.release.count()).toBe(3);
    });
  });

  describe('API', () => {
    it('GET /releases/:id returns the group, the edition label and the other editions', async () => {
      const original = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '9001',
          title: 'Abbey Road',
          releaseDate: '1969-09-26',
          trackCount: 17,
        })
      );
      const remaster = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '9002',
          title: 'Abbey Road (Remastered 2009)',
          releaseDate: '2009-09-09',
          trackCount: 17,
        })
      );
      // Neither is a skeleton worth hydrating in this test.
      await prisma.release.updateMany({
        data: { metadataSyncedAt: new Date(), enrichedAt: new Date() },
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/catalog/releases/${remaster.release.id}`,
      });
      expect(res.statusCode).toBe(200);
      const release = CatalogReleaseSchema.parse(res.json());
      expect(release).toMatchObject({
        editionLabel: 'Remastered 2009',
        group: { id: original.release.releaseGroupId, title: 'Abbey Road', firstYear: 1969 },
      });
      expect(release.otherEditions).toEqual([
        expect.objectContaining({ id: original.release.id, year: 1969, editionLabel: null }),
      ]);
    });

    it('GET /release-groups/:id lists editions, aggregates scores and syncs MusicBrainz editions', async () => {
      const { release } = await resolve('provider=deezer&id=302127');
      await ctx.catalogBackground.idle(); // MusicBrainz enrichment links the MB release group
      const row = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      const groupId = row.releaseGroupId ?? '';
      const linked = await prisma.releaseGroup.findUniqueOrThrow({ where: { id: groupId } });
      expect(linked).toMatchObject({
        musicbrainzId: '6e335887-60ba-38f0-95af-fae7774336bf',
        title: 'In Rainbows',
        primaryType: 'ALBUM',
        firstReleaseYear: 2007,
      });

      const first = await group(groupId);
      expect(first.editionsSyncing).toBe(true);
      expect(first.editions.map((e) => e.id)).toEqual([release.id]);
      await ctx.catalogBackground.idle();

      const second = await group(groupId);
      expect(second.editionsSyncing).toBe(false);
      // GB/US CDs and the 2007 digital release are pressings of the edition we have; the
      // discbox (28 tracks) is another edition.
      expect(second.editions).toHaveLength(2);
      const discbox = second.editions.find((e) => e.id !== release.id);
      expect(discbox).toMatchObject({
        editionLabel: 'discbox',
        year: 2007,
        country: 'GB',
        format: 'CD + 12" Vinyl',
        trackCount: 28,
      });
      expect(fixtures.callsTo(/release\?release-group=/)).toHaveLength(1);

      // Scores: one vote per user across editions (latest wins), ADR-001 weights.
      const [alice, bob] = [await createUser(), await createUser()];
      await prisma.review.create({ data: { userId: alice.id, releaseId: release.id, rating: 90 } });
      await prisma.review.create({
        data: { userId: alice.id, releaseId: discbox?.id ?? '', rating: 50 },
      });
      await prisma.review.create({ data: { userId: bob.id, releaseId: release.id, rating: 70 } });
      const scored = await group(groupId);
      expect(scored.scores).toMatchObject({
        audienceAvg: 3,
        audienceFreshPct: 50,
        audienceCount: 2,
      });
      expect(scored.scores.criticCount).toBe(0);
      expect(scored.coverUrl).toBe(release.coverUrl);
    });

    it('does not hit MusicBrainz again on every view after a failed editions sync', async () => {
      const { release } = await resolve('provider=deezer&id=302127');
      await ctx.catalogBackground.idle();
      const row = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      fixtures.routes.push({
        match: /musicbrainz\.org\/ws\/2\/release\?release-group=/,
        responses: [{ networkError: true }],
      });

      expect((await group(row.releaseGroupId ?? '')).editionsSyncing).toBe(true);
      await ctx.catalogBackground.idle();
      const attempts = fixtures.callsTo(/release\?release-group=/).length;
      expect(attempts).toBeGreaterThan(0);

      for (let i = 0; i < 3; i++) {
        const again = await group(row.releaseGroupId ?? '');
        expect(again.editionsSyncing).toBe(false);
        await ctx.catalogBackground.idle();
      }
      expect(fixtures.callsTo(/release\?release-group=/)).toHaveLength(attempts);
      const synced = await prisma.releaseGroup.findUniqueOrThrow({
        where: { id: row.releaseGroupId ?? '' },
      });
      expect(synced.editionsSyncedAt).toBeNull();
    });

    it('404s unknown groups and validates the id', async () => {
      const missing = await ctx.app.inject({
        method: 'GET',
        url: '/api/catalog/release-groups/00000000-0000-4000-8000-000000000000',
      });
      expect(missing.statusCode).toBe(404);
      const invalid = await ctx.app.inject({
        method: 'GET',
        url: '/api/catalog/release-groups/nope',
      });
      expect(invalid.statusCode).toBe(400);
    });
  });

  describe('npm run catalog:audit', () => {
    async function mergedRow(withReview: boolean) {
      // What the pre-ADR-012 importer produced for Weezer: both tracklists in one row.
      const release = await prisma.release.create({
        data: {
          title: 'Weezer',
          artistName: 'Weezer',
          deezerId: withReview ? '7001001' : '7001002',
          itunesId: withReview ? '1' : '2',
          trackCount: 3,
          metadataSyncedAt: new Date(),
          tracks: {
            create: ['A', 'B', 'C', 'D', 'E', 'F'].map((title, i) => ({
              title,
              artistName: 'Weezer',
              durationMs: 200_000,
              trackNumber: (i % 3) + 1,
              discNumber: 1,
            })),
          },
        },
      });
      if (withReview) {
        const user = await createUser();
        await prisma.review.create({
          data: { userId: user.id, releaseId: release.id, rating: 80 },
        });
      }
      return release;
    }

    it('repairs release-group keys left by the migration backfill, so new editions join them', async () => {
      // As backfilled: the group key is the release's old match key (NULL on legacy rows).
      const legacy = await prisma.release.create({
        data: {
          title: 'Pinkerton - Deluxe Version',
          artistName: 'Weezer',
          releaseDate: new Date('2010-11-02T00:00:00Z'),
          releaseGroup: {
            create: { title: 'Pinkerton', artistName: 'Weezer', firstReleaseYear: 2010 },
          },
        },
      });
      expect(await repairGroupMatchKeys(prisma, false)).toBe(1);
      expect(await repairGroupMatchKeys(prisma, true)).toBe(1);
      expect(await repairGroupMatchKeys(prisma, false)).toBe(0);

      const original = await importer().importRelease(
        providerRelease({
          provider: 'DEEZER',
          externalId: '9301',
          title: 'Pinkerton',
          artist: { provider: 'DEEZER', externalId: '1', name: 'Weezer', pictureUrl: null },
          releaseDate: '1996-09-24',
          trackCount: 10,
        })
      );
      expect(original.release.id).not.toBe(legacy.id);
      expect(original.release.releaseGroupId).toBe(legacy.releaseGroupId);
      expect(await prisma.releaseGroup.count()).toBe(1);
    });

    it('reports suspicious rows and resets only the ones without user content', async () => {
      const reviewed = await mergedRow(true);
      const orphan = await mergedRow(false);
      const findings = await auditCatalog(prisma);
      expect(findings.map((f) => f.releaseId).sort()).toEqual([reviewed.id, orphan.id].sort());
      const orphanFinding = findings.find((f) => f.releaseId === orphan.id);
      expect(orphanFinding).toMatchObject({
        reasons: ['duplicate-positions', 'more-tracks-than-provider-count'],
        trackRows: 6,
        trackCount: 3,
        userReferences: 0,
        splittable: true,
      });
      expect(findings.find((f) => f.releaseId === reviewed.id)?.splittable).toBe(false);

      expect(await splitRelease(prisma, reviewed.id)).toBe('refused-user-content');
      expect(await splitRelease(prisma, orphan.id)).toBe('reset');
      const reset = await prisma.release.findUniqueOrThrow({
        where: { id: orphan.id },
        include: { tracks: true },
      });
      expect(reset).toMatchObject({ deezerId: '7001002', itunesId: null, metadataSyncedAt: null });
      expect(reset.tracks).toHaveLength(0);

      // Opening it re-imports the single Deezer edition cleanly.
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/catalog/releases/${orphan.id}`,
      });
      const reopened = CatalogReleaseSchema.parse(res.json());
      expect(reopened.tracks?.map((t) => t.title)).toEqual([
        "Don't Let Go",
        'Photograph',
        'Hash Pipe',
      ]);
      expect((await auditCatalog(prisma)).map((f) => f.releaseId)).toEqual([reviewed.id]);
    });
  });
});

/**
 * Replays every migration up to the editions one into a scratch schema with pre-ADR-012 data,
 * then checks the backfill. Runs inside a transaction that is always rolled back.
 */
describe('migration 20261022090000_release_groups_editions (backfill)', () => {
  const MIGRATIONS = path.resolve(__dirname, '../../../packages/db/prisma/migrations');
  const EDITIONS = '20261022090000_release_groups_editions';

  /** Splits a migration into statements (handles `$$` bodies, quotes and `--` comments). */
  function statements(sql: string): string[] {
    const out: string[] = [];
    let current = '';
    let inDollar = false;
    let inQuote = false;
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (!inDollar && !inQuote && ch === '-' && sql[i + 1] === '-') {
        const end = sql.indexOf('\n', i);
        i = end === -1 ? sql.length : end;
        current += '\n';
        continue;
      }
      if (!inQuote && ch === '$' && sql[i + 1] === '$') {
        inDollar = !inDollar;
        current += '$$';
        i++;
        continue;
      }
      if (!inDollar && ch === "'") inQuote = !inQuote;
      if (!inDollar && !inQuote && ch === ';') {
        if (current.trim()) out.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) out.push(current.trim());
    return out;
  }

  class Rollback extends Error {}

  async function run(tx: Prisma.TransactionClient, dir: string): Promise<void> {
    const sql = readFileSync(path.join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
    for (const statement of statements(sql)) await tx.$executeRawUnsafe(statement);
  }

  it('creates one group per release, merging releases that share a MusicBrainz release group', async () => {
    const dirs = readdirSync(MIGRATIONS)
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    const before = dirs.filter((d) => d < EDITIONS);
    let rows: Array<{
      id: string;
      groupTitle: string;
      firstYear: number | null;
      mb: string | null;
      groupId: string;
    }> = [];
    let groupCount = 0;

    await prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('CREATE SCHEMA editions_backfill_test');
          await tx.$executeRawUnsafe('SET LOCAL search_path TO editions_backfill_test');
          for (const dir of before) await run(tx, dir);
          await tx.$executeRawUnsafe(`
            INSERT INTO "Release"(id, title, "artistName", "releaseDate", "musicbrainzReleaseGroupId", "matchKey") VALUES
            ('abbey-1969', 'Abbey Road', 'The Beatles', '1969-09-26', '9e8c2a6e-0000-4000-8000-000000000001', 'beatles|abbey road'),
            ('abbey-2009', 'Abbey Road (Remastered 2009)', 'The Beatles', '2009-09-09', '9e8c2a6e-0000-4000-8000-000000000001', 'beatles|abbey road'),
            ('weezer-1994', 'Weezer', 'Weezer', '1994-05-10', NULL, 'weezer|weezer'),
            ('weezer-2001', 'Weezer', 'Weezer', '2001-05-15', NULL, 'weezer|weezer'),
            ('nevermind-sd', 'Nevermind (Super Deluxe Edition) - Remastered 2011', 'Nirvana', NULL, NULL, NULL)`);
          await run(tx, EDITIONS);
          rows = await tx.$queryRawUnsafe(`
            SELECT r.id, g.id AS "groupId", g.title AS "groupTitle", g."firstReleaseYear" AS "firstYear",
                   g."musicbrainzId" AS mb
            FROM "Release" r JOIN "ReleaseGroup" g ON g.id = r."releaseGroupId" ORDER BY r.id`);
          const [count] = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
            'SELECT COUNT(*) AS n FROM "ReleaseGroup"'
          );
          groupCount = Number(count?.n ?? 0);
          throw new Rollback();
        },
        { timeout: 60_000 }
      )
      .catch((err: unknown) => {
        if (!(err instanceof Rollback)) throw err;
      });

    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(rows).toHaveLength(5);
    expect(groupCount).toBe(4);
    expect(byId['abbey-1969']?.groupId).toBe(byId['abbey-2009']?.groupId);
    expect(byId['abbey-1969']).toMatchObject({
      groupTitle: 'Abbey Road',
      firstYear: 1969,
      mb: '9e8c2a6e-0000-4000-8000-000000000001',
    });
    expect(byId['weezer-1994']?.groupId).not.toBe(byId['weezer-2001']?.groupId);
    expect(byId['weezer-2001']).toMatchObject({ groupTitle: 'Weezer', firstYear: 2001, mb: null });
    expect(byId['nevermind-sd']).toMatchObject({ groupTitle: 'Nevermind', firstYear: null });
    // The scratch schema was rolled back with the transaction.
    const schemas = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM information_schema.schemata WHERE schema_name = 'editions_backfill_test'`;
    expect(Number(schemas[0]?.n)).toBe(0);
  });
});
