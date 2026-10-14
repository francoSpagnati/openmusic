import { z } from 'zod';

export const UserRoleSchema = z.enum(['USER', 'CRITIC', 'MODERATOR']);

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(30),
  displayName: z.string().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  role: UserRoleSchema,
  isGhostMode: z.boolean(),
  createdAt: z.string(),
});

export const ConnectedProviderSchema = z.enum([
  'SPOTIFY',
  'LASTFM',
  'APPLE_MUSIC',
]);

export const ConnectedAccountInfoSchema = z.object({
  id: z.string().uuid(),
  provider: ConnectedProviderSchema,
  providerId: z.string(),
  expiresAt: z.string().nullable().optional(),
});

export const AuthSessionResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
  connectedAccounts: z.array(ConnectedAccountInfoSchema),
});

export const SpotifyAuthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const LastFmAuthCallbackQuerySchema = z.object({
  token: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
  isGhostMode: z.boolean().optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type ConnectedProvider = z.infer<typeof ConnectedProviderSchema>;
export type ConnectedAccountInfo = z.infer<typeof ConnectedAccountInfoSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type SpotifyAuthCallbackQuery = z.infer<typeof SpotifyAuthCallbackQuerySchema>;
export type LastFmAuthCallbackQuery = z.infer<typeof LastFmAuthCallbackQuerySchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
