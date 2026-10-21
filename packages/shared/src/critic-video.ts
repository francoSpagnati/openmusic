import { z } from 'zod';

// ==========================================
// 1. CRITIC ACCREDITATION & CRITIC SCORE (ADR-001)
// ==========================================

export const CriticAccreditationRequestSchema = z.object({
  outletName: z.string().min(2).max(100),
  portfolioUrl: z.string().url(),
  bio: z.string().max(500).optional(),
});

export const CriticAccreditationStatusSchema = z.object({
  status: z.enum(['NONE', 'PENDING', 'APPROVED']),
  outletName: z.string().nullable(),
  requestedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
});

/** `POST /api/critic/verify` (ADMIN only). `approve: false` rejects the pending request. */
export const CriticVerifyInputSchema = z.object({
  userId: z.string().uuid(),
  approve: z.boolean(),
});

export const PendingCriticRequestSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  outletName: z.string(),
  portfolioUrl: z.string().nullable(),
  requestedAt: z.string(),
});

export const PublishCriticReviewInputSchema = z.object({
  releaseId: z.string().uuid(),
  rating: z.number().int().min(10).max(100),
  content: z.string().min(10).max(5000),
  originalReviewUrl: z.string().url().optional(),
});

export const VideoFeedQuerySchema = z.object({
  category: z.enum(['ESSAY', 'REVIEW', 'INTERVIEW', 'LIVE_SESSION']).optional(),
});

export const CriticReviewItemSchema = z.object({
  id: z.string().uuid(),
  criticId: z.string().uuid(),
  criticName: z.string(),
  criticAvatarUrl: z.string().url().nullable().optional(),
  outletName: z.string(),
  originalReviewUrl: z.string().url().nullable().optional(),
  rating: z.number().int().min(10).max(100),
  quoteSnippet: z.string(),
  releaseId: z.string().uuid(),
  createdAt: z.string(),
});

export const DualScoreDetailsSchema = z.object({
  releaseId: z.string(),
  audienceAvg: z.number().nullable(),
  audienceFreshPct: z.number().nullable(),
  audienceCount: z.number().int(),
  criticAvg: z.number().nullable(),
  criticFreshPct: z.number().nullable(),
  criticCount: z.number().int(),
});

// ==========================================
// 2. VIDEO-CONTENUTI & SAGGI MUSICALI
// ==========================================

export const VideoCategorySchema = z.enum([
  'ESSAY', // Video-saggio o approfondimento
  'REVIEW', // Video-recensione critica
  'INTERVIEW', // Intervista all'artista
  'LIVE_SESSION', // Esibizione dal vivo o sessione in studio
]);

export const MusicVideoItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  creatorName: z.string().min(1),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  durationSeconds: z.number().int().positive(),
  releaseId: z.string().nullable().optional(),
  category: VideoCategorySchema,
  createdAt: z.string(),
});

export const CreateVideoContentInputSchema = z.object({
  title: z.string().min(3).max(150),
  creatorName: z.string().min(2).max(100),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().int().positive(),
  releaseId: z.string().uuid().optional(),
  category: VideoCategorySchema.default('ESSAY'),
});

export type CriticAccreditationRequest = z.infer<typeof CriticAccreditationRequestSchema>;
export type CriticAccreditationStatus = z.infer<typeof CriticAccreditationStatusSchema>;
export type CriticVerifyInput = z.infer<typeof CriticVerifyInputSchema>;
export type PendingCriticRequest = z.infer<typeof PendingCriticRequestSchema>;
export type PublishCriticReviewInput = z.infer<typeof PublishCriticReviewInputSchema>;
export type CriticReviewItem = z.infer<typeof CriticReviewItemSchema>;
export type DualScoreDetails = z.infer<typeof DualScoreDetailsSchema>;
export type VideoCategory = z.infer<typeof VideoCategorySchema>;
export type MusicVideoItem = z.infer<typeof MusicVideoItemSchema>;
export type CreateVideoContentInput = z.input<typeof CreateVideoContentInputSchema>;
