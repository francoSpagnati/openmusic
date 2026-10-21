import { z } from 'zod';
import { CatalogTrackSchema } from './catalog';
import { CursorQuerySchema, pageSchema } from './common';
import { UserSummarySchema } from './users';

/** Release card attached to a post. */
export const PostReleaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artistName: z.string(),
  coverUrl: z.string().url().nullable(),
  dominantColor: z.string().nullable(),
  releaseDate: z.string().nullable(),
  /** First track with a resolved 30s preview, if any, so the card can play instantly. */
  previewTrack: CatalogTrackSchema.nullable(),
});

/**
 * A feed post. ADR-002: there are no public comment threads, only likes and private saves;
 * discussion happens in direct chat.
 */
export const PostSchema = z.object({
  id: z.string().uuid(),
  author: UserSummarySchema,
  content: z.string(),
  release: PostReleaseSchema.nullable(),
  track: CatalogTrackSchema.nullable(),
  /** Same 10..100 scale as reviews (3.5 stars = 70). */
  rating: z.number().int().min(10).max(100).nullable(),
  vibeTags: z.array(z.string()),
  likeCount: z.number().int().nonnegative(),
  isLikedByMe: z.boolean(),
  isSavedByMe: z.boolean(),
  createdAt: z.string(),
});

export const CreatePostInputSchema = z
  .object({
    content: z.string().trim().min(1).max(2000),
    releaseId: z.string().uuid().optional(),
    trackId: z.string().uuid().optional(),
    rating: z.number().int().min(10).max(100).optional(),
    vibeTags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
  })
  .refine((p) => p.rating === undefined || p.releaseId !== undefined || p.trackId !== undefined, {
    message: 'Un voto richiede un disco o un brano allegato',
    path: ['rating'],
  });

/** `GET /api/feed` — `scope=following` (default, people you follow + you) or `global`. */
export const FeedQuerySchema = CursorQuerySchema.extend({
  scope: z.enum(['following', 'global']).default('following'),
});

export const PostPageSchema = pageSchema(PostSchema);

export const PostLikeStateSchema = z.object({
  postId: z.string().uuid(),
  isLikedByMe: z.boolean(),
  likeCount: z.number().int().nonnegative(),
});

export const PostSaveStateSchema = z.object({
  postId: z.string().uuid(),
  isSavedByMe: z.boolean(),
});

export type PostRelease = z.infer<typeof PostReleaseSchema>;
export type Post = z.infer<typeof PostSchema>;
export type CreatePostInput = z.input<typeof CreatePostInputSchema>;
export type FeedQuery = z.input<typeof FeedQuerySchema>;
export type PostPage = z.infer<typeof PostPageSchema>;
export type PostLikeState = z.infer<typeof PostLikeStateSchema>;
export type PostSaveState = z.infer<typeof PostSaveStateSchema>;
