import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { configureApiClient } from '../../../lib/api';
import { createFakeAudio } from '../testing/audioMock';
import { ME_ID, PLAYLIST_ID, fakeApi, me, reelsFeed } from '../testing/fixtures';

const mockAudio = createFakeAudio();
jest.mock('expo-audio', () => mockAudio.module);
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

const ITUNES_CLIP = 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/p2.m4a';

function setup() {
  const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');
  SecureStore.__store.set('om_session_token', 'jwt-stored');
  const feed = reelsFeed();
  const api = fakeApi({
    'GET /api/auth/me': { body: me },
    'GET /api/discovery/reels': { body: feed },
    'GET /api/catalog/preview': (call) => ({
      body: {
        previewUrl: call.query.get('title') === 'Paranoid Android' ? ITUNES_CLIP : null,
        source: 'ITUNES',
        durationSeconds: 30,
      },
    }),
    [`GET /api/playlists/user/${ME_ID}`]: { body: [] },
    'POST /api/playlists': {
      status: 201,
      body: {
        id: PLAYLIST_ID,
        userId: ME_ID,
        user: { id: ME_ID, username: 'franco', displayName: 'Franco' },
        title: 'Scoperte dai Reels',
        description: null,
        coverUrl: null,
        isPublic: false,
        sideATracks: [],
        sideBTracks: [],
        totalDurationMs: 0,
        createdAt: '2026-10-21T10:00:00.000Z',
      },
    },
    'POST /api/playlists/track': (call) => ({
      body: {
        id: PLAYLIST_ID,
        userId: ME_ID,
        user: { id: ME_ID, username: 'franco', displayName: 'Franco' },
        title: 'Scoperte dai Reels',
        description: null,
        coverUrl: null,
        isPublic: false,
        sideATracks: [
          {
            id: '99999999-9999-4999-8999-999999999999',
            track: feed.items.find((i) => i.track.id === (call.body as { trackId: string }).trackId)
              ?.track,
            side: 'A',
            position: 0,
            addedAt: '2026-10-21T10:00:00.000Z',
          },
        ],
        sideBTracks: [],
        totalDurationMs: 287000,
        createdAt: '2026-10-21T10:00:00.000Z',
      },
    }),
  });
  configureApiClient({ fetch: api.fetch });
  return { api, feed };
}

afterEach(() => {
  configureApiClient({});
  jest.clearAllMocks();
  mockAudio.player.source = null;
  mockAudio.player.playing = false;
});

async function openReels() {
  await renderRouter('./app', { initialUrl: '/reels' });
  const feedView = await screen.findByTestId('reels-feed', {}, { timeout: 5000 });
  await fireEvent(feedView, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } },
  });
  await screen.findByText('Airbag');
}

it('autoplays the first clip and pre-buffers the next two (resolving the missing one)', async () => {
  const { api, feed } = setup();
  await openReels();

  await waitFor(() =>
    expect(mockAudio.player.replace).toHaveBeenCalledWith({ uri: feed.items[0]?.track.previewUrl })
  );
  expect(mockAudio.player.play).toHaveBeenCalled();
  expect(mockAudio.player.loop).toBe(true);

  // N+1 has no stored clip: resolved through /api/catalog/preview (with its ISRC), then buffered.
  await waitFor(() =>
    expect(mockAudio.preload).toHaveBeenCalledWith({ uri: ITUNES_CLIP }, expect.anything())
  );
  expect(mockAudio.preload).toHaveBeenCalledWith(
    { uri: feed.items[2]?.track.previewUrl },
    expect.anything()
  );
  expect(mockAudio.preload).not.toHaveBeenCalledWith(
    { uri: feed.items[3]?.track.previewUrl },
    expect.anything()
  );
  const lookup = api.calls.find((c) => c.path === '/api/catalog/preview');
  expect(lookup?.query.get('isrc')).toBe('GBAYE9700002');
});

it('pauses on tap and saves to the private "Scoperte dai Reels" playlist, created on first save', async () => {
  const { api, feed } = setup();
  await openReels();
  await waitFor(() => expect(mockAudio.player.play).toHaveBeenCalled());

  await fireEvent.press(screen.getByLabelText('Metti in pausa Airbag'));
  expect(mockAudio.player.pause).toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('Salva Airbag nella playlist Scoperte dai Reels'));
  await screen.findByText('Salvato in “Scoperte dai Reels”');
  const create = api.calls.find((c) => c.method === 'POST' && c.path === '/api/playlists');
  expect(create?.body).toMatchObject({ title: 'Scoperte dai Reels', isPublic: false });
  const add = api.calls.find((c) => c.path === '/api/playlists/track');
  expect(add?.body).toEqual({
    playlistId: PLAYLIST_ID,
    trackId: feed.items[0]?.track.id,
    side: 'A',
  });
  expect(screen.getByLabelText('Airbag è già nella playlist Scoperte dai Reels')).toBeTruthy();
});

it('hides a reel with "Non fa per me" and undoes it', async () => {
  setup();
  await openReels();

  await fireEvent.press(screen.getByLabelText('Non fa per me: nascondi Airbag'));
  expect(screen.queryByText('Airbag')).toBeNull();
  await screen.findByText('Nascosto: Airbag');

  await fireEvent.press(screen.getByLabelText('Annulla'));
  expect(await screen.findByText('Airbag')).toBeTruthy();
});
