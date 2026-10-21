import {
  AuthSessionResponseSchema,
  ConnectedProviderSchema,
  MeResponseSchema,
  OAuthUrlResponseSchema,
  type AuthSessionResponse,
  type ChangePasswordInput,
  type ConnectedProvider,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  type UpdateProfileInput,
} from '@openmusic/shared';
import { apiRequest } from './client';

/** Local accounts + optional linked providers. The session lives in the httpOnly cookie. */
export const authApi = {
  register: (input: RegisterInput): Promise<AuthSessionResponse> =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: input,
      schema: AuthSessionResponseSchema,
    }),

  login: (input: LoginInput): Promise<AuthSessionResponse> =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: input,
      schema: AuthSessionResponseSchema,
    }),

  logout: (): Promise<void> => apiRequest('/api/auth/logout', { method: 'POST' }),

  me: (signal?: AbortSignal): Promise<MeResponse> =>
    apiRequest('/api/auth/me', { schema: MeResponseSchema, signal }),

  updateMe: (input: UpdateProfileInput): Promise<MeResponse> =>
    apiRequest('/api/auth/me', { method: 'PATCH', body: input, schema: MeResponseSchema }),

  changePassword: (input: ChangePasswordInput): Promise<void> =>
    apiRequest('/api/auth/password', { method: 'POST', body: input }),

  /** Returns the Spotify consent URL; navigate the window to it (`window.location.assign`). */
  spotifyLoginUrl: (): Promise<string> =>
    apiRequest('/api/auth/spotify/login', { schema: OAuthUrlResponseSchema }).then((r) => r.url),

  lastFmLoginUrl: (): Promise<string> =>
    apiRequest('/api/auth/lastfm/login', { schema: OAuthUrlResponseSchema }).then((r) => r.url),

  disconnectProvider: (provider: ConnectedProvider): Promise<MeResponse> =>
    apiRequest(`/api/auth/providers/${ConnectedProviderSchema.parse(provider)}`, {
      method: 'DELETE',
      schema: MeResponseSchema,
    }),
};
