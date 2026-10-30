import { z } from 'zod';
import { PreviewUrlSchema } from './common';

export const ReleaseTypeSchema = z.enum(['ALBUM', 'SINGLE', 'EP']);

/**
 * Kind of work a release group is (ADR-012). MusicBrainz primary type, with its `Live` and
 * `Compilation` secondary types promoted because they change what the album is.
 */
export const ReleaseGroupTypeSchema = z.enum([
  'ALBUM',
  'EP',
  'SINGLE',
  'LIVE',
  'COMPILATION',
  'OTHER',
]);

/**
 * Where a piece of catalog data came from. `LOCAL` = already in the OpenMusic database (seed,
 * earlier imports); the others are the external open databases the API imports from.
 */
export const CatalogSourceSchema = z.enum([
  'LOCAL',
  'DEEZER',
  'ITUNES',
  'MUSICBRAINZ',
  'COVER_ART_ARCHIVE',
]);

/** Ids of the same release in external databases (all optional, filled as they are matched). */
export const ReleaseExternalIdsSchema = z.object({
  deezer: z.string().nullable().optional(),
  itunes: z.string().nullable().optional(),
  musicbrainz: z.string().nullable().optional(),
  musicbrainzReleaseGroup: z.string().nullable().optional(),
  spotify: z.string().nullable().optional(),
});

/** Ids of the same recording in external databases. */
export const TrackExternalIdsSchema = z.object({
  deezer: z.string().nullable().optional(),
  itunes: z.string().nullable().optional(),
  musicbrainz: z.string().nullable().optional(),
  spotify: z.string().nullable().optional(),
});

export const CatalogTrackSchema = z.object({
  /** Always an internal OpenMusic UUID: external ids live in `externalIds`. */
  id: z.string(),
  isrc: z.string().nullable().optional(),
  title: z.string().min(1),
  artistName: z.string().min(1),
  durationMs: z.number().int().positive(),
  previewUrl: PreviewUrlSchema.nullable().optional(),
  releaseId: z.string().optional(),
  coverUrl: z.string().url().nullable().optional(),
  trackNumber: z.number().int().positive().nullable().optional(),
  discNumber: z.number().int().positive().nullable().optional(),
  externalIds: TrackExternalIdsSchema.optional(),
});

/** Compact reference to a release group, embedded in every full release payload. */
export const ReleaseGroupRefSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  firstYear: z.number().int().nullable(),
});

/** One edition in a list (release group page, "other editions" of a release). */
export const EditionSummarySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  editionLabel: z.string().nullable(),
  releaseType: ReleaseTypeSchema,
  releaseDate: z.string().nullable(),
  year: z.number().int().nullable(),
  country: z.string().nullable(),
  format: z.string().nullable(),
  label: z.string().nullable(),
  trackCount: z.number().int().nonnegative().nullable(),
  coverUrl: z.string().url().nullable(),
  dominantColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#26262B'),
  audienceAvg: z.number().nullable(),
  audienceCount: z.number().int(),
  criticAvg: z.number().nullable(),
  criticCount: z.number().int(),
});

export const CatalogReleaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  artistName: z.string().min(1),
  releaseType: ReleaseTypeSchema.default('ALBUM'),
  coverUrl: z.string().url().nullable().optional(),
  dominantColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#26262B'),
  releaseDate: z.string().nullable().optional(),
  genres: z.array(z.string()).default([]),
  label: z.string().nullable().optional(),
  /** Barcode (UPC/EAN) when known. */
  upc: z.string().nullable().optional(),
  trackCount: z.number().int().nonnegative().nullable().optional(),
  /** Which database the cover image comes from (null = set by hand / seed). */
  coverSource: CatalogSourceSchema.nullable().optional(),
  externalIds: ReleaseExternalIdsSchema.optional(),

  // ADR-012: a release is one edition of a release group (the album as a work).
  /** "2011 Remaster", "Super Deluxe Edition"...; null = plain/original edition or unknown. */
  editionLabel: z.string().nullable().optional(),
  /** ISO 3166-1 alpha-2 country of this edition (MusicBrainz), "XW" = worldwide. */
  country: z.string().nullable().optional(),
  /** Medium format of this edition (MusicBrainz: "CD", "Digital Media", "12\" Vinyl"...). */
  format: z.string().nullable().optional(),
  /** The work this edition belongs to; null for rows not linked yet. Omitted by some lists. */
  group: ReleaseGroupRefSchema.nullable().optional(),

  // ADR-001: Punteggi Rotten Tomatoes / RYM
  audienceAvg: z.number().nullable().optional(), // 0.5 - 5.0
  audienceFreshPct: z.number().int().min(0).max(100).nullable().optional(), // % >= 70
  audienceCount: z.number().int().default(0),
  criticAvg: z.number().nullable().optional(),
  criticFreshPct: z.number().int().min(0).max(100).nullable().optional(),
  criticCount: z.number().int().default(0),

  tracks: z.array(CatalogTrackSchema).optional(),
  /**
   * Only on `GET /api/catalog/releases/:id`: the other editions of the same group, oldest first
   * (empty when the release is the only known edition).
   */
  otherEditions: z.array(EditionSummarySchema).optional(),
});

/** Scores of a release group: all its editions' reviews, one vote per user (ADR-012). */
export const GroupScoresSchema = z.object({
  audienceAvg: z.number().nullable(),
  audienceFreshPct: z.number().int().min(0).max(100).nullable(),
  audienceCount: z.number().int(),
  criticAvg: z.number().nullable(),
  criticFreshPct: z.number().int().min(0).max(100).nullable(),
  criticCount: z.number().int(),
});

/** `GET /api/catalog/release-groups/:id`: the album as a work with all its known editions. */
export const ReleaseGroupDetailSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  artistName: z.string().min(1),
  primaryType: ReleaseGroupTypeSchema,
  firstYear: z.number().int().nullable(),
  /** Cover of the preferred edition (oldest plain edition with a cover). */
  coverUrl: z.string().url().nullable(),
  dominantColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#26262B'),
  genres: z.array(z.string()).default([]),
  externalIds: z.object({ musicbrainz: z.string().nullable() }),
  scores: GroupScoresSchema,
  /** Editions in the local catalog, oldest first; each keeps its own reviews and scores. */
  editions: z.array(EditionSummarySchema),
  /**
   * True while sibling editions are being fetched from MusicBrainz in the background: reload
   * later to see them.
   */
  editionsSyncing: z.boolean(),
});

/**
 * `GET /api/catalog/search`: local results first, then results imported from external databases
 * (deduplicated by ISRC / UPC / normalized title + artist). Every id is an internal UUID.
 * Pages are independent: an item imported on page 1 can reappear on a later page, so clients
 * that append pages should dedupe by `id`.
 */
export const SearchResultSchema = z.object({
  releases: z.array(CatalogReleaseSchema),
  tracks: z.array(CatalogTrackSchema),
  page: z.number().int().positive().default(1),
  hasMore: z.boolean().default(false),
  /** Databases that contributed to this page (`LOCAL` included when local rows matched). */
  sources: z.array(CatalogSourceSchema).default([]),
});

// ADR-003: Audio Preview Resolver Fallback (Spotify -> Deezer -> iTunes)
export const AudioPreviewSourceSchema = z.enum(['SPOTIFY', 'DEEZER', 'ITUNES', 'NONE']);

/** Bounded: the values end up in Deezer/iTunes query strings and cache keys. */
export const AudioPreviewResolveQuerySchema = z.object({
  isrc: z.string().max(32).optional(),
  title: z.string().min(1).max(300),
  artist: z.string().min(1).max(300),
});

export const AudioPreviewResultSchema = z.object({
  previewUrl: z.string().url().nullable(),
  source: AudioPreviewSourceSchema,
  durationSeconds: z.number().default(30),
});

const booleanQueryParam = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** `GET /api/catalog/search?q=&type=&page=&limit=&external=` */
export const CatalogSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  type: z.enum(['all', 'releases', 'tracks']).default('all'),
  page: z.coerce.number().int().min(1).max(20).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  /** `false` = only the local catalog (no calls to external databases). */
  external: booleanQueryParam.default('true'),
});

/** External databases that `GET /api/catalog/resolve` accepts. */
export const CatalogProviderSchema = z.enum(['deezer', 'itunes', 'musicbrainz']);

/**
 * `GET /api/catalog/resolve?provider=deezer&type=release&id=302127`: imports (or finds) the
 * release in the local catalog and returns it with its internal UUID. `type=track` resolves a
 * provider track and returns its release plus the internal `trackId`.
 */
export const CatalogResolveQuerySchema = z.object({
  provider: CatalogProviderSchema,
  type: z.enum(['release', 'track']).default('release'),
  id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,64}$/, 'Id esterno non valido'),
});

export const CatalogResolveResultSchema = z.object({
  release: CatalogReleaseSchema,
  /** Internal UUID of the resolved track when `type=track`, otherwise null. */
  trackId: z.string().nullable(),
});

/** `GET /api/catalog/releases?genre=&cursor=&limit=` (explore page). */
export const BrowseReleasesQuerySchema = z.object({
  genre: z.string().trim().min(1).max(40).optional(),
  sort: z.enum(['popular', 'recent']).default('popular'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const ReleasePageSchema = z.object({
  items: z.array(CatalogReleaseSchema),
  nextCursor: z.string().nullable(),
});

/** `GET /api/catalog/genres` */
export const GenreListSchema = z.array(
  z.object({ name: z.string(), releaseCount: z.number().int() })
);

export type CatalogSearchQuery = z.input<typeof CatalogSearchQuerySchema>;
export type CatalogSearchParams = z.output<typeof CatalogSearchQuerySchema>;
export type CatalogSource = z.infer<typeof CatalogSourceSchema>;
export type CatalogProvider = z.infer<typeof CatalogProviderSchema>;
export type CatalogResolveQuery = z.input<typeof CatalogResolveQuerySchema>;
export type CatalogResolveParams = z.output<typeof CatalogResolveQuerySchema>;
export type CatalogResolveResult = z.infer<typeof CatalogResolveResultSchema>;
export type ReleaseExternalIds = z.infer<typeof ReleaseExternalIdsSchema>;
export type TrackExternalIds = z.infer<typeof TrackExternalIdsSchema>;
export type BrowseReleasesQuery = z.input<typeof BrowseReleasesQuerySchema>;
export type ReleasePage = z.infer<typeof ReleasePageSchema>;
export type GenreList = z.infer<typeof GenreListSchema>;
export type ReleaseType = z.infer<typeof ReleaseTypeSchema>;
export type ReleaseGroupType = z.infer<typeof ReleaseGroupTypeSchema>;
export type ReleaseGroupRef = z.infer<typeof ReleaseGroupRefSchema>;
export type EditionSummary = z.infer<typeof EditionSummarySchema>;
export type GroupScores = z.infer<typeof GroupScoresSchema>;
export type ReleaseGroupDetail = z.infer<typeof ReleaseGroupDetailSchema>;
export type CatalogTrack = z.infer<typeof CatalogTrackSchema>;
export type CatalogRelease = z.infer<typeof CatalogReleaseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type AudioPreviewSource = z.infer<typeof AudioPreviewSourceSchema>;
export type AudioPreviewResolveQuery = z.infer<typeof AudioPreviewResolveQuerySchema>;
export type AudioPreviewResult = z.infer<typeof AudioPreviewResultSchema>;
