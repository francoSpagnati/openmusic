import { z } from 'zod';
import { UserRoleSchema } from './auth';
import { CursorQuerySchema, pageSchema } from './common';

/** Compact user row used in lists (search, followers, feed authors, notifications). */
export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: UserRoleSchema,
  /** False when the viewer is anonymous or is this user. */
  isFollowedByMe: z.boolean(),
});

/** `GET /api/users/search?q=...` */
export const UserSearchQuerySchema = CursorQuerySchema.extend({
  q: z.string().trim().min(1).max(50),
});

export const UserSummaryPageSchema = pageSchema(UserSummarySchema);

/** Result of follow / unfollow. */
export const FollowStateSchema = z.object({
  userId: z.string().uuid(),
  isFollowedByMe: z.boolean(),
  followersCount: z.number().int().nonnegative(),
});

/** Path param for user-scoped routes (`/api/users/:userId/...`). */
export const UserIdParamSchema = z.object({ userId: z.string().uuid() });

/** `GET /api/users/by-username/:username` */
export const UsernameParamSchema = z.object({
  username: z.string().trim().min(1).max(30),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;
export type UserSearchQuery = z.input<typeof UserSearchQuerySchema>;
export type UserSummaryPage = z.infer<typeof UserSummaryPageSchema>;
export type FollowState = z.infer<typeof FollowStateSchema>;

/** `GET /api/users/suggestions?limit=` — people to follow (not you, not already followed). */
export const UserSuggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const UserSuggestionListSchema = z.array(UserSummarySchema);

export type UserSuggestionsQuery = z.input<typeof UserSuggestionsQuerySchema>;
