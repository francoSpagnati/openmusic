import type { Prisma, PrismaClient, Release } from '@openmusic/db';
import { catalogMatchKey, normalizeBarcode, normalizeIsrc } from '@openmusic/shared';
import type { CatalogImportService } from './catalog-import.service';
import { mergeGenres, toDate } from './catalog-import.service';
import type { CatalogProviders } from './providers';
import type { MusicBrainzReleaseHit } from './providers/musicbrainz.provider';

/** Minimum MusicBrainz search score (0-100) for a title + artist match. */
const MIN_TITLE_SCORE = 90;
const MIN_BARCODE_SCORE = 80;
/** A release that found no MusicBrainz match is retried after this long. */
export const ENRICHMENT_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

export type EnrichmentOutcome = 'enriched' | 'no-match' | 'skipped';

/**
 * Canonical enrichment from MusicBrainz (MBIDs, release group, label, genres from votes) and a
 * fallback cover from the Cover Art Archive. MusicBrainz allows 1 request/second, so this runs in
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
    if (genres.length === 0 && mb.musicbrainzReleaseGroupId) {
      genres = await this.providers.musicbrainz.getReleaseGroupGenres(mb.musicbrainzReleaseGroupId);
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

    try {
      await this.prisma.release.update({ where: { id: release.id }, data });
    } catch {
      // The MBID/UPC belongs to another local row (duplicate edition): keep the metadata only.
      delete data.musicbrainzId;
      delete data.upc;
      await this.prisma.release.update({ where: { id: release.id }, data });
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

  /** Barcode first, then the ISRC of an early track, then title + artist. */
  private async findMusicBrainzRelease(
    release: Release & { tracks: Array<{ isrc: string | null }> }
  ): Promise<string | null> {
    const key = catalogMatchKey(release.title, release.artistName);
    const sameRelease = (hit: MusicBrainzReleaseHit) =>
      catalogMatchKey(hit.title, hit.artistName) === key;

    if (release.upc) {
      const hits = await this.providers.musicbrainz.searchReleases({ barcode: release.upc });
      const hit = hits.find((h) => h.score >= MIN_BARCODE_SCORE);
      if (hit) return hit.mbid;
    }

    const isrc = release.tracks
      .map((t) => normalizeIsrc(t.isrc))
      .find((code): code is string => code !== null && !code.startsWith('ZZOMS'));
    if (isrc) {
      const recordings = await this.providers.musicbrainz.lookupIsrc(isrc);
      const releaseIds = recordings.flatMap((r) => r.releaseIds);
      if (releaseIds.length > 0) {
        // The ISRC lookup only lists ids: confirm the title with a search restricted to them.
        const hits = await this.providers.musicbrainz.searchReleases({
          title: release.title,
          artist: release.artistName,
        });
        const hit = hits.find((h) => releaseIds.includes(h.mbid)) ?? hits.find(sameRelease);
        if (hit && (releaseIds.includes(hit.mbid) || hit.score >= MIN_TITLE_SCORE)) return hit.mbid;
      }
    }

    const hits = await this.providers.musicbrainz.searchReleases({
      title: release.title,
      artist: release.artistName,
    });
    const hit = hits.find((h) => h.score >= MIN_TITLE_SCORE && sameRelease(h));
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
