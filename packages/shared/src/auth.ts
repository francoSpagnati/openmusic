import { z } from 'zod';
import { HttpUrlSchema } from './common';

export const UserRoleSchema = z.enum(['USER', 'CRITIC', 'MODERATOR', 'ADMIN']);

/** Lowercase handle: letters, digits, underscore. Shown as `@username`. */
export const UsernameSchema = z
  .string()
  .trim()
  .min(3, 'Almeno 3 caratteri')
  .max(30, 'Massimo 30 caratteri')
  .regex(/^[a-zA-Z0-9_]+$/, 'Solo lettere, numeri e underscore')
  .transform((v) => v.toLowerCase());

export const EmailSchema = z
  .string()
  .trim()
  .email('Email non valida')
  .max(254)
  .transform((v) => v.toLowerCase());

/** NIST 800-63B style: length over composition rules. Max bounds the hashing cost. */
export const PasswordSchema = z
  .string()
  .min(10, 'La password deve avere almeno 10 caratteri')
  .max(128, 'La password può avere al massimo 128 caratteri');

export const FavoriteGenresSchema = z.array(z.string().trim().min(1).max(40)).max(10);

/** The signed-in user, including private fields (email). Only ever returned to its owner. */
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(30),
  displayName: z.string().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  role: UserRoleSchema,
  isGhostMode: z.boolean(),
  favoriteGenres: z.array(z.string()),
  hasPassword: z.boolean(),
  createdAt: z.string(),
});

/** Public projection of a user: never includes email or account settings. */
export const PublicUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  role: UserRoleSchema,
  criticOutlet: z.string().nullable(),
  createdAt: z.string(),
});

export const ConnectedProviderSchema = z.enum(['SPOTIFY', 'LASTFM', 'APPLE_MUSIC']);

export const ConnectedAccountInfoSchema = z.object({
  id: z.string().uuid(),
  provider: ConnectedProviderSchema,
  providerId: z.string(),
  expiresAt: z.string().nullable().optional(),
});

export const RegisterInputSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(50).optional(),
  favoriteGenres: FavoriteGenresSchema.default([]),
});

export const LoginInputSchema = z.object({
  email: EmailSchema,
  // No length rules on login: never reveal the policy to someone guessing.
  password: z.string().min(1).max(128),
});

/** `GET /api/auth/me` */
export const MeResponseSchema = z.object({
  user: AuthUserSchema,
  connectedAccounts: z.array(ConnectedAccountInfoSchema),
});

/**
 * `POST /api/auth/register|login`. The session is ALSO set as the httpOnly `om_session` cookie;
 * browsers should rely on the cookie and ignore `token`. Native clients send
 * `Authorization: Bearer <token>`.
 */
export const AuthSessionResponseSchema = MeResponseSchema.extend({
  token: z.string(),
  expiresAt: z.string(),
});

export const SpotifyAuthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const SpotifyLoginQuerySchema = z.object({
  state: z.string().max(200).optional(),
});

export const LastFmAuthCallbackQuerySchema = z.object({
  token: z.string().optional(),
  /** Echo of the `state` we put in the callback URL (CSRF protection, like Spotify). */
  state: z.string().optional(),
});

export const OAuthUrlResponseSchema = z.object({ url: z.string().url() });

/** `PATCH /api/auth/me` (settings page). */
export const UpdateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    bio: z.string().max(280).optional(),
    avatarUrl: HttpUrlSchema.nullable().optional(),
    isGhostMode: z.boolean().optional(),
    favoriteGenres: FavoriteGenresSchema.optional(),
  })
  .strict();

/** `POST /api/auth/password` */
export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});

/**
 * `POST /api/auth/password` response. The change revokes every session, including the caller's:
 * browsers get a fresh `om_session` cookie, native clients must replace their Bearer token with
 * this one.
 */
export const ChangePasswordResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type ConnectedProvider = z.infer<typeof ConnectedProviderSchema>;
export type ConnectedAccountInfo = z.infer<typeof ConnectedAccountInfoSchema>;
export type RegisterInput = z.input<typeof RegisterInputSchema>;
export type LoginInput = z.input<typeof LoginInputSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type SpotifyAuthCallbackQuery = z.infer<typeof SpotifyAuthCallbackQuerySchema>;
export type LastFmAuthCallbackQuery = z.infer<typeof LastFmAuthCallbackQuerySchema>;
export type OAuthUrlResponse = z.infer<typeof OAuthUrlResponseSchema>;
export type UpdateProfileInput = z.input<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

/** Name of the httpOnly session cookie set by the API. */
export const SESSION_COOKIE_NAME = 'om_session';
