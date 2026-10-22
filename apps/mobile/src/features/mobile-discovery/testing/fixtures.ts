/**
 * API fixtures shaped like the OpenMusic contracts, with catalog data as the API imports it from
 * Deezer (cover/preview CDN URLs, ISRCs, dominant colours). Used with a fake `fetch`.
 */
import type {
  CatalogRelease,
  CatalogTrack,
  DiscoveryFeedResponse,
  EditionSummary,
  MeResponse,
  ReleaseGroupDetail,
  ReviewItem,
} from '@openmusic/shared';
import type { FetchLike } from '../../../lib/api';

export const ME_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_ID = '22222222-2222-4222-8222-222222222222';
export const RELEASE_ID = '3f0f6d8e-5b8a-4c1e-9a77-0d6c1b9b2a10';
export const GROUP_ID = '5c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5';
export const OKNOTOK_ID = '6d2e3f40-5b6c-4d7e-9f80-91a2b3c4d5e6';
export const PLAYLIST_ID = '7a1e2c3d-4b5f-4a6b-8c7d-9e0f1a2b3c4d';

export const me: MeResponse = {
  user: {
    id: ME_ID,
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

const okCover =
  'https://cdn-images.dzcdn.net/images/cover/0a5ef4e5b4d28e1e4c1c8b5c0e6e7f0a/1000x1000-000000-80-0-0.jpg';

export function okTrack(n: number, over: Partial<CatalogTrack> = {}): CatalogTrack {
  const titles = [
    'Airbag',
    'Paranoid Android',
    'Subterranean Homesick Alien',
    'Exit Music (For a Film)',
    'Let Down',
    'Karma Police',
  ];
  const durations = [287_000, 387_000, 267_000, 264_000, 299_000, 264_000];
  return {
    id: `a0000000-0000-4000-8000-00000000000${n}`,
    isrc: `GBAYE970000${n}`,
    title: titles[(n - 1) % titles.length] ?? `Track ${n}`,
    artistName: 'Radiohead',
    durationMs: durations[(n - 1) % durations.length] ?? 240_000,
    previewUrl: null,
    releaseId: RELEASE_ID,
    coverUrl: okCover,
    trackNumber: n,
    discNumber: 1,
    externalIds: { deezer: `13849${n}` },
    ...over,
  };
}

export const okComputer: CatalogRelease = {
  id: RELEASE_ID,
  title: 'OK Computer',
  artistName: 'Radiohead',
  releaseType: 'ALBUM',
  coverUrl: okCover,
  dominantColor: '#7A8C99',
  releaseDate: '1997-05-21',
  genres: ['Alternative', 'Art Rock'],
  label: 'Parlophone',
  upc: '0724385522925',
  trackCount: 6,
  coverSource: 'DEEZER',
  externalIds: {
    deezer: '6575789',
    musicbrainzReleaseGroup: 'b1392450-e666-3926-a536-22c65f834433',
  },
  audienceAvg: 4.3,
  audienceFreshPct: 88,
  audienceCount: 2,
  criticAvg: 4.5,
  criticFreshPct: 100,
  criticCount: 1,
  tracks: [1, 2, 3, 4, 5, 6].map((n) => okTrack(n)),
};

/** ADR-012: the 2017 reissue of OK Computer, as listed among the album's editions. */
export const oknotok: EditionSummary = {
  id: OKNOTOK_ID,
  title: 'OK Computer OKNOTOK 1997 2017',
  editionLabel: 'OKNOTOK 1997 2017',
  releaseType: 'ALBUM',
  releaseDate: '2017-06-23',
  year: 2017,
  country: 'XW',
  format: '12" Vinyl',
  label: 'XL Recordings',
  trackCount: 23,
  coverUrl: null,
  dominantColor: '#3E4A52',
  audienceAvg: 4.8,
  audienceCount: 3,
  criticAvg: null,
  criticCount: 0,
};

/** OK Computer as the plain edition of a group with one other edition (OKNOTOK). */
export const okComputerWithEditions: CatalogRelease = {
  ...okComputer,
  editionLabel: null,
  group: { id: GROUP_ID, title: 'OK Computer', firstYear: 1997 },
  otherEditions: [oknotok],
};

export const okComputerGroup: ReleaseGroupDetail = {
  id: GROUP_ID,
  title: 'OK Computer',
  artistName: 'Radiohead',
  primaryType: 'ALBUM',
  firstYear: 1997,
  coverUrl: okCover,
  dominantColor: '#7A8C99',
  genres: ['Alternative', 'Art Rock'],
  externalIds: { musicbrainz: 'b1392450-e666-3926-a536-22c65f834433' },
  scores: {
    audienceAvg: 4.6,
    audienceFreshPct: 92,
    audienceCount: 4,
    criticAvg: 4.5,
    criticFreshPct: 100,
    criticCount: 1,
  },
  editions: [
    {
      id: RELEASE_ID,
      title: 'OK Computer',
      editionLabel: null,
      releaseType: 'ALBUM',
      releaseDate: '1997-05-21',
      year: 1997,
      country: 'GB',
      format: 'CD',
      label: 'Parlophone',
      trackCount: 12,
      coverUrl: okCover,
      dominantColor: '#7A8C99',
      audienceAvg: 4.3,
      audienceCount: 2,
      criticAvg: 4.5,
      criticCount: 1,
    },
    oknotok,
  ],
  editionsSyncing: false,
};

export function reelsFeed(): DiscoveryFeedResponse {
  const preview = (id: string) => `https://cdnt-preview.dzcdn.net/api/1/1/${id}.mp3?hdnea=exp=1`;
  return {
    items: [1, 2, 3, 4].map((n) => ({
      id: `reel-${okTrack(n).id}`,
      // Track 2 has no stored clip: the client resolves it via /api/catalog/preview.
      track: okTrack(n, { previewUrl: n === 2 ? null : preview(String(n)) }),
      release: { ...okComputer, tracks: undefined },
      topReviewSnippet:
        n === 1
          ? {
              id: '55555555-5555-4555-8555-555555555555',
              authorName: 'elena',
              authorAvatarUrl: null,
              rating: 90,
              snippet: 'Il disco che ha spiegato il 2000 con tre anni di anticipo.',
              isVerifiedListen: true,
            }
          : null,
      isSaved: false,
    })),
    nextCursor: null,
  };
}

export function reviewBy(userId: string, over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id:
      userId === ME_ID
        ? '66666666-6666-4666-8666-666666666666'
        : '77777777-7777-4777-8777-777777777777',
    userId,
    user: {
      id: userId,
      username: userId === ME_ID ? 'franco' : 'elena',
      displayName: userId === ME_ID ? 'Franco' : 'Elena Rossi',
      avatarUrl: null,
      role: 'USER',
    },
    releaseId: RELEASE_ID,
    rating: 90,
    content: 'Paranoid Android da sola vale il disco.',
    vibeTags: ['notturno'],
    isCritic: false,
    isVerifiedListen: true,
    reactions: { AGREE: 3, WELL_WRITTEN: 1, DISCOVERED: 0, HEART: 2 },
    userReactions: [],
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
    ...over,
  };
}

export interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export type Route = (call: Call) => { status?: number; body?: unknown } | undefined;

/** Fake `fetch` for `configureApiClient`: routes by "METHOD /path", records every call. */
export function fakeApi(routes: Record<string, Route | { status?: number; body?: unknown }>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    const res = typeof route === 'function' ? route(call) : route;
    if (!res) {
      return new Response(
        JSON.stringify({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `${call.method} ${call.path}`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetch, calls };
}
