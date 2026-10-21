import {
  AuthSessionResponseSchema,
  ChangePasswordResponseSchema,
  ConnectedProviderSchema,
  MeResponseSchema,
  type AuthSessionResponse,
  type ChangePasswordInput,
  type ChangePasswordResponse,
  type ConnectedProvider,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  type UpdateProfileInput,
} from '@openmusic/shared';
import { apiRequest } from './client';

/**
 * Local accounts. Unlike the web client, the native app uses `AuthSessionResponse.token` as a
 * Bearer token (see docs/06_API_AND_AUTH.md). Spotify/Last.fm linking is web-only for now: the
 * OAuth state lives in a cookie the native app does not keep.
 */
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

  /** Stateless for Bearer clients (the JWT stays valid until it expires); drop it locally. */
  logout: (): Promise<void> => apiRequest('/api/auth/logout', { method: 'POST' }),

  me: (signal?: AbortSignal): Promise<MeResponse> =>
    apiRequest('/api/auth/me', { schema: MeResponseSchema, signal }),

  updateMe: (input: UpdateProfileInput): Promise<MeResponse> =>
    apiRequest('/api/auth/me', { method: 'PATCH', body: input, schema: MeResponseSchema }),

  /**
   * Revokes every session, including this device's Bearer token, and returns a replacement
   * token that `AuthProvider.changePassword` stores in place of the old one.
   */
  changePassword: (input: ChangePasswordInput): Promise<ChangePasswordResponse> =>
    apiRequest('/api/auth/password', {
      method: 'POST',
      body: input,
      schema: ChangePasswordResponseSchema,
    }),

  disconnectProvider: (provider: ConnectedProvider): Promise<MeResponse> =>
    apiRequest(`/api/auth/providers/${ConnectedProviderSchema.parse(provider)}`, {
      method: 'DELETE',
      schema: MeResponseSchema,
    }),
};
