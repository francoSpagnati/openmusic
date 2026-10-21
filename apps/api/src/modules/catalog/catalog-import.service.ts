import {
  Prisma,
  type CatalogSource,
  type PrismaClient,
  type Release,
  type Track,
} from '@openmusic/db';
import {
  catalogMatchKey,
  normalizeBarcode,
  normalizeCatalogArtist,
  normalizeIsrc,
} from '@openmusic/shared';
import { dominantColorOf } from '../../lib/dominant-color';
import type { CatalogProviders } from './providers';
import type {
  ProviderArtist,
  ProviderName,
  ProviderRelease,
  ProviderTrack,
} from './providers/types';

/** ISRCs written by the dev seed use the fictional `ZZOMS` registrant: real codes replace them. */
const PLACEHOLDER_ISRC_PREFIX = 'ZZOMS';
const MAX_GENRES = 5;
const DEFAULT_DOMINANT_COLOR = '#26262B';
/** Cover images above this size are not downloaded for the dominant color. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Preference when two databases offer a cover: Deezer 1000px > iTunes 1000px > CAA. */
const COVER_RANK: Record<CatalogSource, number> = {
  DEEZER: 3,
  ITUNES: 2,
  COVER_ART_ARCHIVE: 1,
  MUSICBRAINZ: 0,
};

type ExternalIdField = 'deezerId' | 'itunesId' | 'musicbrainzId';

function idField(provider: ProviderName): ExternalIdField | null {
  switch (provider) {
    case 'DEEZER':
      return 'deezerId';
    case 'ITUNES':
      return 'itunesId';
    case 'MUSICBRAINZ':
      return 'musicbrainzId';
    default:
      return null;
  }
}

/** `YYYY`, `YYYY-MM`, `YYYY-MM-DD` -> UTC date (first day of the missing parts). */
export function toDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-');
  const date = new Date(Date.UTC(Number(y), Number(m ?? '1') - 1, Number(d ?? '1')));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mergeGenres(existing: readonly string[], incoming: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const genre of [...existing, ...incoming]) {
    const key = genre.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(genre.trim());
    if (result.length === MAX_GENRES) break;
  }
  return result;
}

/** Unique-constraint violation: returns the conflicting columns (empty when unknown). */
function uniqueConflict(err: unknown): string[] | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === 'string');
  if (typeof target === 'string') return [target];
  return [];
}

/**
 * Runs a create/update and, when an optional unique column (external id, ISRC, UPC) is already
 * taken by another row, retries without that column instead of failing the whole import. Two
 * imports racing on the same row resolve the same way.
 */
async function writeDroppingConflicts<T, D extends object>(
  data: D,
  optionalUnique: ReadonlyArray<keyof D & string>,
  write: (data: D) => Promise<T>
): Promise<T> {
  let current = { ...data };
  for (let attempt = 0; attempt <= optionalUnique.length; attempt++) {
    try {
      return await write(current);
    } catch (err) {
      const conflict = uniqueConflict(err);
      if (conflict === null) throw err;
      const droppable = optionalUnique.filter(
        (field) => current[field] !== undefined && current[field] !== null
      );
      const toDrop = droppable.filter((field) => conflict.some((c) => c.includes(field)));
      const fields = toDrop.length > 0 ? toDrop : droppable.slice(0, 1);
      if (fields.length === 0) throw err;
      const next = { ...current };
      for (const field of fields) delete next[field];
      current = next;
    }
  }
  return write(current);
}

export interface ImportedRelease {
  release: Release;
  /** Internal track ids in provider order (only when the provider release had a tracklist). */
  trackIds: string[];
}

/**
 * Turns provider results into local rows with internal UUIDs. Every import is an upsert keyed by
 * (in order) the provider's id, the barcode / ISRC, then the normalized title + artist, so
 * importing the same album from Deezer, iTunes and MusicBrainz converges to ONE release row and
 * repeated imports are no-ops.
 */
export class CatalogImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly providers: Pick<CatalogProviders, 'images' | 'thumbnailFor'>
  ) {}

  // -- Artists -----------------------------------------------------------------------------

  async upsertArtist(artist: ProviderArtist): Promise<string> {
    const field = idField(artist.provider);
    const matchKey = normalizeCatalogArtist(artist.name);
    let existing =
      field && artist.externalId
        ? await this.prisma.artist.findFirst({ where: { [field]: artist.externalId } })
        : null;
    if (!existing) {
      const candidate = await this.prisma.artist.findFirst({
        where: { matchKey },
        orderBy: { createdAt: 'asc' },
      });
      // Same name but a different id in the same database = a different artist (homonyms).
      if (candidate && !(field && candidate[field] && candidate[field] !== artist.externalId)) {
        existing = candidate;
      }
    }

    if (existing) {
      const data: Prisma.ArtistUpdateInput = {};
      if (field && artist.externalId && !existing[field]) data[field] = artist.externalId;
      if (!existing.pictureUrl && artist.pictureUrl) data.pictureUrl = artist.pictureUrl;
      if (Object.keys(data).length === 0) return existing.id;
      const id = existing.id;
      const updated = await writeDroppingConflicts(
        data,
        ['deezerId', 'itunesId', 'musicbrainzId'],
        (d) => this.prisma.artist.update({ where: { id }, data: d })
      );
      return updated.id;
    }

    const create: Prisma.ArtistCreateInput = {
      name: artist.name,
      matchKey,
      pictureUrl: artist.pictureUrl,
      ...(field && artist.externalId ? { [field]: artist.externalId } : {}),
    };
    try {
      return (await this.prisma.artist.create({ data: create })).id;
    } catch (err) {
      if (uniqueConflict(err) === null || !field || !artist.externalId) throw err;
      // Lost a race with a concurrent import of the same artist.
      const winner = await this.prisma.artist.findFirst({ where: { [field]: artist.externalId } });
      if (!winner) throw err;
      return winner.id;
    }
  }

  // -- Releases ----------------------------------------------------------------------------

  /** Finds the local row for a provider release, without writing. */
  async findExistingRelease(pr: ProviderRelease): Promise<Release | null> {
    const field = idField(pr.provider);
    if (field) {
      const byId = await this.prisma.release.findFirst({ where: { [field]: pr.externalId } });
      if (byId) return byId;
    }
    const upc = normalizeBarcode(pr.upc);
    if (upc) {
      const byUpc = await this.prisma.release.findUnique({ where: { upc } });
      if (byUpc) return byUpc;
    }
    const matchKey = catalogMatchKey(pr.title, pr.artist.name);
    const byKey = await this.prisma.release.findFirst({
      where: { matchKey },
      orderBy: { createdAt: 'asc' },
    });
    if (byKey) return byKey;
    // Rows created before match keys existed (seed, legacy imports).
    const legacy = await this.prisma.release.findMany({
      where: {
        matchKey: null,
        title: { equals: pr.title, mode: 'insensitive' },
      },
      take: 10,
    });
    return legacy.find((r) => catalogMatchKey(r.title, r.artistName) === matchKey) ?? null;
  }

  /**
   * Upserts a release and, when `pr.tracks` is present, its tracklist. `pr.tracks !== null`
   * marks the import as "full" (metadataSyncedAt is set).
   */
  async importRelease(pr: ProviderRelease): Promise<ImportedRelease> {
    const artistId = await this.upsertArtist(pr.artist);
    const existing = await this.findExistingRelease(pr);
    const field = idField(pr.provider);
    const full = pr.tracks !== null;
    const upc = normalizeBarcode(pr.upc);
    const matchKey = catalogMatchKey(pr.title, pr.artist.name);
    const coverSource: CatalogSource | null =
      pr.provider === 'MUSICBRAINZ' ? null : (pr.provider as CatalogSource);

    let release: Release;
    if (!existing) {
      const data: Prisma.ReleaseUncheckedCreateInput = {
        title: pr.title,
        artistName: pr.artist.name,
        artistId,
        releaseType: pr.releaseType,
        coverUrl: pr.coverUrl,
        coverSource: pr.coverUrl ? coverSource : null,
        dominantColor: DEFAULT_DOMINANT_COLOR,
        genres: mergeGenres([], pr.genres),
        releaseDate: toDate(pr.releaseDate),
        label: pr.label,
        trackCount: pr.trackCount,
        upc,
        matchKey,
        musicbrainzReleaseGroupId: pr.musicbrainzReleaseGroupId ?? null,
        metadataSyncedAt: full ? new Date() : null,
        ...(field ? { [field]: pr.externalId } : {}),
      };
      try {
        release = await writeDroppingConflicts(
          data,
          ['upc', 'deezerId', 'itunesId', 'musicbrainzId'],
          (d) => this.prisma.release.create({ data: d })
        );
      } catch (err) {
        if (uniqueConflict(err) === null) throw err;
        const winner = await this.findExistingRelease(pr);
        if (!winner) throw err;
        release = await this.mergeRelease(winner, pr, artistId);
      }
    } else {
      release = await this.mergeRelease(existing, pr, artistId);
    }

    const trackIds = pr.tracks ? await this.importTracks(release, pr.tracks) : [];
    return { release, trackIds };
  }

  private async mergeRelease(
    existing: Release,
    pr: ProviderRelease,
    artistId: string
  ): Promise<Release> {
    const field = idField(pr.provider);
    const full = pr.tracks !== null;
    // Seed / hand-made rows have no provider ids: real data replaces their placeholders.
    const placeholder =
      !existing.deezerId && !existing.itunesId && !existing.musicbrainzId && !existing.coverSource;
    // A search hit never synced in full can be corrected by the first full import.
    const authoritative = placeholder || (full && !existing.metadataSyncedAt);
    const coverSource: CatalogSource | null =
      pr.provider === 'MUSICBRAINZ' ? null : (pr.provider as CatalogSource);

    const data: Prisma.ReleaseUncheckedUpdateInput = {};
    if (field && !existing[field]) data[field] = pr.externalId;
    const upc = normalizeBarcode(pr.upc);
    if (upc && !existing.upc) data.upc = upc;
    if (!existing.artistId) data.artistId = artistId;
    if (!existing.matchKey) data.matchKey = catalogMatchKey(existing.title, existing.artistName);
    if (pr.musicbrainzReleaseGroupId && !existing.musicbrainzReleaseGroupId) {
      data.musicbrainzReleaseGroupId = pr.musicbrainzReleaseGroupId;
    }

    if (pr.coverUrl && coverSource) {
      const currentRank = existing.coverSource ? COVER_RANK[existing.coverSource] : -1;
      if (!existing.coverUrl || placeholder || COVER_RANK[coverSource] > currentRank) {
        if (existing.coverUrl !== pr.coverUrl) {
          data.coverUrl = pr.coverUrl;
          data.coverSource = coverSource;
          data.dominantColor = DEFAULT_DOMINANT_COLOR; // recomputed from the new cover
        }
      }
    }

    const releaseDate = toDate(pr.releaseDate);
    if (releaseDate && (!existing.releaseDate || authoritative)) data.releaseDate = releaseDate;
    if (pr.label && (!existing.label || authoritative)) data.label = pr.label;
    if (pr.trackCount && (!existing.trackCount || authoritative)) data.trackCount = pr.trackCount;
    if (authoritative && !placeholder) data.releaseType = pr.releaseType;
    if (pr.genres.length > 0) {
      const genres = mergeGenres(existing.genres, pr.genres);
      if (genres.join('|') !== existing.genres.join('|')) data.genres = genres;
    }
    if (full) data.metadataSyncedAt = new Date();

    if (Object.keys(data).length === 0) return existing;
    const id = existing.id;
    return writeDroppingConflicts(data, ['upc', 'deezerId', 'itunesId', 'musicbrainzId'], (d) =>
      this.prisma.release.update({ where: { id }, data: d })
    );
  }

  // -- Tracks ------------------------------------------------------------------------------

  /** Upserts tracks into `release`; returns their internal ids in the same order. */
  async importTracks(
    release: Pick<Release, 'id'>,
    tracks: readonly ProviderTrack[]
  ): Promise<string[]> {
    const artistIds = new Map<string, string>();
    const ids: string[] = [];
    for (const pt of tracks) {
      const artistKey = `${pt.artist.provider}:${pt.artist.externalId ?? pt.artist.name}`;
      let artistId = artistIds.get(artistKey);
      if (!artistId) {
        artistId = await this.upsertArtist(pt.artist);
        artistIds.set(artistKey, artistId);
      }
      ids.push(await this.upsertTrack(release.id, pt, artistId));
    }
    return ids;
  }

  private async findExistingTrack(releaseId: string, pt: ProviderTrack): Promise<Track | null> {
    const field = idField(pt.provider);
    const externalId = pt.musicbrainzId ?? pt.externalId;
    if (field) {
      const byId = await this.prisma.track.findFirst({ where: { [field]: externalId } });
      if (byId && byId.releaseId === releaseId) return byId;
    }
    const isrc = normalizeIsrc(pt.isrc);
    if (isrc) {
      const byIsrc = await this.prisma.track.findUnique({ where: { isrc } });
      if (byIsrc && byIsrc.releaseId === releaseId) return byIsrc;
    }
    const matchKey = catalogMatchKey(pt.title, pt.artist.name);
    const byKey = await this.prisma.track.findFirst({ where: { releaseId, matchKey } });
    if (byKey) return byKey;
    const legacy = await this.prisma.track.findMany({ where: { releaseId, matchKey: null } });
    return (
      legacy.find(
        (t) =>
          catalogMatchKey(t.title, t.artistName) === matchKey ||
          // Seed tracks credit the album artist; providers may add featured artists.
          catalogMatchKey(t.title, pt.artist.name) === matchKey
      ) ?? null
    );
  }

  private async upsertTrack(
    releaseId: string,
    pt: ProviderTrack,
    artistId: string
  ): Promise<string> {
    const field = idField(pt.provider);
    const externalId = pt.musicbrainzId ?? pt.externalId;
    const isrc = normalizeIsrc(pt.isrc);
    const existing = await this.findExistingTrack(releaseId, pt);

    if (!existing) {
      const data: Prisma.TrackUncheckedCreateInput = {
        releaseId,
        title: pt.title,
        artistName: pt.artist.name,
        artistId,
        durationMs: pt.durationMs,
        trackNumber: pt.trackNumber,
        discNumber: pt.discNumber,
        previewUrl: pt.previewUrl,
        isrc,
        matchKey: catalogMatchKey(pt.title, pt.artist.name),
        ...(field ? { [field]: externalId } : {}),
      };
      const created = await writeDroppingConflicts(
        data,
        ['isrc', 'deezerId', 'itunesId', 'musicbrainzId'],
        (d) => this.prisma.track.create({ data: d })
      );
      return created.id;
    }

    const data: Prisma.TrackUncheckedUpdateInput = {};
    if (field && !existing[field]) data[field] = externalId;
    if (isrc && (!existing.isrc || existing.isrc.startsWith(PLACEHOLDER_ISRC_PREFIX))) {
      if (existing.isrc !== isrc) data.isrc = isrc;
    }
    if (!existing.matchKey) data.matchKey = catalogMatchKey(existing.title, existing.artistName);
    if (!existing.artistId) data.artistId = artistId;
    if (pt.trackNumber && !existing.trackNumber) data.trackNumber = pt.trackNumber;
    if (pt.discNumber && !existing.discNumber) data.discNumber = pt.discNumber;
    if (pt.previewUrl && !existing.previewUrl) data.previewUrl = pt.previewUrl;
    // Seed durations are rounded guesses: a provider's exact length wins once.
    if (existing.isrc?.startsWith(PLACEHOLDER_ISRC_PREFIX) && pt.provider !== 'MUSICBRAINZ') {
      data.durationMs = pt.durationMs;
    }
    if (Object.keys(data).length === 0) return existing.id;
    const id = existing.id;
    const updated = await writeDroppingConflicts(
      data,
      ['isrc', 'deezerId', 'itunesId', 'musicbrainzId'],
      (d) => this.prisma.track.update({ where: { id }, data: d })
    );
    return updated.id;
  }

  /**
   * A search hit for a track: imports a skeleton of its album (no tracklist yet) and the track.
   */
  async importTrackHit(pt: ProviderTrack): Promise<{ releaseId: string; trackId: string } | null> {
    if (!pt.release) return null;
    const { release } = await this.importRelease({
      provider: pt.release.provider,
      externalId: pt.release.externalId,
      title: pt.release.title,
      artist: pt.artist,
      releaseType: 'ALBUM',
      coverUrl: pt.release.coverUrl,
      releaseDate: null,
      genres: [],
      label: null,
      upc: null,
      trackCount: null,
      tracks: null,
    });
    const [trackId] = await this.importTracks(release, [pt]);
    return trackId ? { releaseId: release.id, trackId } : null;
  }

  // -- Dominant color ----------------------------------------------------------------------

  /**
   * Samples a small copy of the cover and stores its dominant color. Returns the color, or null
   * when the image cannot be fetched/decoded (the default color stays).
   */
  async refreshDominantColor(releaseId: string): Promise<string | null> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      select: { coverUrl: true },
    });
    if (!release?.coverUrl) return null;
    const imageUrl = this.providers.thumbnailFor(release.coverUrl);
    if (!imageUrl) return null;
    const bytes = await this.providers.images.getBytes(imageUrl, MAX_IMAGE_BYTES);
    if (!bytes) return null;
    const color = dominantColorOf(bytes);
    if (!color) return null;
    // Only if the cover did not change meanwhile.
    await this.prisma.release.updateMany({
      where: { id: releaseId, coverUrl: release.coverUrl },
      data: { dominantColor: color },
    });
    return color;
  }
}
