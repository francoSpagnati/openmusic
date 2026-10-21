import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { configureApiClient } from '../lib/api';

/**
 * Smoke test of the real route tree in ./app: an anonymous user is sent to the login screen
 * by the root `Stack.Protected` guards.
 */
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  useFonts: () => [true, null],
}));

afterEach(() => configureApiClient({}));

it('shows the login screen to anonymous users', async () => {
  configureApiClient({ fetch: jest.fn() });
  const router = await renderRouter('./app', { initialUrl: '/' });
  await waitFor(() => expect(screen.getByText('Bentornato')).toBeTruthy());
  expect(router.getPathname()).toBe('/login');
});

jest.mock('socket.io-client', () => ({
  io: () => ({
    connected: false,
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    timeout: jest.fn(),
  }),
}));

it('restores a stored session and renders the home feed from the API', async () => {
  const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');
  SecureStore.__store.set('om_session_token', 'jwt-stored');
  const author = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'elena',
    displayName: 'Elena Rossi',
    avatarUrl: null,
    role: 'USER',
    isFollowedByMe: true,
  };
  const me = {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
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
    },
    connectedAccounts: [],
  };
  const feed = {
    items: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        author,
        content: 'Weird Fishes resta ipnotica.',
        release: null,
        track: null,
        rating: 90,
        vibeTags: [],
        likeCount: 3,
        isLikedByMe: false,
        isSavedByMe: false,
        createdAt: '2026-10-21T08:00:00.000Z',
      },
    ],
    nextCursor: null,
  };
  const auth: string[] = [];
  configureApiClient({
    fetch: async (url, init) => {
      auth.push((init.headers as Record<string, string>).Authorization ?? '');
      const body = url.includes('/api/auth/me') ? me : url.includes('/api/feed') ? feed : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const router = await renderRouter('./app', { initialUrl: '/' });
  await waitFor(() => expect(screen.getByText('Weird Fishes resta ipnotica.')).toBeTruthy());
  expect(router.getPathname()).toBe('/');
  expect(auth.every((h) => h === 'Bearer jwt-stored')).toBe(true);
  SecureStore.__store.clear();
});
