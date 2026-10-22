import type { Prisma, PrismaClient, Release } from '@openmusic/db';
import {
  catalogMatchKey,
  editionMatchKey,
  parseEdition,
  releaseYear,
  type CatalogRelease,
  type CatalogResolveParams,
  type CatalogResolveResult,
  type CatalogSearchParams,
  type CatalogSource,
  type GenreList,
  type GroupScores,
  type ReleaseGroupDetail,
  type ReleasePage,
  type SearchResult,
} from '@openmusic/shared';
import type { BackgroundQueue, TaskLogger } from '../../lib/background';
import { BadRequestError, NotFoundError, UpstreamError } from '../../lib/errors';
import {
  nextCursorOf,
  toCatalogRelease,
  toCatalogTrack,
  toEditionSummary,
} from '../../lib/mappers';
import { aggregateScore } from '../reviews/score';
import { mergeGenres } from './catalog-import.service';
import { UpstreamRequestError } from '../../lib/upstream';
import type { AudioPreviewResolverService } from './audio-preview-resolver.service';
import type { CatalogEnrichmentService } from './catalog-enrichment.service';
import type { CatalogImportService } from './catalog-import.service';
import type { CatalogProviders } from './providers';
import { isMbid } from './providers/musicbrainz.provider';
import type { ProviderRelease, ProviderSearchPage, ProviderTrack } from './providers/types';

const DEFAULT_DOMINANT_COLOR = '#26262B';
/**
 * Time budget of the whole external search (Deezer, then the iTunes fallback). Past it the
 * search answers with what it has; the provider calls keep running and warm the cache.
 */
const EXTERNAL_SEARCH_BUDGET_MS = 3_500;

class BudgetExceededError extends Error {
  constructor(stage: string) {
    super(`${stage} search exceeded the ${EXTERNAL_SEARCH_BUDGET_MS} ms budget`);
    this.name = 'BudgetExceededError';
  }
}

/** Rejects at `deadline` without cancelling `work` (its late result is simply ignored). */
function withinBudget<T>(stage: string, work: Promise<T>, deadline: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new BudgetExceededError(stage)),
      Math.max(0, deadline - Date.now())
    );
    timer.unref();
  });
  work.catch(() => undefined); // a late failure must not become an unhandled rejection
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const TRACK_ORDER: Prisma.TrackOrderByWithRelationInput[] = [
  { discNumber: { sort: 'asc', nulls: 'last' } },
  { trackNumber: { sort: 'asc', nulls: 'last' } },
  { id: 'asc' },
];

/** Editions, oldest first (undated last). */
const EDITION_ORDER: Prisma.ReleaseOrderByWithRelationInput[] = [
  { releaseDate: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'asc' },
  { id: 'asc' },
];

/** Sibling editions are re-browsed on MusicBrainz after this long (ADR-012). */
export const EDITIONS_SYNC_MS = 30 * 24 * 60 * 60 * 1000;

/** A failed sibling-editions sync is retried at most this often per group. */
export const EDITIONS_RETRY_MS = 10 * 60 * 1000;

const PROVIDER_LABEL = { deezer: 'Deezer', itunes: 'iTunes', musicbrainz: 'MusicBrainz' } as const;

export interface CatalogServiceOptions {
  /** false = never call external databases (search and open use the local catalog only). */
  externalEnabled: boolean;
}

interface ExternalHits {
  source: CatalogSource;
  releases: ProviderRelease[];
  tracks: ProviderTrack[];
  total: number | null;
}

/** Dedupe provider results before importing (Deezer returns explicit + clean editions, etc.). */
function dedupeBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export class CatalogService {
  /** Last sibling-editions sync attempt per group (in-process; see startEditionsSync). */
  private readonly editionsAttempts = new Map<string, number>();
  private readonly editionsInFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly previewResolver: AudioPreviewResolverService,
    private readonly providers: CatalogProviders,
    private readonly importer: CatalogImportService,
    private readonly enrichment: CatalogEnrichmentService,
    private readonly background: BackgroundQueue,
    private readonly logger: TaskLogger,
    private readonly options: CatalogServiceOptions
  ) {}

  // -- Search --------------------------------------------------------------------------------

  /**
   * Local catalog first, then external results (Deezer, iTunes as fallback) imported on the fly
   * so that every returned id is an internal UUID. Each list holds at most `limit` items: local
   * matches, then external ones that were not already local.
   */
  async search(params: CatalogSearchParams): Promise<SearchResult> {
    const q = params.q.trim();
    const empty: SearchResult = {
      releases: [],
      tracks: [],
      page: params.page,
      hasMore: false,
      sources: [],
    };
    if (!q) return empty;

    const offset = (params.page - 1) * params.limit;
    const wantReleases = params.type !== 'tracks';
    const wantTracks = params.type !== 'releases';
    const textFilter = {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { artistName: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const [localReleases, localTracks] = await Promise.all([
      wantReleases
        ? this.prisma.release.findMany({
            where: textFilter,
            include: { releaseGroup: true },
            orderBy: [{ audienceCount: 'desc' }, { title: 'asc' }, { id: 'asc' }],
            skip: offset,
            take: params.limit + 1,
          })
        : Promise.resolve([]),
      wantTracks
        ? this.prisma.track.findMany({
            where: textFilter,
            include: { release: true },
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
            skip: offset,
            take: params.limit + 1,
          })
        : Promise.resolve([]),
    ]);

    let hasMore = localReleases.length > params.limit || localTracks.length > params.limit;
    const releases: Release[] = localReleases.slice(0, params.limit);
    const tracks = localTracks.slice(0, params.limit);
    const sources = new Set<CatalogSource>();
    if (releases.length > 0 || tracks.length > 0) sources.add('LOCAL');

    if (params.external && this.options.externalEnabled) {
      const external = await this.searchExternal(q, {
        offset,
        limit: params.limit,
        wantReleases,
        wantTracks,
      });
      if (external) {
        sources.add(external.source);
        if (external.total !== null && external.total > offset + params.limit) hasMore = true;

        const releaseIds = new Set(releases.map((r) => r.id));
        for (const pr of external.releases) {
          const { release } = await this.importer.importRelease(pr);
          this.scheduleFollowUp(release);
          if (releases.length < params.limit && !releaseIds.has(release.id)) {
            releases.push(release);
            releaseIds.add(release.id);
          }
        }

        const trackIds = new Set(tracks.map((t) => t.id));
        for (const pt of external.tracks) {
          const imported = await this.importer.importTrackHit(pt);
          if (!imported || trackIds.has(imported.trackId) || tracks.length >= params.limit)
            continue;
          const track = await this.prisma.track.findUnique({
            where: { id: imported.trackId },
            include: { release: true },
          });
          if (!track) continue;
          this.scheduleFollowUp(track.release);
          tracks.push(track);
          trackIds.add(track.id);
        }
      }
    }

    // Imported rows were linked to their release group after the search hit was mapped.
    const withGroups = await this.prisma.release.findMany({
      where: { id: { in: releases.map((r) => r.id) } },
      include: { releaseGroup: true },
    });
    const byId = new Map(withGroups.map((r) => [r.id, r]));
    return {
      releases: releases.map((r) => toCatalogRelease(byId.get(r.id) ?? r)),
      tracks: tracks.map((t) => toCatalogTrack(t)),
      page: params.page,
      hasMore,
      sources: [...sources],
    };
  }

  /** Deezer first; iTunes when Deezer fails or finds nothing (first page only: no paging). */
  private async searchExternal(
    q: string,
    opts: { offset: number; limit: number; wantReleases: boolean; wantTracks: boolean }
  ): Promise<ExternalHits | null> {
    const empty: ProviderSearchPage<never> = { items: [], total: 0 };
    const page = { offset: opts.offset, limit: opts.limit };
    const deadline = Date.now() + EXTERNAL_SEARCH_BUDGET_MS;
    const deezer = await Promise.allSettled([
      withinBudget(
        'Deezer',
        opts.wantReleases ? this.providers.deezer.searchAlbums(q, page) : Promise.resolve(empty),
        deadline
      ),
      withinBudget(
        'Deezer',
        opts.wantTracks ? this.providers.deezer.searchTracks(q, page) : Promise.resolve(empty),
        deadline
      ),
    ]);
    const [albums, songs] = deezer;
    if (albums.status === 'fulfilled' && songs.status === 'fulfilled') {
      if (albums.value.items.length > 0 || songs.value.items.length > 0 || opts.offset > 0) {
        return this.dedupeHits('DEEZER', albums.value, songs.value);
      }
    } else {
      for (const result of deezer) {
        if (result.status === 'rejected') this.logUpstream('Deezer search failed', result.reason);
      }
    }

    if (opts.offset > 0 || Date.now() >= deadline) return null;
    const itunes = await Promise.allSettled([
      withinBudget(
        'iTunes',
        opts.wantReleases
          ? this.providers.itunes.searchAlbums(q, opts.limit)
          : Promise.resolve(empty),
        deadline
      ),
      withinBudget(
        'iTunes',
        opts.wantTracks
          ? this.providers.itunes.searchTracks(q, opts.limit)
          : Promise.resolve(empty),
        deadline
      ),
    ]);
    const [itAlbums, itSongs] = itunes;
    if (itAlbums.status === 'rejected') this.logUpstream('iTunes search failed', itAlbums.reason);
    if (itSongs.status === 'rejected') this.logUpstream('iTunes search failed', itSongs.reason);
    if (itAlbums.status === 'rejected' && itSongs.status === 'rejected') return null;
    return this.dedupeHits(
      'ITUNES',
      itAlbums.status === 'fulfilled' ? itAlbums.value : empty,
      itSongs.status === 'fulfilled' ? itSongs.value : empty
    );
  }

  private dedupeHits(
    source: CatalogSource,
    albums: ProviderSearchPage<ProviderRelease>,
    songs: ProviderSearchPage<ProviderTrack>
  ): ExternalHits {
    return {
      source,
      // Same page, same edition: explicit/clean twins collapse (ADR-012); editions do not.
      releases: dedupeBy(
        albums.items,
        (r) =>
          r.upc ??
          `${editionMatchKey(r.title, r.artist.name, r.disambiguation)}|${r.trackCount ?? ''}|${releaseYear(r.releaseDate) ?? ''}`
      ),
      tracks: dedupeBy(
        songs.items,
        (t) => t.isrc ?? `${catalogMatchKey(t.title, t.artist.name)}|${t.release?.title ?? ''}`
      ),
      total: Math.max(albums.total ?? 0, songs.total ?? 0) || null,
    };
  }

  // -- Release detail ------------------------------------------------------------------------

  /**
   * Release with its tracklist. A release known only from a search hit is completed from its
   * provider (tracklist, label, date, genres) the first time it is opened; MusicBrainz enrichment
   * and the dominant color follow in the background.
   */
  async getReleaseById(id: string): Promise<CatalogRelease | null> {
    let release = await this.prisma.release.findUnique({ where: { id } });
    if (!release) return null;
    if (!release.metadataSyncedAt && this.options.externalEnabled) {
      const hydrated = await this.hydrate(release).catch((err: unknown) => {
        this.logUpstream('Release hydration failed', err);
        return null;
      });
      // A different row means the provider id belonged to another edition and was detached
      // (ADR-012): this row stays what it was.
      release =
        hydrated && hydrated.id === id
          ? hydrated
          : await this.prisma.release.findUniqueOrThrow({ where: { id } });
    }
    this.scheduleFollowUp(release);
    const [tracks, group] = await Promise.all([
      this.prisma.track.findMany({ where: { releaseId: id }, orderBy: TRACK_ORDER }),
      release.releaseGroupId
        ? this.prisma.releaseGroup.findUnique({ where: { id: release.releaseGroupId } })
        : Promise.resolve(null),
    ]);
    const otherEditions = group
      ? await this.prisma.release.findMany({
          where: { releaseGroupId: group.id, id: { not: id } },
          orderBy: EDITION_ORDER,
          take: 50,
        })
      : [];
    return {
      ...toCatalogRelease({ ...release, releaseGroup: group }, tracks),
      otherEditions: otherEditions.map(toEditionSummary),
    };
  }

  // -- Release groups (ADR-012) --------------------------------------------------------------

  /**
   * The album as a work: its editions (oldest first) and scores aggregated over all of them.
   * When the group is known to MusicBrainz, its sibling editions are fetched in the background
   * (at most once every 30 days); `editionsSyncing` tells the client to reload later.
   */
  async getReleaseGroup(id: string): Promise<ReleaseGroupDetail | null> {
    const group = await this.prisma.releaseGroup.findUnique({
      where: { id },
      include: { releases: { orderBy: EDITION_ORDER } },
    });
    if (!group) return null;

    let editionsSyncing = false;
    if (
      this.options.externalEnabled &&
      group.musicbrainzId &&
      (!group.editionsSyncedAt || Date.now() - group.editionsSyncedAt.getTime() > EDITIONS_SYNC_MS)
    ) {
      editionsSyncing = this.startEditionsSync(group.id);
    }

    const editions = group.releases;
    const isPlain = (r: Release) => parseEdition(r.title, r.disambiguation).tokens.length === 0;
    const coverEdition =
      editions.find((r) => r.coverUrl && isPlain(r)) ?? editions.find((r) => r.coverUrl);
    const genres = editions.reduce<string[]>((acc, r) => mergeGenres(acc, r.genres), []);

    return {
      id: group.id,
      title: group.title,
      artistName: group.artistName,
      primaryType: group.primaryType,
      firstYear: group.firstReleaseYear,
      coverUrl: coverEdition?.coverUrl ?? null,
      dominantColor: coverEdition?.dominantColor ?? DEFAULT_DOMINANT_COLOR,
      genres,
      externalIds: { musicbrainz: group.musicbrainzId },
      scores: await this.groupScores(group.id),
      editions: editions.map(toEditionSummary),
      editionsSyncing,
    };
  }

  /**
   * Queues the MusicBrainz browse of a group's editions. A failed sync leaves `editionsSyncedAt`
   * unset, so without this cooldown every (anonymous, unthrottled) view of the album page would
   * queue another MusicBrainz request: one attempt per group every EDITIONS_RETRY_MS. Returns
   * true while a sync is queued or running.
   */
  private startEditionsSync(groupId: string): boolean {
    if (this.editionsInFlight.has(groupId)) return true;
    const now = Date.now();
    const last = this.editionsAttempts.get(groupId);
    if (last !== undefined && now - last < EDITIONS_RETRY_MS) return false;
    if (this.editionsAttempts.size >= 5_000) {
      for (const [id, at] of this.editionsAttempts) {
        if (now - at >= EDITIONS_RETRY_MS) this.editionsAttempts.delete(id);
      }
    }
    const queued = this.background.enqueue(`editions:${groupId}`, () =>
      this.enrichment
        .syncGroupEditions(groupId)
        .finally(() => this.editionsInFlight.delete(groupId))
    );
    if (!queued) return false;
    this.editionsAttempts.set(groupId, now);
    this.editionsInFlight.add(groupId);
    return true;
  }

  /**
   * ADR-012: group scores use the reviews of every edition, with the ADR-001/002 weights, and
   * count each user once (their most recent review in the group), so reviewing the original and
   * the remaster does not double a vote.
   */
  private async groupScores(groupId: string): Promise<GroupScores> {
    const reviews = await this.prisma.review.findMany({
      where: { release: { releaseGroupId: groupId } },
      select: { userId: true, rating: true, isVerifiedListen: true, isCritic: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    const seen = new Set<string>();
    const latest = reviews.filter((r) => {
      if (seen.has(r.userId)) return false;
      seen.add(r.userId);
      return true;
    });
    const audience = aggregateScore(latest.filter((r) => !r.isCritic));
    const critic = aggregateScore(
      latest.filter((r) => r.isCritic),
      () => 1
    );
    return {
      audienceAvg: audience.avg,
      audienceFreshPct: audience.freshPct,
      audienceCount: audience.count,
      criticAvg: critic.avg,
      criticFreshPct: critic.freshPct,
      criticCount: critic.count,
    };
  }

  /** Imports the full provider detail of a release that has a provider id. */
  private async hydrate(release: Release): Promise<Release> {
    let detail: ProviderRelease | null = null;
    if (release.deezerId) detail = await this.providers.deezer.getAlbum(release.deezerId);
    else if (release.itunesId) detail = await this.providers.itunes.getAlbum(release.itunesId);
    else if (release.musicbrainzId)
      detail = await this.providers.musicbrainz.getRelease(release.musicbrainzId);
    if (!detail) return release;
    const { release: updated } = await this.importer.importRelease(detail);
    return updated;
  }

  /** Background work after a release is seen: cover color, then MusicBrainz enrichment. */
  private scheduleFollowUp(release: Release): void {
    if (!this.options.externalEnabled) return;
    if (
      release.coverUrl &&
      release.coverSource &&
      release.dominantColor === DEFAULT_DOMINANT_COLOR
    ) {
      this.background.enqueue(`color:${release.id}`, () =>
        this.importer.refreshDominantColor(release.id)
      );
    }
    // Search-hit skeletons wait for their full import (UPC + ISRCs make the MusicBrainz match
    // exact, and recordings can only be linked once the tracklist exists).
    const skeleton = !release.metadataSyncedAt && Boolean(release.deezerId ?? release.itunesId);
    if (!skeleton && this.enrichment.needsEnrichment(release)) {
      this.background.enqueue(`enrich:${release.id}`, () =>
        this.enrichment.enrichRelease(release.id)
      );
    }
  }

  // -- Resolve -------------------------------------------------------------------------------

  /** Provider id -> internal release (imported on first use). */
  async resolve(params: CatalogResolveParams): Promise<CatalogResolveResult> {
    let { id, type } = params;
    const { provider } = params;
    // Ids issued by the old search ("deezer-alb-302127", "deezer-trk-3135556").
    const legacy = /^deezer-(alb|trk)-(\d+)$/.exec(id);
    if (provider === 'deezer' && legacy?.[2]) {
      id = legacy[2];
      type = legacy[1] === 'trk' ? 'track' : 'release';
    }
    if ((provider === 'deezer' || provider === 'itunes') && !/^\d+$/.test(id)) {
      throw new BadRequestError('Id esterno non valido');
    }
    if (provider === 'musicbrainz' && !isMbid(id)) throw new BadRequestError('MBID non valido');
    if (provider === 'musicbrainz' && type === 'track') {
      throw new BadRequestError('MusicBrainz: si possono risolvere solo release');
    }

    const field =
      provider === 'deezer' ? 'deezerId' : provider === 'itunes' ? 'itunesId' : 'musicbrainzId';
    if (type === 'release') {
      const local = await this.prisma.release.findFirst({ where: { [field]: id } });
      if (local?.metadataSyncedAt) return this.resolved(local.id, null);
    } else {
      const local = await this.prisma.track.findFirst({
        where: { [field]: id },
        include: { release: true },
      });
      if (local?.release.metadataSyncedAt) return this.resolved(local.releaseId, local.id);
    }
    if (!this.options.externalEnabled) throw new NotFoundError('Release non trovata nel catalogo');

    try {
      if (type === 'release') {
        const detail =
          provider === 'deezer'
            ? await this.providers.deezer.getAlbum(id)
            : provider === 'itunes'
              ? await this.providers.itunes.getAlbum(id)
              : await this.providers.musicbrainz.getRelease(id);
        if (!detail) throw new NotFoundError('Release non trovata');
        const { release } = await this.importer.importRelease(detail);
        await this.afterExplicitImport(release, provider === 'musicbrainz' ? id : null);
        return this.resolved(release.id, null);
      }

      const track =
        provider === 'deezer'
          ? await this.providers.deezer.getTrack(id)
          : await this.providers.itunes.getTrack(id);
      if (!track) throw new NotFoundError('Brano non trovato');
      const albumId = track.release?.externalId;
      const album = albumId
        ? provider === 'deezer'
          ? await this.providers.deezer.getAlbum(albumId)
          : await this.providers.itunes.getAlbum(albumId)
        : null;
      if (!album) {
        const hit = await this.importer.importTrackHit(track);
        if (!hit) throw new NotFoundError('Brano non trovato');
        return this.resolved(hit.releaseId, hit.trackId);
      }
      const { release, trackIds } = await this.importer.importRelease(album);
      await this.afterExplicitImport(release, null);
      const index = (album.tracks ?? []).findIndex((t) => t.externalId === track.externalId);
      const trackId =
        (index >= 0 ? trackIds[index] : undefined) ??
        (await this.importer.importTracks(release, [track]))[0];
      return this.resolved(release.id, trackId ?? null);
    } catch (err) {
      if (err instanceof UpstreamRequestError) {
        throw new UpstreamError(PROVIDER_LABEL[provider], err.message);
      }
      throw err;
    }
  }

  /** Synchronous color (one small image) + background MusicBrainz enrichment / CAA cover. */
  private async afterExplicitImport(release: Release, musicbrainzId: string | null): Promise<void> {
    if (musicbrainzId && !release.coverUrl) {
      const cover = await this.providers.coverArt.getFrontCover(musicbrainzId).catch(() => null);
      if (cover) {
        await this.prisma.release.update({
          where: { id: release.id },
          data: { coverUrl: cover.url, coverSource: 'COVER_ART_ARCHIVE' },
        });
      }
    }
    await this.importer.refreshDominantColor(release.id).catch((err: unknown) => {
      this.logUpstream('Dominant color failed', err);
    });
    const fresh = await this.prisma.release.findUniqueOrThrow({ where: { id: release.id } });
    if (this.enrichment.needsEnrichment(fresh)) {
      this.background.enqueue(`enrich:${fresh.id}`, () => this.enrichment.enrichRelease(fresh.id));
    }
  }

  private async resolved(releaseId: string, trackId: string | null): Promise<CatalogResolveResult> {
    const release = await this.prisma.release.findUniqueOrThrow({
      where: { id: releaseId },
      include: { releaseGroup: true },
    });
    const tracks = await this.prisma.track.findMany({ where: { releaseId }, orderBy: TRACK_ORDER });
    return { release: toCatalogRelease(release, tracks), trackId };
  }

  // -- Browse --------------------------------------------------------------------------------

  /** Explore page: releases optionally filtered by genre (case-insensitive exact match). */
  async browseReleases(query: {
    genre?: string;
    sort: 'popular' | 'recent';
    cursor?: string;
    limit: number;
  }): Promise<ReleasePage> {
    const orderBy: Prisma.ReleaseOrderByWithRelationInput[] =
      query.sort === 'recent'
        ? [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
        : [{ audienceCount: 'desc' }, { id: 'asc' }];
    let where: Prisma.ReleaseWhereInput = {};
    if (query.genre) {
      const genres = await this.listGenres();
      const match = genres.find((g) => g.name.toLowerCase() === query.genre?.toLowerCase());
      where = { genres: { has: match?.name ?? query.genre } };
    }
    const rows = await this.prisma.release.findMany({
      where,
      include: { releaseGroup: true },
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = nextCursorOf(rows, query.limit);
    return { items: page.items.map((r) => toCatalogRelease(r)), nextCursor: page.nextCursor };
  }

  /** Distinct genres across the catalog with release counts, most common first. */
  async listGenres(): Promise<GenreList> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT g AS name, COUNT(*) AS count
      FROM "Release", unnest("genres") AS g
      GROUP BY g
      ORDER BY count DESC, g ASC
    `;
    return rows.map((r) => ({ name: r.name, releaseCount: Number(r.count) }));
  }

  async resolveTrackPreview(title: string, artist: string, isrc?: string) {
    return this.previewResolver.resolvePreview(title, artist, isrc);
  }

  private logUpstream(message: string, err: unknown): void {
    this.logger.warn(
      { err: err instanceof Error ? { name: err.name, message: err.message } : err },
      message
    );
  }
}
