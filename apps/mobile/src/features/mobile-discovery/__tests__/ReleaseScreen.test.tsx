import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import type { CriticReviewItem, DualScoreDetails, MusicVideoItem } from '@openmusic/shared';
import { configureApiClient } from '../../../lib/api';
import { createFakeAudio } from '../testing/audioMock';
import {
  ME_ID,
  OTHER_ID,
  RELEASE_ID,
  fakeApi,
  me,
  okComputer,
  reviewBy,
} from '../testing/fixtures';

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

const dual: DualScoreDetails = {
  releaseId: RELEASE_ID,
  audienceAvg: 4.3,
  audienceFreshPct: 88,
  audienceCount: 1,
  criticAvg: 4.5,
  criticFreshPct: 100,
  criticCount: 1,
};
const critic: CriticReviewItem = {
  id: '88888888-8888-4888-8888-888888888888',
  criticId: '99999999-9999-4999-8999-999999999990',
  criticName: 'Marta Bianchi',
  criticAvatarUrl: null,
  outletName: 'Rumore',
  originalReviewUrl: 'https://rumore.example/ok-computer',
  rating: 95,
  quoteSnippet: 'Un disco che suona ancora come il futuro.',
  releaseId: RELEASE_ID,
  createdAt: '2026-10-02T10:00:00.000Z',
};
const video: MusicVideoItem = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Perché OK Computer conta ancora',
  creatorName: 'Sound Essays',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: null,
  durationSeconds: 754,
  releaseId: RELEASE_ID,
  category: 'ESSAY',
  createdAt: '2026-10-03T10:00:00.000Z',
};

function setup() {
  const SecureStore = jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store');
  SecureStore.__store.set('om_session_token', 'jwt-stored');
  const elena = reviewBy(OTHER_ID);
  const api = fakeApi({
    'GET /api/auth/me': { body: me },
    [`GET /api/catalog/releases/${RELEASE_ID}`]: { body: okComputer },
    [`GET /api/reviews/release/${RELEASE_ID}`]: { body: [elena] },
    [`GET /api/critic/dual-score/${RELEASE_ID}`]: { body: dual },
    [`GET /api/critic/release/${RELEASE_ID}`]: { body: [critic] },
    [`GET /api/videos/release/${RELEASE_ID}`]: { body: [video] },
    'GET /api/catalog/preview': {
      body: {
        previewUrl: 'https://cdnt-preview.dzcdn.net/api/1/1/airbag.mp3',
        source: 'DEEZER',
        durationSeconds: 30,
      },
    },
    'POST /api/reviews/reaction': (call) => ({
      body: { added: true, type: (call.body as { type: string }).type },
    }),
    'POST /api/reviews': (call) => {
      const body = call.body as { rating: number; content?: string; vibeTags: string[] };
      return {
        status: 201,
        body: reviewBy(ME_ID, {
          rating: body.rating,
          content: body.content ?? null,
          vibeTags: body.vibeTags,
          reactions: { AGREE: 0, WELL_WRITTEN: 0, DISCOVERED: 0, HEART: 0 },
        }),
      };
    },
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

it('renders the imported release: tinted header, sides A/B, dual score, critics and videos', async () => {
  setup();
  await renderRouter('./app', { initialUrl: `/release/${RELEASE_ID}` });
  expect(await screen.findByText('OK Computer', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByText('Album · 1997 · Parlophone')).toBeTruthy();
  expect(screen.getByText('Copertina: Deezer')).toBeTruthy();
  expect(screen.getByLabelText('Copertina di OK Computer, Radiohead')).toBeTruthy();
  expect(screen.getByText('Lato A')).toBeTruthy();
  expect(screen.getByText('Lato B')).toBeTruthy();
  expect(
    await screen.findByLabelText('Pubblico: 88% positive su 1 recensioni, media 4.3 stelle')
  ).toBeTruthy();
  expect(await screen.findByText('Un disco che suona ancora come il futuro.')).toBeTruthy();
  expect(await screen.findByText('Perché OK Computer conta ancora')).toBeTruthy();
});

it('plays a tracklist preview resolved through the API', async () => {
  const api = setup();
  await renderRouter('./app', { initialUrl: `/release/${RELEASE_ID}` });
  await screen.findByText('Lato A', {}, { timeout: 5000 });
  const buttons = screen.getAllByLabelText('Ascolta 30 secondi di Airbag di Radiohead');
  // Header button + tracklist row.
  expect(buttons.length).toBe(2);
  await fireEvent.press(buttons[1]!);
  await waitFor(() =>
    expect(mockAudio.player.replace).toHaveBeenCalledWith({
      uri: 'https://cdnt-preview.dzcdn.net/api/1/1/airbag.mp3',
    })
  );
  expect(api.calls.find((c) => c.path === '/api/catalog/preview')?.query.get('isrc')).toBe(
    'GBAYE9700001'
  );
});

it('publishes a review (rating required) and toggles a reaction optimistically', async () => {
  const api = setup();
  await renderRouter('./app', { initialUrl: `/release/${RELEASE_ID}` });
  await screen.findByText("Com'è OK Computer?", {}, { timeout: 5000 });

  await fireEvent.press(screen.getByLabelText('Pubblica'));
  expect(screen.getByText('Scegli un voto da mezza a cinque stelle.')).toBeTruthy();
  expect(api.calls.some((c) => c.method === 'POST' && c.path === '/api/reviews')).toBe(false);

  await fireEvent.press(screen.getByTestId('rating-star-4.5'));
  await fireEvent.changeText(screen.getByLabelText('Recensione'), '  Un classico.  ');
  await fireEvent.changeText(screen.getByLabelText(/^Vibe tag/), '#notturno, paranoia');
  await fireEvent.press(screen.getByLabelText('Pubblica'));
  await screen.findByText('Franco · tu');
  const post = api.calls.find((c) => c.method === 'POST' && c.path === '/api/reviews');
  expect(post?.body).toEqual({
    releaseId: RELEASE_ID,
    rating: 90,
    content: 'Un classico.',
    vibeTags: ['notturno', 'paranoia'],
  });

  const elenaReactions = screen.getByLabelText('Reazioni alla recensione di Elena Rossi');
  await fireEvent.press(within(elenaReactions).getByLabelText('Condivido, 3'));
  expect(within(elenaReactions).getByLabelText('Condivido, 4')).toBeTruthy();
  await waitFor(() =>
    expect(api.calls.find((c) => c.path === '/api/reviews/reaction')?.body).toEqual({
      reviewId: reviewBy(OTHER_ID).id,
      type: 'AGREE',
    })
  );
});
