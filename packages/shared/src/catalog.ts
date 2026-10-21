import { z } from 'zod';

export const ReleaseTypeSchema = z.enum(['ALBUM', 'SINGLE', 'EP']);

export const CatalogTrackSchema = z.object({
  id: z.string(),
  isrc: z.string().nullable().optional(),
  title: z.string().min(1),
  artistName: z.string().min(1),
  durationMs: z.number().int().positive(),
  previewUrl: z.string().url().nullable().optional(),
  releaseId: z.string().optional(),
  coverUrl: z.string().url().nullable().optional(),
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

  // ADR-001: Punteggi Rotten Tomatoes / RYM
  audienceAvg: z.number().nullable().optional(), // 0.5 - 5.0
  audienceFreshPct: z.number().int().min(0).max(100).nullable().optional(), // % >= 70
  audienceCount: z.number().int().default(0),
  criticAvg: z.number().nullable().optional(),
  criticFreshPct: z.number().int().min(0).max(100).nullable().optional(),
  criticCount: z.number().int().default(0),

  tracks: z.array(CatalogTrackSchema).optional(),
});

export const SearchResultSchema = z.object({
  releases: z.array(CatalogReleaseSchema),
  tracks: z.array(CatalogTrackSchema),
});

// ADR-003: Audio Preview Resolver Fallback (Spotify -> Deezer -> iTunes)
export const AudioPreviewSourceSchema = z.enum(['SPOTIFY', 'DEEZER', 'ITUNES', 'NONE']);

export const AudioPreviewResolveQuerySchema = z.object({
  isrc: z.string().optional(),
  title: z.string().min(1),
  artist: z.string().min(1),
});

export const AudioPreviewResultSchema = z.object({
  previewUrl: z.string().url().nullable(),
  source: AudioPreviewSourceSchema,
  durationSeconds: z.number().default(30),
});

/** `GET /api/catalog/search?q=` */
export const CatalogSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
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
export type BrowseReleasesQuery = z.input<typeof BrowseReleasesQuerySchema>;
export type ReleasePage = z.infer<typeof ReleasePageSchema>;
export type GenreList = z.infer<typeof GenreListSchema>;
export type ReleaseType = z.infer<typeof ReleaseTypeSchema>;
export type CatalogTrack = z.infer<typeof CatalogTrackSchema>;
export type CatalogRelease = z.infer<typeof CatalogReleaseSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type AudioPreviewSource = z.infer<typeof AudioPreviewSourceSchema>;
export type AudioPreviewResolveQuery = z.infer<typeof AudioPreviewResolveQuerySchema>;
export type AudioPreviewResult = z.infer<typeof AudioPreviewResultSchema>;
