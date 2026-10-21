import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { CatalogRelease, GenreRouletteResult, SearchResult } from '@openmusic/shared';
import { configureApiClient } from '../../../lib/api';
import { createFakeAudio } from '../testing/audioMock';
import { fakeApi, me, okComputer, okTrack } from '../testing/fixtures';

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

const kidA: CatalogRelease = {
  ...okComputer,
  id: '4b1c2d3e-0000-4000-8000-000000000001',
  title: 'Kid A',
  releaseDate: '2000-10-02',
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/kid-a/600x600bb.jpg',
  coverSource: 'ITUNES',
  tracks: undefined,
};

const roulette: GenreRouletteResult = {
  genre: 'Shoegaze',
  tagline: 'Muri di chitarre riverberate, feedback ipnotico e melodie sommerse',
  context: 'Nato nel Regno Unito nei tardi anni 80.',
  starterTracks: [
    {
      id: 'sample-Slowdive-Alison',
      title: 'Alison',
      artistName: 'Slowdive',
      durationMs: 180000,
      previewUrl: 'https://cdnt-preview.dzcdn.net/api/1/1/alison.mp3',
      coverUrl: null,
    },
  ],
};

function setup() {
  const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');
  SecureStore.__store.set('om_session_token', 'jwt-stored');
  const page = (n: number): SearchResult => ({
    // Page 2 repeats OK Computer (imported on page 1): the client must not show it twice.
    releases:
      n === 1
        ? [{ ...okComputer, tracks: undefined }]
        : [{ ...okComputer, tracks: undefined }, kidA],
    tracks: n === 1 ? [okTrack(6)] : [],
    page: n,
    hasMore: n === 1,
    sources: n === 1 ? ['LOCAL', 'DEEZER'] : ['ITUNES'],
  });
  const api = fakeApi({
    'GET /api/auth/me': { body: me },
    'GET /api/catalog/releases': {
      body: { items: [{ ...okComputer, tracks: undefined }], nextCursor: null },
    },
    'GET /api/catalog/genres': {
      body: [
        { name: 'Alternative', releaseCount: 12 },
        { name: 'Shoegaze', releaseCount: 3 },
      ],
    },
    'GET /api/catalog/search': (call) => ({ body: page(Number(call.query.get('page') ?? '1')) }),
    'GET /api/discovery/roulette': { body: roulette },
  });
  configureApiClient({ fetch: api.fetch });
  return api;
}

afterEach(() => {
  configureApiClient({});
  jest.clearAllMocks();
  mockAudio.player.source = null;
  mockAudio.player.playing = false;
});

it('searches the catalog, shows sources and pages without duplicates', async () => {
  const api = setup();
  await renderRouter('./app', { initialUrl: '/explore' });
  await screen.findByText('Più ascoltati', {}, { timeout: 5000 });
  expect(screen.getByText('Alternative')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText(/^Cerca album, artisti, brani/), 'radiohead');
  await screen.findByLabelText('Fonti: OpenMusic, Deezer', {}, { timeout: 3000 });
  const first = api.calls.find((c) => c.path === '/api/catalog/search');
  expect(Object.fromEntries(first?.query ?? [])).toEqual({
    q: 'radiohead',
    type: 'releases',
    page: '1',
    limit: '20',
  });
  // Source badge + the cover-source badge on the OK Computer row.
  expect(screen.getAllByText('Deezer')).toHaveLength(2);

  await fireEvent.press(screen.getByLabelText('Carica altri'));
  await screen.findByText('Kid A');
  expect(screen.getAllByText('OK Computer')).toHaveLength(1);
  expect(screen.getByLabelText('Fonti: OpenMusic, Deezer, iTunes')).toBeTruthy();
  expect(screen.getAllByText('iTunes')).toHaveLength(2);

  await fireEvent.press(screen.getByLabelText('Brani'));
  await screen.findByText('Karma Police');
  await waitFor(() =>
    expect(
      api.calls
        .filter((c) => c.path === '/api/catalog/search')
        .at(-1)
        ?.query.get('type')
    ).toBe('tracks')
  );
});

it('spins the genre roulette and previews a starter track', async () => {
  setup();
  await renderRouter('./app', { initialUrl: '/explore' });
  await fireEvent.press(await screen.findByLabelText('Gira la roulette', {}, { timeout: 5000 }));
  expect(
    await screen.findByText('Muri di chitarre riverberate, feedback ipnotico e melodie sommerse')
  ).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Ascolta 30 secondi di Alison di Slowdive'));
  await waitFor(() =>
    expect(mockAudio.player.replace).toHaveBeenCalledWith({
      uri: 'https://cdnt-preview.dzcdn.net/api/1/1/alison.mp3',
    })
  );
  await fireEvent.press(screen.getByLabelText('Cerca Alison di Slowdive nel catalogo'));
  expect(screen.getByDisplayValue('Slowdive Alison')).toBeTruthy();
});
