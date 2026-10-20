import { z } from 'zod';
import { AuthUserSchema } from './auth';
import { CatalogTrackSchema } from './catalog';

export const ReactionTypeSchema = z.enum([
  'AGREE',        // "Condivido al 100%"
  'WELL_WRITTEN',  // "Bella penna / Recensione curata"
  'DISCOVERED',    // "Scoperto grazie a te"
  'HEART',         // Apprezzamento generale
]);

// ADR-001: Il rating viene salvato come intero 10..100 (es. 3.5 stelle = 70)
export const CreateReviewInputSchema = z.object({
  releaseId: z.string().uuid().optional(),
  trackId: z.string().uuid().optional(),
  rating: z.number().int().min(10).max(100),
  content: z.string().max(3000).optional(),
  vibeTags: z.array(z.string().min(1).max(30)).max(5).default([]),
});

export const ReviewAuthorSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(['USER', 'CRITIC', 'MODERATOR']),
});

export const ReviewItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  user: ReviewAuthorSchema,
  releaseId: z.string().uuid().nullable().optional(),
  trackId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(10).max(100),
  content: z.string().nullable(),
  vibeTags: z.array(z.string()),
  isCritic: z.boolean(),
  isVerifiedListen: z.boolean(), // ADR-004: Scrobble Verificato
  reactions: z.record(ReactionTypeSchema, z.number()).default({
    AGREE: 0,
    WELL_WRITTEN: 0,
    DISCOVERED: 0,
    HEART: 0,
  }),
  userReaction: ReactionTypeSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ToggleReactionInputSchema = z.object({
  reviewId: z.string().uuid(),
  type: ReactionTypeSchema,
});

export const HeavyRotationItemSchema = z.object({
  track: CatalogTrackSchema,
  playCount: z.number().int(),
  lastPlayedAt: z.string(),
});

export const UserProfileDataSchema = z.object({
  user: AuthUserSchema,
  recentReviews: z.array(ReviewItemSchema),
  heavyRotation: z.array(HeavyRotationItemSchema),
  stats: z.object({
    totalReviews: z.number().int(),
    verifiedReviews: z.number().int(),
    totalScrobbles: z.number().int(),
    averageRating: z.number().nullable(),
  }),
});

export type ReactionType = z.infer<typeof ReactionTypeSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;
export type ReviewAuthor = z.infer<typeof ReviewAuthorSchema>;
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
export type ToggleReactionInput = z.infer<typeof ToggleReactionInputSchema>;
export type HeavyRotationItem = z.infer<typeof HeavyRotationItemSchema>;
export type UserProfileData = z.infer<typeof UserProfileDataSchema>;
