import type {
  AudioPreviewResult,
  CatalogTrack,
  DiscoveryReelItem,
  ReviewItem,
} from '@openmusic/shared';
import {
  formatRunningTime,
  mergeById,
  parseVibeTags,
  releaseMeta,
  splitSides,
  tintAlpha,
} from '../catalog';
import { API_URL } from '../../../lib/api';
import { createPreviewResolver, lookaheadIndices, previewSourceLabel } from '../preview';
import { applyReaction, myReactions } from '../reactions';
import { initialReelsState, reelsReducer } from '../reels/reelsState';

const track = (n: number, over: Partial<CatalogTrack> = {}): CatalogTrack => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  title: `Track ${n}`,
  artistName: 'Radiohead',
  durationMs: 240_000,
  trackNumber: n,
  ...over,
});

describe('createPreviewResolver', () => {
  const result = (previewUrl: string | null): AudioPreviewResult => ({
    previewUrl,
    source: previewUrl ? 'DEEZER' : 'NONE',
    durationSeconds: 30,
  });

  it('uses the stored previewUrl without asking the API', async () => {
    const lookup = jest.fn();
    const resolver = createPreviewResolver(lookup);
    await expect(
      resolver.resolve(track(1, { previewUrl: 'https://cdn.test/1.mp3' }))
    ).resolves.toEqual({
      url: 'https://cdn.test/1.mp3',
      source: 'CATALOG',
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves a root-relative previewUrl against the API base', async () => {
    const resolver = createPreviewResolver(jest.fn());
    const t = track(3, { previewUrl: '/api/catalog/tracks/abc/preview' });
    const expected = `${API_URL}/api/catalog/tracks/abc/preview`;
    await expect(resolver.resolve(t)).resolves.toEqual({ url: expected, source: 'CATALOG' });
    expect(resolver.peek(t)?.url).toBe(expected);
  });

  it('shares in-flight lookups, caches answers (also "no preview") and sends the ISRC', async () => {
    const lookup = jest.fn(async () => result('https://cdnt-preview.dzcdn.net/x.mp3'));
    const resolver = createPreviewResolver(lookup);
    const t = track(2, { isrc: 'gbaye9700001' });
    const [a, b] = await Promise.all([resolver.resolve(t), resolver.resolve(t)]);
    expect(a).toEqual({ url: 'https://cdnt-preview.dzcdn.net/x.mp3', source: 'DEEZER' });
    expect(b).toBe(a);
    await resolver.resolve(t);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith({
      title: 'Track 2',
      artist: 'Radiohead',
      isrc: 'gbaye9700001',
    });
    expect(resolver.peek(t)).toEqual(a);

    const none = createPreviewResolver(jest.fn(async () => result(null)));
    await expect(none.resolve(track(3))).resolves.toEqual({ url: null, source: 'NONE' });
    expect(none.peek(track(3))).toEqual({ url: null, source: 'NONE' });
  });

  it('forgets failed lookups so the next attempt retries', async () => {
    const lookup = jest
      .fn<Promise<AudioPreviewResult>, [unknown]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result('https://audio-ssl.itunes.apple.com/p.m4a'));
    const resolver = createPreviewResolver(lookup);
    await expect(resolver.resolve(track(4))).rejects.toThrow('offline');
    expect(resolver.peek(track(4))).toBeUndefined();
    await expect(resolver.resolve(track(4))).resolves.toMatchObject({
      url: 'https://audio-ssl.itunes.apple.com/p.m4a',
    });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('labels preview sources', () => {
    expect(previewSourceLabel('ITUNES')).toBe('iTunes');
    expect(previewSourceLabel('NONE')).toBeNull();
  });
});

describe('lookaheadIndices', () => {
  it('returns N+1 and N+2 clipped to the list', () => {
    expect(lookaheadIndices(0, 10)).toEqual([1, 2]);
    expect(lookaheadIndices(8, 10)).toEqual([9]);
    expect(lookaheadIndices(9, 10)).toEqual([]);
    expect(lookaheadIndices(0, 10, 3)).toEqual([1, 2, 3]);
  });
});

describe('catalog helpers', () => {
  it('merges pages without duplicates, keeping the first occurrence', () => {
    const a = [
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
    ];
    expect(
      mergeById(a, [
        { id: '2', v: 'B' },
        { id: '3', v: 'c' },
      ])
    ).toEqual([
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
      { id: '3', v: 'c' },
    ]);
  });

  it('builds release metadata', () => {
    expect(
      releaseMeta({ releaseType: 'ALBUM', releaseDate: '1997-05-21', label: 'Parlophone' })
    ).toBe('Album · 1997 · Parlophone');
    expect(releaseMeta({ releaseType: 'SINGLE', releaseDate: null, label: null })).toBe('Singolo');
  });

  it('cuts a single-disc LP at the track boundary closest to half the running time', () => {
    const tracks = [
      track(1, { durationMs: 300_000 }),
      track(2, { durationMs: 300_000 }),
      track(3, { durationMs: 100_000 }),
      track(4, { durationMs: 500_000 }),
    ];
    const sides = splitSides(tracks);
    expect(sides.map((s) => s.tracks.map((t) => t.trackNumber))).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(sides.map((s) => s.durationMs)).toEqual([600_000, 600_000]);
  });

  it('keeps disc boundaries and track order on multi-disc releases', () => {
    const tracks = [
      track(2, { discNumber: 2, trackNumber: 1 }),
      track(1, { discNumber: 1, trackNumber: 2 }),
      track(3, { discNumber: 1, trackNumber: 1 }),
    ];
    const sides = splitSides(tracks);
    expect(sides[0]?.tracks.map((t) => t.id)).toEqual([track(3).id, track(1).id]);
    expect(sides[1]?.tracks.map((t) => t.id)).toEqual([track(2).id]);
  });

  it('gives singles only side A', () => {
    expect(splitSides([track(1)]).map((s) => s.name)).toEqual(['A']);
    expect(splitSides([])).toEqual([]);
  });

  it('formats running time', () => {
    expect(formatRunningTime(2_712_000)).toBe('45 min');
    expect(formatRunningTime(3_960_000)).toBe('1 h 6 min');
  });

  it('parses up to five vibe tags, dropping # and duplicates', () => {
    expect(parseVibeTags('#Notturno, malinconico  pioggia notturno')).toEqual([
      'Notturno',
      'malinconico',
      'pioggia',
    ]);
    expect(parseVibeTags('a b c d e f g')).toHaveLength(5);
    expect(parseVibeTags('  ,  ')).toEqual([]);
  });

  it('tones down the tint of light dominant colours', () => {
    expect(tintAlpha('#101010', 'dark')).toBeGreaterThan(tintAlpha('#F0F0F0', 'dark'));
  });
});

const review = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'ada',
    displayName: null,
    avatarUrl: null,
    role: 'USER',
  },
  rating: 80,
  content: 'Bello',
  vibeTags: [],
  isCritic: false,
  isVerifiedListen: false,
  reactions: { AGREE: 2, WELL_WRITTEN: 0, DISCOVERED: 0, HEART: 1 },
  userReactions: ['HEART'],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('applyReaction', () => {
  it('adds and removes a reaction, updating counts and the viewer set', () => {
    const added = applyReaction(review(), 'AGREE', true);
    expect(added.reactions.AGREE).toBe(3);
    expect(myReactions(added)).toEqual(['AGREE', 'HEART']);
    const removed = applyReaction(added, 'HEART', false);
    expect(removed.reactions.HEART).toBe(0);
    expect(myReactions(removed)).toEqual(['AGREE']);
    expect(removed.userReaction).toBe('AGREE');
  });

  it('never goes below zero and reads the legacy single reaction', () => {
    const legacy = review({ userReactions: undefined, userReaction: 'DISCOVERED' });
    expect(myReactions(legacy)).toEqual(['DISCOVERED']);
    expect(applyReaction(legacy, 'DISCOVERED', false).reactions.DISCOVERED).toBe(0);
  });
});

describe('reelsReducer', () => {
  const reel = (n: number): DiscoveryReelItem => ({
    id: `reel-${n}`,
    track: track(n),
    release: {
      id: `r${n}`,
      title: 'OK Computer',
      artistName: 'Radiohead',
      releaseType: 'ALBUM',
      dominantColor: '#26262B',
      genres: [],
      audienceCount: 0,
      criticCount: 0,
    },
    topReviewSnippet: null,
    isSaved: false,
  });

  it('hides a reel and puts it back at the same position on undo', () => {
    let state = reelsReducer(initialReelsState, {
      type: 'load',
      items: [reel(1), reel(2), reel(3)],
    });
    state = reelsReducer(state, { type: 'hide', id: 'reel-2' });
    expect(state.items.map((r) => r.id)).toEqual(['reel-1', 'reel-3']);
    state = reelsReducer(state, { type: 'hide', id: 'reel-3' });
    state = reelsReducer(state, { type: 'undoHide' });
    expect(state.items.map((r) => r.id)).toEqual(['reel-1', 'reel-3']);
    state = reelsReducer(state, { type: 'undoHide' });
    expect(state.items.map((r) => r.id)).toEqual(['reel-1', 'reel-2', 'reel-3']);
    expect(reelsReducer(state, { type: 'undoHide' })).toBe(state);
    expect(reelsReducer(state, { type: 'hide', id: 'nope' })).toBe(state);
  });
});
