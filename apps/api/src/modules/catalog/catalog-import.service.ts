import {
  Prisma,
  type CatalogSource,
  type PrismaClient,
  type Release,
  type Track,
} from '@openmusic/db';
import {
  catalogMatchKey,
  compareEditions,
  editionMatchKey,
  normalizeBarcode,
  normalizeCatalogArtist,
  normalizeIsrc,
  parseEdition,
  releaseGroupMatchKey,
  releaseYear,
  type EditionFacts,
} from '@openmusic/shared';
import { dominantColorOf } from '../../lib/dominant-color';
import { KeyedMutex } from '../../lib/keyed-mutex';
import type { CatalogProviders } from './providers';
import type {
  ProviderArtist,
  ProviderName,
  ProviderRelease,
  ProviderReleaseGroup,
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

function groupMbidOf(pr: ProviderRelease): string | null {
  return pr.releaseGroup?.musicbrainzId ?? pr.musicbrainzReleaseGroupId ?? null;
}

export function providerFacts(pr: ProviderRelease): EditionFacts {
  return {
    title: pr.title,
    artistName: pr.artist.name,
    disambiguation: pr.disambiguation,
    upc: pr.upc,
    musicbrainzId: pr.provider === 'MUSICBRAINZ' ? pr.externalId : null,
    musicbrainzReleaseGroupId: groupMbidOf(pr),
    deezerId: pr.provider === 'DEEZER' ? pr.externalId : null,
    itunesId: pr.provider === 'ITUNES' ? pr.externalId : null,
    year: releaseYear(pr.releaseDate),
    trackCount: pr.trackCount,
  };
}

export function rowFacts(row: Release): EditionFacts {
  return {
    title: row.title,
    artistName: row.artistName,
    disambiguation: row.disambiguation,
    upc: row.upc,
    musicbrainzId: row.musicbrainzId,
    musicbrainzReleaseGroupId: row.musicbrainzReleaseGroupId,
    deezerId: row.deezerId,
    itunesId: row.itunesId,
    year: releaseYear(row.releaseDate),
    trackCount: row.trackCount,
  };
}

/**
 * A full provider import contradicts the row its id is attached to: different barcode, edition
 * title, track count, or a year more than one apart (providers disagree by a few days around
 * New Year, never by years for the same edition).
 */
function conflictsWithFull(row: Release, pr: ProviderRelease): boolean {
  if (pr.tracks === null) return false;
  const rowUpc = normalizeBarcode(row.upc);
  const upc = normalizeBarcode(pr.upc);
  if (rowUpc && upc && rowUpc !== upc) return true;
  // A seed row or a search hit (never synced) may hold a placeholder or provider-rounded track
  // count; its date, when present, is still evidence (a seed "Weezer" from 1994).
  if (row.metadataSyncedAt && row.trackCount && pr.trackCount && row.trackCount !== pr.trackCount) {
    return true;
  }
  const rowYear = releaseYear(row.releaseDate);
  const year = releaseYear(pr.releaseDate);
  if (rowYear !== null && year !== null && Math.abs(rowYear - year) > 1) return true;
  return (
    Boolean(row.metadataSyncedAt) &&
    editionMatchKey(row.title, row.artistName, row.disambiguation) !==
      editionMatchKey(pr.title, pr.artist.name, pr.disambiguation)
  );
}

/** Seed / hand-made rows: no provider id and no provider cover. */
function isPlaceholder(row: Release): boolean {
  return !row.deezerId && !row.itunesId && !row.musicbrainzId && !row.coverSource;
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
 * Turns provider results into local rows with internal UUIDs. A Release row is ONE edition
 * (ADR-012): imports are upserts keyed by the provider's id, the barcode, the MusicBrainz release
 * id, then the edition title (markers included) + artist + year + track count, so the same
 * edition from Deezer, iTunes and MusicBrainz converges to one row, while remasters, deluxe
 * editions and same-titled albums of other years stay separate rows linked to a ReleaseGroup.
 */
export class CatalogImportService {
  /**
   * Serializes "find, else create" per match key inside this process, so concurrent imports of
   * the same album/track/artist (two users running the same search) converge on one row. Lock
   * order is always release -> track -> artist, so nested locks cannot deadlock.
   */
  private readonly locks = new KeyedMutex();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly providers: Pick<CatalogProviders, 'images' | 'thumbnailFor'>
  ) {}

  // -- Artists -----------------------------------------------------------------------------

  async upsertArtist(artist: ProviderArtist): Promise<string> {
    const matchKey = normalizeCatalogArtist(artist.name);
    return this.locks.run(`artist:${matchKey}`, () => this.upsertArtistLocked(artist, matchKey));
  }

  private async upsertArtistLocked(artist: ProviderArtist, matchKey: string): Promise<string> {
    const field = idField(artist.provider);
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

  // -- Releases (editions, ADR-012) ----------------------------------------------------------

  /**
   * Finds the local edition for a provider release, without writing. Same row ONLY for the same
   * edition: same provider id, same barcode, same MusicBrainz release id, or — with no
   * conflicting identifier — same artist, same title including edition markers, same year and
   * same track count (`compareEditions`). When the year or track count is unknown on one side the
   * match is accepted only if it is the single candidate with that edition title.
   */
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
    return this.findSameEdition(pr);
  }

  private async findSameEdition(pr: ProviderRelease): Promise<Release | null> {
    const matchKey = catalogMatchKey(pr.title, pr.artist.name);
    const bare = pr.title.split(/\s*[([]|\s+[-–—]\s+/)[0]?.trim() ?? pr.title;
    const rows = await this.prisma.release.findMany({
      where: {
        OR: [
          { matchKey },
          // Rows created before match keys existed (seed, legacy imports).
          { matchKey: null, title: { startsWith: bare, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    const incoming = providerFacts(pr);
    const editionKey = editionMatchKey(pr.title, pr.artist.name, pr.disambiguation);
    const sameTitle = rows.filter(
      (r) =>
        catalogMatchKey(r.title, r.artistName) === matchKey &&
        editionMatchKey(r.title, r.artistName, r.disambiguation) === editionKey
    );
    const verdicts = sameTitle.map((row) => ({
      row,
      verdict: compareEditions(incoming, rowFacts(row)),
    }));
    const exact = verdicts.find((v) => v.verdict === 'identical' || v.verdict === 'same-edition');
    if (exact) return exact.row;
    // Incomplete data (search hits have no date, seed rows no ids): only an unambiguous match,
    // and never onto a row another provider already imported in full — nothing could correct
    // that later (resolve and open trust a synced row).
    const compatible = verdicts.filter(
      (v) => v.verdict === 'compatible' && (isPlaceholder(v.row) || !v.row.metadataSyncedAt)
    );
    if (compatible.length === 1 && sameTitle.length === 1) return compatible[0]?.row ?? null;
    return null;
  }

  /**
   * Upserts a release (edition) and, when `pr.tracks` is present, its tracklist. `pr.tracks !==
   * null` marks the import as "full" (metadataSyncedAt is set). The edition is linked to its
   * release group afterwards.
   */
  async importRelease(pr: ProviderRelease): Promise<ImportedRelease> {
    const artistId = await this.upsertArtist(pr.artist);
    const matchKey = catalogMatchKey(pr.title, pr.artist.name);
    const { release, detachedFrom } = await this.locks.run(`release:${matchKey}`, () =>
      this.upsertRelease(pr, artistId, matchKey)
    );
    if (detachedFrom) await this.moveDetachedTracks(detachedFrom, release.id, pr);
    const grouped = await this.assignGroup(release, pr, artistId);
    const trackIds = pr.tracks ? await this.importTracks(grouped, pr.tracks) : [];
    return { release: grouped, trackIds };
  }

  private async upsertRelease(
    pr: ProviderRelease,
    artistId: string,
    matchKey: string
  ): Promise<{ release: Release; detachedFrom: string | null }> {
    let existing = await this.findExistingRelease(pr);
    let detachedFrom: string | null = null;
    const field = idField(pr.provider);
    if (existing && field && existing[field] === pr.externalId && conflictsWithFull(existing, pr)) {
      // The provider id was attached to the wrong edition by an earlier, incomplete match (a
      // search hit without date): the full detail proves otherwise. Detach it and import this
      // edition on its own row.
      await this.prisma.release.update({ where: { id: existing.id }, data: { [field]: null } });
      detachedFrom = existing.id;
      existing = await this.findExistingRelease(pr);
    }
    if (existing) return { release: await this.mergeRelease(existing, pr, artistId), detachedFrom };
    const full = pr.tracks !== null;
    const upc = normalizeBarcode(pr.upc);
    const coverSource: CatalogSource | null =
      pr.provider === 'MUSICBRAINZ' ? null : (pr.provider as CatalogSource);
    const edition = parseEdition(pr.title, pr.disambiguation);

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
      musicbrainzReleaseGroupId: groupMbidOf(pr),
      editionLabel: edition.label,
      disambiguation: pr.disambiguation ?? null,
      country: pr.country ?? null,
      format: pr.format ?? null,
      releaseStatus: pr.status ?? null,
      metadataSyncedAt: full ? new Date() : null,
      ...(field ? { [field]: pr.externalId } : {}),
    };
    try {
      return { release: await this.prisma.release.create({ data }), detachedFrom };
    } catch (err) {
      if (uniqueConflict(err) === null) throw err;
    }
    // Another process created the row meanwhile (same provider id or barcode): merge into it.
    // Only when no such row exists is the conflicting optional column dropped instead.
    const winner = await this.findExistingRelease(pr);
    if (winner) return { release: await this.mergeRelease(winner, pr, artistId), detachedFrom };
    const created = await writeDroppingConflicts(
      data,
      ['upc', 'deezerId', 'itunesId', 'musicbrainzId'],
      (d) => this.prisma.release.create({ data: d })
    );
    return { release: created, detachedFrom };
  }

  /** Tracks of a detached provider id follow it to the edition they belong to. */
  private async moveDetachedTracks(
    fromReleaseId: string,
    toReleaseId: string,
    pr: ProviderRelease
  ): Promise<void> {
    const field = idField(pr.provider);
    if (!field || !pr.tracks || fromReleaseId === toReleaseId) return;
    const ids = pr.tracks.map((t) => t.musicbrainzId ?? t.externalId);
    await this.prisma.track.updateMany({
      where: { releaseId: fromReleaseId, [field]: { in: ids } },
      data: { releaseId: toReleaseId },
    });
  }

  private async mergeRelease(
    existing: Release,
    pr: ProviderRelease,
    artistId: string
  ): Promise<Release> {
    const field = idField(pr.provider);
    const full = pr.tracks !== null;
    // Seed / hand-made rows have no provider ids: real data replaces their placeholders.
    const placeholder = isPlaceholder(existing);
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
    const groupMbid = groupMbidOf(pr);
    if (groupMbid && !existing.musicbrainzReleaseGroupId) {
      data.musicbrainzReleaseGroupId = groupMbid;
    }
    if (!existing.editionLabel) {
      const label =
        parseEdition(existing.title, existing.disambiguation ?? pr.disambiguation).label ??
        parseEdition(pr.title, pr.disambiguation).label;
      if (label) data.editionLabel = label;
    }
    if (pr.disambiguation && !existing.disambiguation) data.disambiguation = pr.disambiguation;
    if (pr.country && !existing.country) data.country = pr.country;
    if (pr.format && !existing.format) data.format = pr.format;
    if (pr.status && !existing.releaseStatus) data.releaseStatus = pr.status;

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

  // -- Release groups (ADR-012) --------------------------------------------------------------

  /**
   * Links an edition to its release group: by MusicBrainz release-group id when known (canonical),
   * otherwise by work title + artist with year checks so that two different albums with the same
   * title (Weezer's self-titled records) never share a group.
   */
  private async assignGroup(
    release: Release,
    pr: ProviderRelease,
    artistId: string
  ): Promise<Release> {
    const mbGroup = pr.releaseGroup ?? null;
    const mbid = mbGroup?.musicbrainzId ?? release.musicbrainzReleaseGroupId;
    if (mbid) {
      return this.attachToMusicBrainzGroup(
        release.id,
        {
          musicbrainzId: mbid,
          title: mbGroup?.title ?? parseEdition(release.title).workTitle,
          primaryType: mbGroup?.primaryType ?? release.releaseType,
          firstReleaseDate: mbGroup?.firstReleaseDate ?? null,
        },
        // Only MusicBrainz' own release-group data may rewrite the group's title/type/year.
        mbGroup !== null
      );
    }
    if (release.releaseGroupId && !(await this.leaveMisfiledGroup(release))) return release;
    return this.attachByWorkTitle(release, artistId);
  }

  /**
   * A dateless search hit is filed under the only work with its title; once its year is known it
   * may turn out to be another album (Weezer 2001 filed under Weezer 1994). For a heuristic group
   * (no MusicBrainz id) the edition is unlinked when it contradicts the group's other editions:
   * a plain edition whose year matches none of the group's plain editions, or any edition older
   * than the group's original. Returns true when it was unlinked (and must be filed again).
   */
  private async leaveMisfiledGroup(release: Release): Promise<boolean> {
    const year = releaseYear(release.releaseDate);
    if (!release.releaseGroupId || year === null) return false;
    const groupId = release.releaseGroupId;
    const group = await this.prisma.releaseGroup.findUnique({
      where: { id: groupId },
      include: {
        releases: {
          where: { id: { not: release.id } },
          select: { title: true, disambiguation: true, releaseDate: true },
        },
      },
    });
    if (!group || group.musicbrainzId) return false;
    const plainYears = group.releases
      .filter((r) => parseEdition(r.title, r.disambiguation).tokens.length === 0)
      .map((r) => releaseYear(r.releaseDate))
      .filter((y): y is number => y !== null);
    if (plainYears.length === 0) return false;
    const plain = parseEdition(release.title, release.disambiguation).tokens.length === 0;
    const misfiled = plain ? !plainYears.includes(year) : year < Math.min(...plainYears);
    if (!misfiled) return false;
    const unlinked = await this.prisma.release.updateMany({
      where: { id: release.id, releaseGroupId: groupId },
      data: { releaseGroupId: null },
    });
    if (unlinked.count === 0) return false;
    // The group's first year may have come from this edition.
    const years = group.releases
      .map((r) => releaseYear(r.releaseDate))
      .filter((y): y is number => y !== null);
    await this.prisma.releaseGroup.update({
      where: { id: groupId },
      data: { firstReleaseYear: years.length > 0 ? Math.min(...years) : null },
    });
    return true;
  }

  /** Moves/links the edition to the group with this MusicBrainz id (created when missing). */
  async attachToMusicBrainzGroup(
    releaseId: string,
    rg: ProviderReleaseGroup,
    authoritative = true
  ): Promise<Release> {
    return this.locks.run(`group:mb:${rg.musicbrainzId}`, async () => {
      const release = await this.prisma.release.findUniqueOrThrow({ where: { id: releaseId } });
      const firstYear = releaseYear(rg.firstReleaseDate);
      const metadata = {
        title: rg.title,
        primaryType: rg.primaryType,
        ...(firstYear !== null ? { firstReleaseYear: firstYear } : {}),
      };
      let target = await this.prisma.releaseGroup.findUnique({
        where: { musicbrainzId: rg.musicbrainzId },
      });
      const current = release.releaseGroupId
        ? await this.prisma.releaseGroup.findUnique({ where: { id: release.releaseGroupId } })
        : null;

      if (!target && current && !current.musicbrainzId) {
        // The heuristic group becomes the MusicBrainz one unless another edition in it is known
        // to belong to a different release group.
        const conflicting = await this.prisma.release.count({
          where: {
            releaseGroupId: current.id,
            id: { not: release.id },
            musicbrainzReleaseGroupId: { not: null },
            NOT: { musicbrainzReleaseGroupId: rg.musicbrainzId },
          },
        });
        if (conflicting === 0) {
          target = await this.prisma.releaseGroup
            .update({
              where: { id: current.id },
              data: { musicbrainzId: rg.musicbrainzId, ...(authoritative ? metadata : {}) },
            })
            .catch((err: unknown) => {
              if (uniqueConflict(err) === null) throw err;
              return null;
            });
        }
      }
      if (!target) {
        target = await this.prisma.releaseGroup
          .create({
            data: {
              musicbrainzId: rg.musicbrainzId,
              artistName: release.artistName,
              artistId: release.artistId,
              matchKey: releaseGroupMatchKey(rg.title, release.artistName),
              firstReleaseYear: firstYear ?? releaseYear(release.releaseDate),
              ...metadata,
            },
          })
          .catch(async (err: unknown) => {
            if (uniqueConflict(err) === null) throw err;
            return this.prisma.releaseGroup.findUniqueOrThrow({
              where: { musicbrainzId: rg.musicbrainzId },
            });
          });
      } else if (
        authoritative &&
        (target.title !== rg.title ||
          target.primaryType !== rg.primaryType ||
          (firstYear !== null && target.firstReleaseYear !== firstYear))
      ) {
        target = await this.prisma.releaseGroup.update({
          where: { id: target.id },
          data: metadata,
        });
      }

      if (
        release.releaseGroupId === target.id &&
        release.musicbrainzReleaseGroupId === rg.musicbrainzId
      ) {
        return release;
      }
      const updated = await this.prisma.release.update({
        where: { id: release.id },
        data: { releaseGroupId: target.id, musicbrainzReleaseGroupId: rg.musicbrainzId },
      });
      if (current && current.id !== target.id) await this.deleteGroupIfEmpty(current.id);
      return updated;
    });
  }

  private async attachByWorkTitle(release: Release, artistId: string): Promise<Release> {
    const key = releaseGroupMatchKey(release.title, release.artistName);
    return this.locks.run(`group:key:${key}`, async () => {
      const fresh = await this.prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      if (fresh.releaseGroupId) return fresh;
      const edition = parseEdition(fresh.title, fresh.disambiguation);
      const plain = edition.tokens.length === 0;
      const year = releaseYear(fresh.releaseDate);

      const groups = await this.prisma.releaseGroup.findMany({
        where: { matchKey: key },
        include: { releases: { select: { title: true, disambiguation: true, releaseDate: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const plainYears = (g: (typeof groups)[number]) =>
        g.releases
          .filter((r) => parseEdition(r.title, r.disambiguation).tokens.length === 0)
          .map((r) => releaseYear(r.releaseDate))
          .filter((y): y is number => y !== null);
      const compatible = groups.filter((g) => {
        if (year === null) return true;
        if (!plain) return g.firstReleaseYear === null || g.firstReleaseYear <= year;
        const years = plainYears(g);
        // A plain edition with another year is another album (Weezer 1994 vs 2001).
        if (years.length > 0) return years.includes(year);
        return g.firstReleaseYear === null || year <= g.firstReleaseYear;
      });
      let group: (typeof groups)[number] | undefined;
      if (compatible.length === 1) group = compatible[0];
      else if (plain && year !== null) {
        const exact = compatible.filter((g) => plainYears(g).includes(year));
        if (exact.length === 1) group = exact[0];
      }

      let groupId: string;
      let createdGroup = false;
      if (group) {
        groupId = group.id;
        if (
          !group.musicbrainzId &&
          year !== null &&
          (group.firstReleaseYear === null || year < group.firstReleaseYear)
        ) {
          await this.prisma.releaseGroup.update({
            where: { id: group.id },
            data: { firstReleaseYear: year },
          });
        }
      } else {
        const created = await this.prisma.releaseGroup.create({
          data: {
            title: edition.workTitle,
            artistName: fresh.artistName,
            artistId: fresh.artistId ?? artistId,
            primaryType: fresh.releaseType,
            firstReleaseYear: year,
            matchKey: key,
          },
        });
        groupId = created.id;
        createdGroup = true;
      }
      // Conditional: another API process may have linked this edition meanwhile.
      const linked = await this.prisma.release.updateMany({
        where: { id: fresh.id, releaseGroupId: null },
        data: { releaseGroupId: groupId },
      });
      if (linked.count === 0 && createdGroup) await this.deleteGroupIfEmpty(groupId);
      return this.prisma.release.findUniqueOrThrow({ where: { id: fresh.id } });
    });
  }

  private async deleteGroupIfEmpty(groupId: string): Promise<void> {
    await this.prisma.releaseGroup.deleteMany({
      where: { id: groupId, releases: { none: {} } },
    });
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

  private upsertTrack(releaseId: string, pt: ProviderTrack, artistId: string): Promise<string> {
    const key = `track:${releaseId}:${catalogMatchKey(pt.title, pt.artist.name)}`;
    return this.locks.run(key, () => this.upsertTrackLocked(releaseId, pt, artistId));
  }

  private async upsertTrackLocked(
    releaseId: string,
    pt: ProviderTrack,
    artistId: string
  ): Promise<string> {
    const field = idField(pt.provider);
    const externalId = pt.musicbrainzId ?? pt.externalId;
    const isrc = normalizeIsrc(pt.isrc);
    let existing = await this.findExistingTrack(releaseId, pt);

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
      try {
        return (await this.prisma.track.create({ data })).id;
      } catch (err) {
        if (uniqueConflict(err) === null) throw err;
      }
      // Created by another process meanwhile -> update that row. Otherwise the id/ISRC belongs to
      // a track of another release (same recording on a compilation): store this one without it.
      existing = await this.findExistingTrack(releaseId, pt);
      if (!existing) {
        const created = await writeDroppingConflicts(
          data,
          ['isrc', 'deezerId', 'itunesId', 'musicbrainzId'],
          (d) => this.prisma.track.create({ data: d })
        );
        return created.id;
      }
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
