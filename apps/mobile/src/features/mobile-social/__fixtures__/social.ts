import type { ChatMessage, NotificationItem, Post } from '@openmusic/shared';

export const ME = {
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
} as const;

export const ELENA_ID = '22222222-2222-4222-8222-222222222222';

export const ELENA = {
  id: ELENA_ID,
  username: 'elena',
  displayName: 'Elena Rossi',
  avatarUrl: null,
  role: 'USER' as const,
  isFollowedByMe: true,
};

export const TRACK = {
  id: '44444444-4444-4444-8444-444444444444',
  isrc: 'GBAYE0601498',
  title: 'Weird Fishes/Arpeggi',
  artistName: 'Radiohead',
  durationMs: 318_000,
  releaseId: '55555555-5555-4555-8555-555555555555',
  coverUrl: 'https://example.test/in-rainbows.jpg',
};

export function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    senderId: ELENA_ID,
    receiverId: ME.id,
    content: 'Ascolta questa',
    track: TRACK,
    universalLinks: {
      openmusic: 'https://openmusic.test/track/x',
      deezer: 'https://www.deezer.com/track/1',
    },
    isListened: false,
    reaction: null,
    readAt: null,
    createdAt: '2026-10-21T08:00:00.000Z',
    ...overrides,
  };
}

export function post(overrides: Partial<Post> = {}): Post {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    author: ELENA,
    content: 'Weird Fishes resta ipnotica.',
    release: null,
    track: null,
    rating: null,
    vibeTags: [],
    likeCount: 3,
    isLikedByMe: false,
    isSavedByMe: false,
    createdAt: '2026-10-21T08:00:00.000Z',
    ...overrides,
  };
}

export function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    type: 'FOLLOW',
    actor: { id: ELENA_ID, username: 'elena', displayName: 'Elena Rossi', avatarUrl: null },
    post: null,
    review: null,
    track: null,
    readAt: null,
    createdAt: '2026-10-21T08:00:00.000Z',
    ...overrides,
  };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
