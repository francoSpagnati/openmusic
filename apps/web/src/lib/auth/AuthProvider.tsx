'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AuthUser,
  ConnectedAccountInfo,
  LoginInput,
  MeResponse,
  RegisterInput,
  UpdateProfileInput,
} from '@openmusic/shared';
import { authApi } from '../api/auth';
import { isApiError } from '../api/errors';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  /** Null unless `status === 'authenticated'`. */
  user: AuthUser | null;
  connectedAccounts: ConnectedAccountInfo[];
  /** Rejects with `ApiError` (`INVALID_CREDENTIALS`, `RATE_LIMITED`, ...). */
  login: (input: LoginInput) => Promise<AuthUser>;
  /** Rejects with `ApiError` (`VALIDATION_ERROR` with fieldErrors, `CONFLICT`, ...). */
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-fetches `/api/auth/me` (e.g. after linking Spotify). */
  refresh: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface SessionState {
  status: AuthStatus;
  session: MeResponse | null;
}

/**
 * Session state for the whole app. The API keeps the session in an httpOnly cookie, so this
 * provider never sees or stores a token: it only asks `/api/auth/me` who is signed in.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  const applySession = useCallback((session: MeResponse | null) => {
    setState({ status: session ? 'authenticated' : 'anonymous', session });
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySession(await authApi.me());
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        applySession(null);
        return;
      }
      // Network/server error: keep the current state and let the caller show the error.
      throw err;
    }
  }, [applySession]);

  useEffect(() => {
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(applySession)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        applySession(null);
      });
    return () => controller.abort();
  }, [applySession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const { user, connectedAccounts } = await authApi.login(input);
      applySession({ user, connectedAccounts });
      return user;
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { user, connectedAccounts } = await authApi.register(input);
      applySession({ user, connectedAccounts });
      return user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // The socket hook disconnects on its own when status becomes 'anonymous'.
      applySession(null);
    }
  }, [applySession]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const session = await authApi.updateMe(input);
      applySession(session);
      return session.user;
    },
    [applySession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.session?.user ?? null,
      connectedAccounts: state.session?.connectedAccounts ?? [],
      login,
      register,
      logout,
      refresh,
      updateProfile,
    }),
    [state, login, register, logout, refresh, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
