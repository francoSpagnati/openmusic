import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '..';
import { configureApiClient, getAuthToken, type FetchLike } from '../../api';

const USER = {
  id: '11111111-2222-4333-8444-555555555555',
  username: 'franco',
  displayName: 'Franco',
  email: 'franco@openmusic.test',
  avatarUrl: null,
  bio: null,
  role: 'USER',
  isGhostMode: false,
  favoriteGenres: [],
  hasPassword: true,
  createdAt: '2026-10-01T10:00:00.000Z',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UNAUTHORIZED = { statusCode: 401, code: 'UNAUTHORIZED', message: 'Sessione scaduta' };

let handle: ReturnType<typeof useAuth> | null = null;
function Probe() {
  handle = useAuth();
  return <Text testID="status">{`${handle.status}:${handle.user?.username ?? '-'}`}</Text>;
}

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

afterEach(() => {
  store.clear();
  handle = null;
  configureApiClient({});
});

describe('AuthProvider', () => {
  it('starts anonymous without a stored token', async () => {
    configureApiClient({ fetch: jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>() });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('anonymous:-'));
  });

  it('logs in, keeps the JWT in secure storage and sends it as Bearer', async () => {
    const seen: string[] = [];
    configureApiClient({
      fetch: async (url, init) => {
        seen.push(
          `${init.method} ${url} ${(init.headers as Record<string, string>).Authorization ?? ''}`
        );
        if (url.endsWith('/api/auth/login')) {
          return json(200, {
            user: USER,
            connectedAccounts: [],
            token: 'jwt-abc',
            expiresAt: '2026-10-28T10:00:00.000Z',
          });
        }
        return json(200, { user: USER, connectedAccounts: [] });
      },
    });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(handle?.status).toBe('anonymous'));

    await act(async () => {
      await handle?.login({ email: 'franco@openmusic.test', password: 'openmusic-dev' });
    });

    expect(screen.getByTestId('status').props.children).toBe('authenticated:franco');
    expect(store.get('om_session_token')).toBe('jwt-abc');
    expect(getAuthToken()).toBe('jwt-abc');

    await act(async () => {
      await handle?.refresh();
    });
    expect(seen[seen.length - 1]).toMatch(/GET .*\/api\/auth\/me Bearer jwt-abc$/);

    await act(async () => {
      await handle?.logout();
    });
    expect(screen.getByTestId('status').props.children).toBe('anonymous:-');
    expect(store.has('om_session_token')).toBe(false);
    expect(getAuthToken()).toBeNull();
  });

  it('drops a stored token that the API rejects (expired or revoked)', async () => {
    store.set('om_session_token', 'revoked');
    configureApiClient({ fetch: async () => json(401, UNAUTHORIZED) });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('anonymous:-'));
    expect(store.has('om_session_token')).toBe(false);
  });

  it('restores the session from a valid stored token', async () => {
    store.set('om_session_token', 'still-valid');
    configureApiClient({ fetch: async () => json(200, { user: USER, connectedAccounts: [] }) });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('authenticated:franco')
    );
    expect(handle?.token).toBe('still-valid');
  });

  it('replaces the revoked token with the one returned by a password change', async () => {
    store.set('om_session_token', 'before-change');
    const seen: string[] = [];
    configureApiClient({
      fetch: async (url, init) => {
        seen.push(
          `${init.method} ${url} ${(init.headers as Record<string, string>).Authorization}`
        );
        if (url.endsWith('/api/auth/password')) {
          return json(200, { token: 'after-change', expiresAt: '2026-10-28T10:00:00.000Z' });
        }
        return json(200, { user: USER, connectedAccounts: [] });
      },
    });
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(handle?.status).toBe('authenticated'));

    await act(async () => {
      await handle?.changePassword({
        currentPassword: 'openmusic-dev',
        newPassword: 'a brand new passphrase',
      });
    });

    expect(seen.some((l) => /POST .*\/api\/auth\/password Bearer before-change$/.test(l))).toBe(
      true
    );
    expect(store.get('om_session_token')).toBe('after-change');
    expect(getAuthToken()).toBe('after-change');
    expect(screen.getByTestId('status').props.children).toBe('authenticated:franco');
    // No second login round-trip with the new password.
    expect(seen.some((l) => l.includes('/api/auth/login'))).toBe(false);
  });
});
