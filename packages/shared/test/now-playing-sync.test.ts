import { describe, expect, it } from 'vitest';
import {
  NowPlayingSyncStatusSchema,
  NowPlayingTrackSchema,
  PROVIDER_SYNC_ERROR_MESSAGES,
  ProviderSyncErrorCodeSchema,
} from '../src';

describe('NowPlayingSyncStatusSchema (ADR-013)', () => {
  const linked = {
    provider: 'SPOTIFY',
    linked: true,
    status: 'ERROR',
    lastSyncedAt: '2026-10-22T10:00:00.000Z',
    lastErrorCode: 'TOKEN_REVOKED',
    lastError: PROVIDER_SYNC_ERROR_MESSAGES.TOKEN_REVOKED,
    nextPollInSeconds: null,
  };
  const unlinked = {
    provider: 'LASTFM',
    linked: false,
    status: null,
    lastSyncedAt: null,
    lastErrorCode: null,
    lastError: null,
    nextPollInSeconds: null,
  };

  it('accepts a linked and an unlinked provider', () => {
    const parsed = NowPlayingSyncStatusSchema.parse({
      autoSyncEnabled: true,
      providers: { SPOTIFY: linked, LASTFM: unlinked },
    });
    expect(parsed.providers.SPOTIFY.status).toBe('ERROR');
  });

  it('rejects negative countdowns and unknown statuses', () => {
    const bad = (patch: object) =>
      NowPlayingSyncStatusSchema.safeParse({
        autoSyncEnabled: true,
        providers: { SPOTIFY: { ...linked, ...patch }, LASTFM: unlinked },
      }).success;
    expect(bad({ nextPollInSeconds: -1 })).toBe(false);
    expect(bad({ status: 'BROKEN' })).toBe(false);
  });

  it('has an Italian message for every error code', () => {
    for (const code of ProviderSyncErrorCodeSchema.options) {
      expect(PROVIDER_SYNC_ERROR_MESSAGES[code].length).toBeGreaterThan(10);
    }
  });

  it('allows an unknown duration (0) for Last.fm presence', () => {
    const track = {
      title: 'Reckoner',
      artistName: 'Radiohead',
      durationMs: 0,
      progressMs: 0,
      provider: 'LASTFM',
      isPlaying: true,
      updatedAt: 1,
    };
    expect(NowPlayingTrackSchema.safeParse(track).success).toBe(true);
    expect(NowPlayingTrackSchema.safeParse({ ...track, durationMs: -1 }).success).toBe(false);
  });
});
