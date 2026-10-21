import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AuthUser,
  ChangePasswordInput,
  ConnectedAccountInfo,
  LoginInput,
  MeResponse,
  RegisterInput,
  UpdateProfileInput,
} from '@openmusic/shared';
import { authApi } from '../api/auth';
import { getAuthToken, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { isApiError } from '../api/errors';
import { tokenStore } from '../api/tokenStore';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  /** Null unless `status === 'authenticated'`. */
  user: AuthUser | null;
  connectedAccounts: ConnectedAccountInfo[];
  /** The Bearer token (for the socket handshake). Null when signed out. */
  token: string | null;
  /** Rejects with `ApiError` (`INVALID_CREDENTIALS`, `RATE_LIMITED`, ...). */
  login: (input: LoginInput) => Promise<AuthUser>;
  /** Rejects with `ApiError` (`VALIDATION_ERROR` with fieldErrors, `CONFLICT`, ...). */
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-fetches `/api/auth/me`. */
  refresh: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser>;
  /** Changes the password and signs this device in again (the API revokes every token). */
  changePassword: (input: ChangePasswordInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface SessionState {
  status: AuthStatus;
  session: MeResponse | null;
  token: string | null;
}

const SIGNED_OUT: SessionState = { status: 'anonymous', session: null, token: null };

/**
 * Session state for the native app. The JWT from `register`/`login` is kept in
 * expo-secure-store and sent as `Authorization: Bearer`. On start-up the stored token is
 * validated with `/api/auth/me`; a 401 (expired/revoked) signs the user out, while a network
 * error keeps the token so the app can retry when the API is reachable again.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    session: null,
    token: null,
  });

  const signOutLocally = useCallback(async () => {
    setAuthToken(null);
    await tokenStore.clear();
    setState(SIGNED_OUT);
  }, []);

  const startSession = useCallback(async (token: string, session: MeResponse) => {
    setAuthToken(token);
    await tokenStore.save(token);
    setState({ status: 'authenticated', session, token });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOutLocally();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOutLocally]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStore.load();
      if (!token) {
        if (!cancelled) setState(SIGNED_OUT);
        return;
      }
      setAuthToken(token);
      try {
        const session = await authApi.me();
        if (!cancelled) setState({ status: 'authenticated', session, token });
      } catch (err) {
        if (cancelled) return;
        if (isApiError(err) && err.status === 401) {
          await signOutLocally();
        } else {
          // Offline / server down: we cannot prove the session is valid, so show the login
          // screen but keep the stored token; `refresh()` can restore the session later.
          setAuthToken(null);
          setState({ status: 'anonymous', session: null, token: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOutLocally]);

  const refresh = useCallback(async () => {
    const token = getAuthToken() ?? (await tokenStore.load());
    if (!token) {
      setState(SIGNED_OUT);
      return;
    }
    setAuthToken(token);
    try {
      const session = await authApi.me();
      setState({ status: 'authenticated', session, token });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        await signOutLocally();
        return;
      }
      throw err;
    }
  }, [signOutLocally]);

  const login = useCallback(
    async (input: LoginInput) => {
      const { token, user, connectedAccounts } = await authApi.login(input);
      await startSession(token, { user, connectedAccounts });
      return user;
    },
    [startSession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { token, user, connectedAccounts } = await authApi.register(input);
      await startSession(token, { user, connectedAccounts });
      return user;
    },
    [startSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logging out must always succeed locally, even offline.
    } finally {
      await signOutLocally();
    }
  }, [signOutLocally]);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const session = await authApi.updateMe(input);
    setState((prev) => ({ ...prev, status: 'authenticated', session }));
    return session.user;
  }, []);

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      // The change bumps sessionVersion, revoking our Bearer token: the API returns a fresh one.
      const { token } = await authApi.changePassword(input);
      if (!state.session) {
        await signOutLocally();
        return;
      }
      await startSession(token, state.session);
    },
    [state.session, signOutLocally, startSession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.session?.user ?? null,
      connectedAccounts: state.session?.connectedAccounts ?? [],
      token: state.status === 'authenticated' ? state.token : null,
      login,
      register,
      logout,
      refresh,
      updateProfile,
      changePassword,
    }),
    [state, login, register, logout, refresh, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
