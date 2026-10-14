import { z } from 'zod';
import { CatalogTrackSchema, CatalogReleaseSchema } from './catalog';

export const TopReviewSnippetSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  authorAvatarUrl: z.string().url().nullable().optional(),
  rating: z.number().int().min(10).max(100),
  snippet: z.string(),
  isVerifiedListen: z.boolean(),
});

export const DiscoveryReelItemSchema = z.object({
  id: z.string(),
  track: CatalogTrackSchema,
  release: CatalogReleaseSchema,
  topReviewSnippet: TopReviewSnippetSchema.nullable().optional(),
  isSaved: z.boolean().default(false),
});

export const DiscoveryFeedResponseSchema = z.object({
  items: z.array(DiscoveryReelItemSchema),
  nextCursor: z.string().nullable().optional(),
});

export const GenreRouletteResultSchema = z.object({
  genre: z.string(),
  tagline: z.string(),
  starterTracks: z.array(CatalogTrackSchema),
  context: z.string().optional(),
});

export type TopReviewSnippet = z.infer<typeof TopReviewSnippetSchema>;
export type DiscoveryReelItem = z.infer<typeof DiscoveryReelItemSchema>;
export type DiscoveryFeedResponse = z.infer<typeof DiscoveryFeedResponseSchema>;
export type GenreRouletteResult = z.infer<typeof GenreRouletteResultSchema>;
