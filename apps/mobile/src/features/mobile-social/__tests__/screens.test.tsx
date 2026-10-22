import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { configureApiClient } from '../../../lib/api';
import {
  ELENA,
  ELENA_ID,
  ME,
  TRACK,
  json,
  message,
  notification,
  post,
} from '../__fixtures__/social';

/**
 * Social screens on the real route tree (./app) with a signed-in session and a fake API:
 * each test asserts the requests the screen sends, not just what it renders.
 */
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  useFonts: () => [true, null],
}));

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

type Handler = (body: unknown) => { status?: number; body: unknown } | undefined;
type Routes = Record<string, Handler>;

interface Call {
  method: string;
  path: string;
  body: unknown;
}

const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');

function startApi(routes: Routes): Call[] {
  const calls: Call[] = [];
  SecureStore.__store.set('om_session_token', 'jwt-stored');
  configureApiClient({
    fetch: async (url, init) => {
      const { pathname } = new URL(url);
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, path: pathname, body });
      const handler = routes[`${method} ${pathname}`];
      const res = handler?.(body);
      if (res) return json(res.status ?? 200, res.body);
      if (pathname === '/api/auth/me' && method === 'GET')
        return json(200, { user: ME, connectedAccounts: [] });
      return json(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: `Nessuna rotta di test per ${method} ${pathname}`,
      });
    },
  });
  return calls;
}

const PROFILE = {
  user: {
    id: ELENA_ID,
    username: 'elena',
    displayName: 'Elena Rossi',
    avatarUrl: null,
    bio: 'Shoegaze e caffè',
    role: 'USER',
    criticOutlet: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  social: {
    followersCount: 10,
    followingCount: 4,
    postsCount: 1,
    isFollowedByMe: false,
    isMe: false,
  },
  recentReviews: [],
  heavyRotation: [],
  stats: { totalReviews: 0, verifiedReviews: 0, totalScrobbles: 12, averageRating: null },
};

afterEach(() => {
  SecureStore.__store.clear();
  configureApiClient({});
});

it('Home: likes a post optimistically and toggles Ghost Mode through PATCH /api/auth/me', async () => {
  const calls = startApi({
    'GET /api/feed': () => ({ body: { items: [post()], nextCursor: null } }),
    'PUT /api/posts/33333333-3333-4333-8333-333333333333/like': () => ({
      body: { postId: '33333333-3333-4333-8333-333333333333', isLikedByMe: true, likeCount: 4 },
    }),
    'PATCH /api/auth/me': (body) => ({
      body: { user: { ...ME, ...(body as object) }, connectedAccounts: [] },
    }),
    'GET /api/notifications/unread-count': () => ({ body: { count: 2 } }),
  });
  await renderRouter('./app', { initialUrl: '/' });
  await waitFor(() => expect(screen.getByText('Weird Fishes resta ipnotica.')).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText('Notifiche, 2 non lette')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Mi piace, 3 mi piace'));
  await waitFor(() => expect(screen.getByLabelText('Togli mi piace, 4 mi piace')).toBeTruthy());

  const ghost = screen.getByRole('switch', { name: 'Ghost Mode' });
  expect(ghost.props.accessibilityState).toMatchObject({ checked: false });
  await fireEvent.press(ghost);
  await waitFor(() =>
    expect(
      screen.getByRole('switch', { name: 'Ghost Mode' }).props.accessibilityState
    ).toMatchObject({ checked: true })
  );
  expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isGhostMode: true });
});

it('Chat: loads the thread, marks it read and sends a text message', async () => {
  const calls = startApi({
    [`GET /api/chat/conversation/${ELENA_ID}`]: () => ({ body: [message()] }),
    [`POST /api/chat/conversation/${ELENA_ID}/read`]: () => ({ body: { updated: 1 } }),
    [`GET /api/profile/${ELENA_ID}`]: () => ({ body: PROFILE }),
    'POST /api/chat/messages': (body) => ({
      body: message({
        id: '88888888-8888-4888-8888-888888888888',
        senderId: ME.id,
        receiverId: ELENA_ID,
        content: (body as { content: string }).content,
        track: null,
        universalLinks: null,
      }),
    }),
  });
  await renderRouter('./app', { initialUrl: `/chat/${ELENA_ID}` });
  await waitFor(() => expect(screen.getByText(TRACK.title)).toBeTruthy());
  expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/read'))).toBe(true);

  await fireEvent.changeText(screen.getByLabelText('Messaggio'), 'Bellissima, grazie!');
  await fireEvent.press(screen.getByRole('button', { name: 'Invia' }));
  await waitFor(() => expect(screen.getByText('Bellissima, grazie!')).toBeTruthy());
  expect(calls.find((c) => c.path === '/api/chat/messages')?.body).toEqual({
    receiverId: ELENA_ID,
    content: 'Bellissima, grazie!',
  });
});

it('Notifications: marks everything read on open and opens the actor profile on tap', async () => {
  const calls = startApi({
    'GET /api/notifications': () => ({ body: { items: [notification()], nextCursor: null } }),
    'POST /api/notifications/read': () => ({ body: { updated: 1 } }),
    [`GET /api/profile/${ELENA_ID}`]: () => ({ body: PROFILE }),
    [`GET /api/users/${ELENA_ID}/posts`]: () => ({ body: { items: [], nextCursor: null } }),
  });
  const router = await renderRouter('./app', { initialUrl: '/notifications' });
  await waitFor(() => expect(screen.getByText('Elena Rossi ha iniziato a seguirti')).toBeTruthy());
  await waitFor(() => expect(calls.some((c) => c.path === '/api/notifications/read')).toBe(true));
  expect(calls.find((c) => c.path === '/api/notifications/read')?.body).toEqual({});

  await act(async () => {
    await fireEvent.press(screen.getByRole('link', { name: /Elena Rossi ha iniziato a seguirti/ }));
  });
  await waitFor(() => expect(router.getPathname()).toBe(`/profile/${ELENA_ID}`));
});

it('Profile: follows another user optimistically and applies the server count', async () => {
  const calls = startApi({
    [`GET /api/profile/${ELENA_ID}`]: () => ({ body: PROFILE }),
    [`GET /api/users/${ELENA_ID}/posts`]: () => ({
      body: { items: [post({ author: { ...ELENA, isFollowedByMe: false } })], nextCursor: null },
    }),
    [`PUT /api/users/${ELENA_ID}/follow`]: () => ({
      body: { userId: ELENA_ID, isFollowedByMe: true, followersCount: 11 },
    }),
  });
  await renderRouter('./app', { initialUrl: `/profile/${ELENA_ID}` });
  await waitFor(() => expect(screen.getByText('Shoegaze e caffè')).toBeTruthy());
  expect(screen.getByLabelText('10 Follower')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Weird Fishes resta ipnotica.')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Segui' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Segui già' })).toBeTruthy());
  expect(screen.getByLabelText('11 Follower')).toBeTruthy();
  expect(calls.some((c) => c.method === 'PUT' && c.path === `/api/users/${ELENA_ID}/follow`)).toBe(
    true
  );
});

it('Settings: shows the automatic sync state of each linked service (ADR-013)', async () => {
  const lastSyncedAt = new Date(Date.now() - 2 * 60_000).toISOString();
  const calls = startApi({
    'GET /api/auth/me': () => ({
      body: {
        user: ME,
        connectedAccounts: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            provider: 'SPOTIFY',
            providerId: 'spotify-me',
            expiresAt: null,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            provider: 'LASTFM',
            providerId: 'lfm-me',
            expiresAt: null,
          },
        ],
      },
    }),
    'GET /api/now-playing/sync-status': () => ({
      body: {
        autoSyncEnabled: true,
        providers: {
          SPOTIFY: {
            provider: 'SPOTIFY',
            linked: true,
            status: 'ACTIVE',
            lastSyncedAt,
            lastErrorCode: null,
            lastError: null,
            nextPollInSeconds: 20,
          },
          LASTFM: {
            provider: 'LASTFM',
            linked: true,
            status: 'ERROR',
            lastSyncedAt: null,
            lastErrorCode: 'PRIVATE_PROFILE',
            lastError:
              'I tuoi ascolti recenti sono privati: rendili pubblici e ricollega l’account.',
            nextPollInSeconds: null,
          },
        },
      },
    }),
  });
  await renderRouter('./app', { initialUrl: '/settings' });

  await waitFor(() =>
    expect(screen.getByLabelText('Spotify: Sincronizzazione automatica attiva')).toBeTruthy()
  );
  expect(screen.getByText('2 min fa')).toBeTruthy();
  expect(screen.getByLabelText('Last.fm: Sincronizzazione interrotta')).toBeTruthy();
  expect(screen.getByText(/I tuoi ascolti recenti sono privati/)).toBeTruthy();
  expect(calls.filter((c) => c.path === '/api/now-playing/sync-status')).toHaveLength(1);
});
