import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { CatalogRelease } from '@openmusic/shared';
import { configureApiClient } from '../../../../lib/api';
import { createFakeAudio } from '../../testing/audioMock';
import {
  GROUP_ID,
  OKNOTOK_ID,
  RELEASE_ID,
  fakeApi,
  me,
  okComputer,
  okComputerGroup,
  okComputerWithEditions,
} from '../../testing/fixtures';
import { editionFacts, editionName, groupEditions, workTitle } from '../../catalog';

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

function signIn() {
  const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');
  SecureStore.__store.set('om_session_token', 'jwt-stored');
}

function setup(release: CatalogRelease, groupBody: unknown = okComputerGroup, groupStatus = 200) {
  signIn();
  const empty = { body: [] };
  const api = fakeApi({
    'GET /api/auth/me': { body: me },
    [`GET /api/catalog/releases/${release.id}`]: { body: release },
    [`GET /api/reviews/release/${release.id}`]: empty,
    [`GET /api/critic/release/${release.id}`]: empty,
    [`GET /api/videos/release/${release.id}`]: empty,
    [`GET /api/catalog/release-groups/${GROUP_ID}`]: { status: groupStatus, body: groupBody },
  });
  configureApiClient({ fetch: api.fetch });
  return api;
}

afterEach(() => {
  configureApiClient({});
  jest.clearAllMocks();
});

describe('edition helpers', () => {
  it('names editions and lists the facts that tell them apart', () => {
    expect(editionName(null)).toBe('Edizione standard');
    expect(editionName('2011 Remaster')).toBe('2011 Remaster');
    expect(editionFacts({ year: 2017, format: '12" Vinyl', country: 'XW', label: 'XL' })).toEqual([
      '2017',
      'Vinile 12"',
      'Mondo',
      'XL',
    ]);
    expect(editionFacts({ year: null, format: 'Digital Media', country: 'XU' })).toEqual([
      'Digitale',
    ]);
  });

  it('drops edition qualifiers from the title only when the chip shows them', () => {
    expect(
      workTitle({
        title: 'Random Access Memories (10th Anniversary Edition)',
        editionLabel: '10th Anniversary Edition',
      })
    ).toBe('Random Access Memories');
    expect(workTitle({ title: 'Weezer (Blue Album)', editionLabel: null })).toBe(
      'Weezer (Blue Album)'
    );
  });

  it('folds editions of the same album, keeping the API ranking', () => {
    const group = { id: GROUP_ID, title: 'OK Computer', firstYear: 1997 };
    const a = { ...okComputer, id: 'a', group };
    const b = { ...okComputer, id: 'b', group: null };
    const c = { ...okComputer, id: 'c', group, editionLabel: 'OKNOTOK 1997 2017' };
    const folded = groupEditions([a, b, c]);
    expect(folded.map((e) => [e.release.id, e.editionCount])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});

it('release page: marks the edition, scopes its scores and lists the other editions', async () => {
  const api = setup(okComputerWithEditions);
  await renderRouter('./app', { initialUrl: `/release/${RELEASE_ID}` });
  expect(await screen.findByText('Voti di questa edizione', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getAllByLabelText('Edizione: Edizione standard').length).toBeGreaterThan(0);
  // Composer names the edition being reviewed.
  expect(screen.getByText('Stai recensendo')).toBeTruthy();
  expect(screen.getByText('Altre edizioni')).toBeTruthy();
  const reissue = screen.getByLabelText(
    'OK Computer OKNOTOK 1997 2017, OKNOTOK 1997 2017, 2017, Vinile 12", Mondo, XL Recordings'
  );
  expect(reissue).toBeTruthy();

  await fireEvent.press(screen.getByText('Tutte le 2 edizioni e il voto complessivo'));
  expect(await screen.findByText('Voto complessivo · tutte le edizioni')).toBeTruthy();
  expect(api.calls.some((c) => c.path === `/api/catalog/release-groups/${GROUP_ID}`)).toBe(true);
});

it('release page without other editions shows no edition UI', async () => {
  setup(okComputer);
  await renderRouter('./app', { initialUrl: `/release/${RELEASE_ID}` });
  await screen.findByText('Lato A', {}, { timeout: 5000 });
  expect(screen.queryByText('Altre edizioni')).toBeNull();
  expect(screen.queryByText('Voti di questa edizione')).toBeNull();
  expect(screen.queryByText('Stai recensendo')).toBeNull();
});

it('album page: pooled scores, editions with their own scores, links to each edition', async () => {
  setup({ ...okComputerWithEditions, id: OKNOTOK_ID });
  const router = await renderRouter('./app', { initialUrl: `/album/${GROUP_ID}` });
  expect(
    await screen.findByText('Voto complessivo · tutte le edizioni', {}, { timeout: 5000 })
  ).toBeTruthy();
  expect(screen.getByText('2 edizioni')).toBeTruthy();
  expect(
    screen.getByLabelText('Pubblico: 92% positive su 4 recensioni, media 4.6 stelle')
  ).toBeTruthy();
  expect(
    screen.getByLabelText('Critica: nessuna recensione. Pubblico: media 4,8 su 5, 3 recensioni.')
  ).toBeTruthy();

  await fireEvent.press(
    screen.getByLabelText(
      'OK Computer OKNOTOK 1997 2017, OKNOTOK 1997 2017, 2017, Vinile 12", Mondo, XL Recordings'
    )
  );
  await waitFor(() => expect(router.getPathname()).toBe(`/release/${OKNOTOK_ID}`));
});

it('album page: says when more editions are being fetched', async () => {
  setup(okComputer, { ...okComputerGroup, editionsSyncing: true });
  await renderRouter('./app', { initialUrl: `/album/${GROUP_ID}` });
  expect(
    await screen.findByText(
      'Sto cercando altre edizioni su MusicBrainz: tira giù per aggiornare.',
      {},
      { timeout: 5000 }
    )
  ).toBeTruthy();
});

it('album page: unknown album shows an error with retry', async () => {
  setup(okComputer, { statusCode: 404, code: 'NOT_FOUND', message: 'Album non trovato' }, 404);
  await renderRouter('./app', { initialUrl: `/album/${GROUP_ID}` });
  expect(await screen.findByText('Album non disponibile', {}, { timeout: 5000 })).toBeTruthy();
});
