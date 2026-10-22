import type { Prisma, PrismaClient, Release } from '@openmusic/db';
import {
  catalogMatchKey,
  compareEditions,
  editionMatchKey,
  normalizeBarcode,
  normalizeIsrc,
  parseEdition,
  releaseYear,
} from '@openmusic/shared';
import type { CatalogImportService } from './catalog-import.service';
import { mergeGenres, rowFacts, toDate } from './catalog-import.service';
import type { CatalogProviders } from './providers';
import type { MusicBrainzReleaseHit } from './providers/musicbrainz.provider';

/** Minimum MusicBrainz search score (0-100) for a title + artist match. */
const MIN_TITLE_SCORE = 90;
const MIN_BARCODE_SCORE = 80;
/** A release that found no MusicBrainz match is retried after this long. */
export const ENRICHMENT_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

export type EnrichmentOutcome = 'enriched' | 'no-match' | 'skipped';

/** At most this many sibling editions are imported per group sync (ADR-012). */
export const MAX_SIBLING_EDITIONS = 25;

/**
 * Canonical enrichment from MusicBrainz (MBIDs, release group, label, genres from votes, edition
 * facts: country, format, status, disambiguation) and a fallback cover from the Cover Art Archive.
 * MusicBrainz is the source of truth for identity (ADR-012): the release group it reports decides
 * which ReleaseGroup the edition belongs to. MusicBrainz allows 1 request/second, so this runs in
 * the background (after search/open) or inside the import script, never on a hot path.
 */
export class CatalogEnrichmentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly providers: Pick<CatalogProviders, 'musicbrainz' | 'coverArt'>,
    private readonly importer: CatalogImportService
  ) {}

  needsEnrichment(release: Pick<Release, 'enrichedAt'>, now = Date.now()): boolean {
    return !release.enrichedAt || now - release.enrichedAt.getTime() > ENRICHMENT_RETRY_MS;
  }

  async enrichRelease(releaseId: string): Promise<EnrichmentOutcome> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: { tracks: { select: { isrc: true }, take: 3, orderBy: { trackNumber: 'asc' } } },
    });
    if (!release) return 'skipped';

    const mbid = release.musicbrainzId ?? (await this.findMusicBrainzRelease(release));
    if (!mbid) {
      await this.prisma.release.update({
        where: { id: release.id },
        data: { enrichedAt: new Date() },
      });
      return 'no-match';
    }

    const mb = await this.providers.musicbrainz.getRelease(mbid);
    if (!mb) {
      await this.prisma.release.update({
        where: { id: release.id },
        data: { enrichedAt: new Date() },
      });
      return 'no-match';
    }

    let genres = mb.genres;
    let releaseGroup = mb.releaseGroup ?? null;
    if (genres.length === 0 && mb.musicbrainzReleaseGroupId) {
      const rg = await this.providers.musicbrainz.getReleaseGroup(mb.musicbrainzReleaseGroupId);
      if (rg) {
        genres = rg.genres;
        releaseGroup = rg;
      }
    }

    // Same release row: merge MusicBrainz ids/metadata without touching title or cover.
    const data: Prisma.ReleaseUpdateInput = { enrichedAt: new Date() };
    if (!release.musicbrainzId) data.musicbrainzId = mb.externalId;
    if (!release.musicbrainzReleaseGroupId && mb.musicbrainzReleaseGroupId) {
      data.musicbrainzReleaseGroupId = mb.musicbrainzReleaseGroupId;
    }
    if (!release.label && mb.label) data.label = mb.label;
    const upc = normalizeBarcode(mb.upc);
    if (!release.upc && upc) data.upc = upc;
    const releaseDate = toDate(mb.releaseDate);
    if (!release.releaseDate && releaseDate) data.releaseDate = releaseDate;
    const merged = mergeGenres(release.genres, genres);
    if (merged.join('|') !== release.genres.join('|')) data.genres = merged;
    if (!release.disambiguation && mb.disambiguation) data.disambiguation = mb.disambiguation;
    if (!release.country && mb.country) data.country = mb.country;
    if (!release.format && mb.format) data.format = mb.format;
    if (!release.releaseStatus && mb.status) data.releaseStatus = mb.status;
    if (!release.editionLabel) {
      const label =
        parseEdition(release.title, mb.disambiguation).label ??
        parseEdition(mb.title, mb.disambiguation).label;
      if (label) data.editionLabel = label;
    }

    try {
      await this.prisma.release.update({ where: { id: release.id }, data });
    } catch {
      // The MBID/UPC belongs to another local row (duplicate edition): keep the metadata only.
      delete data.musicbrainzId;
      delete data.upc;
      await this.prisma.release.update({ where: { id: release.id }, data });
    }

    if (releaseGroup) {
      await this.importer.attachToMusicBrainzGroup(release.id, releaseGroup);
    }
    await this.linkRecordings(release.id, mb.tracks ?? []);

    if (!release.coverUrl && mb.hasFrontCover) {
      const cover =
        (await this.providers.coverArt.getFrontCover(mb.externalId)) ??
        (mb.musicbrainzReleaseGroupId
          ? await this.providers.coverArt.getFrontCover(
              mb.musicbrainzReleaseGroupId,
              'release-group'
            )
          : null);
      if (cover) {
        await this.prisma.release.update({
          where: { id: release.id },
          data: { coverUrl: cover.url, coverSource: 'COVER_ART_ARCHIVE', dominantColor: '#26262B' },
        });
        await this.importer.refreshDominantColor(release.id).catch(() => null);
      }
    }
    return 'enriched';
  }

  /**
   * Imports the other official editions of a MusicBrainz release group as separate (skeleton)
   * releases of the same group. MusicBrainz lists every pressing (country, format, label): only
   * one per distinct edition (title markers + year + track count) is imported, oldest first,
   * capped at MAX_SIBLING_EDITIONS. Tracklists are fetched when an edition is opened.
   */
  async syncGroupEditions(groupId: string): Promise<number> {
    const group = await this.prisma.releaseGroup.findUnique({
      where: { id: groupId },
      include: { releases: true },
    });
    if (!group?.musicbrainzId) return 0;
    const siblings = await this.providers.musicbrainz.browseReleaseGroupReleases(
      group.musicbrainzId
    );
    const editionKey = (
      title: string,
      artist: string,
      disambiguation: string | null | undefined,
      year: number | null,
      trackCount: number | null | undefined
    ) => `${editionMatchKey(title, artist, disambiguation)}|${year ?? ''}|${trackCount ?? ''}`;

    const known = new Set(group.releases.map((r) => r.musicbrainzId).filter(Boolean));
    const seen = new Set(
      group.releases.map((r) =>
        editionKey(
          r.title,
          r.artistName,
          r.disambiguation,
          releaseYear(r.releaseDate),
          r.trackCount
        )
      )
    );
    const ordered = [...siblings].sort((a, b) =>
      (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999')
    );
    const siblingKey = (sibling: (typeof siblings)[number]) =>
      editionKey(
        sibling.title,
        sibling.artist.name,
        sibling.disambiguation,
        releaseYear(sibling.releaseDate),
        sibling.trackCount
      );
    // Pressings of an edition we already have (other country, format, label) are not imported.
    for (const sibling of siblings) {
      if (known.has(sibling.externalId)) seen.add(siblingKey(sibling));
    }
    let imported = 0;
    for (const sibling of ordered) {
      if (imported >= MAX_SIBLING_EDITIONS) break;
      if (known.has(sibling.externalId)) continue;
      const key = siblingKey(sibling);
      if (seen.has(key)) continue;
      seen.add(key);
      await this.importer.importRelease(sibling);
      imported++;
    }
    await this.prisma.releaseGroup.update({
      where: { id: group.id },
      data: { editionsSyncedAt: new Date() },
    });
    return imported;
  }

  /**
   * Barcode first, then the ISRC of an early track, then title + artist. Title matches must be
   * the same EDITION (ADR-012): same title including edition markers and no conflicting year or
   * track count, so a remaster is never enriched with the original's MBID (or vice versa).
   */
  private async findMusicBrainzRelease(
    release: Release & { tracks: Array<{ isrc: string | null }> }
  ): Promise<string | null> {
    const facts = rowFacts(release);
    const sameEdition = (hit: MusicBrainzReleaseHit) => {
      const verdict = compareEditions(
        { ...facts, upc: null, musicbrainzId: null, deezerId: null, itunesId: null },
        {
          title: hit.title,
          artistName: hit.artistName,
          disambiguation: hit.disambiguation,
          musicbrainzReleaseGroupId: hit.releaseGroupId,
          year: releaseYear(hit.date),
          trackCount: hit.trackCount,
        }
      );
      return verdict === 'same-edition' || verdict === 'compatible';
    };

    if (release.upc) {
      const upc = normalizeBarcode(release.upc);
      const hits = await this.providers.musicbrainz.searchReleases({ barcode: release.upc });
      const hit = hits.find(
        (h) => h.score >= MIN_BARCODE_SCORE && (!h.barcode || normalizeBarcode(h.barcode) === upc)
      );
      if (hit) return hit.mbid;
    }

    const isrc = release.tracks
      .map((t) => normalizeIsrc(t.isrc))
      .find((code): code is string => code !== null && !code.startsWith('ZZOMS'));
    if (isrc) {
      const recordings = await this.providers.musicbrainz.lookupIsrc(isrc);
      const releaseIds = recordings.flatMap((r) => r.releaseIds);
      if (releaseIds.length > 0) {
        // The ISRC lookup only lists ids (the recording is on every edition that reuses it):
        // pick the one that is the same edition as ours.
        const hits = await this.providers.musicbrainz.searchReleases({
          title: release.title,
          artist: release.artistName,
        });
        const hit = hits.find((h) => releaseIds.includes(h.mbid) && sameEdition(h));
        if (hit) return hit.mbid;
      }
    }

    const key = catalogMatchKey(release.title, release.artistName);
    const hits = await this.providers.musicbrainz.searchReleases({
      title: release.title,
      artist: release.artistName,
    });
    const hit = hits.find(
      (h) =>
        h.score >= MIN_TITLE_SCORE &&
        catalogMatchKey(h.title, h.artistName) === key &&
        sameEdition(h)
    );
    return hit?.mbid ?? null;
  }

  /** Sets recording MBIDs on local tracks matched by ISRC or by title inside the release. */
  private async linkRecordings(
    releaseId: string,
    recordings: ReadonlyArray<{
      musicbrainzId?: string | null;
      isrc: string | null;
      title: string;
      artist: { name: string };
    }>
  ): Promise<void> {
    const tracks = await this.prisma.track.findMany({
      where: { releaseId, musicbrainzId: null },
      select: { id: true, isrc: true, title: true, artistName: true },
    });
    for (const track of tracks) {
      const key = catalogMatchKey(track.title, track.artistName);
      const recording =
        recordings.find((r) => r.isrc && r.isrc === track.isrc) ??
        recordings.find((r) => catalogMatchKey(r.title, track.artistName) === key);
      if (!recording?.musicbrainzId) continue;
      await this.prisma.track
        .update({ where: { id: track.id }, data: { musicbrainzId: recording.musicbrainzId } })
        .catch(() => null); // MBID already on another row (same recording on two releases)
    }
  }
}
