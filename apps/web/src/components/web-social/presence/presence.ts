import type { FriendPresence, MusicProvider, NowPlayingTrack } from '@openmusic/shared';
import type { AvatarStatus } from '@/components/ui';
import type { PlayingTrack } from '@/context/AudioPlayerContext';

/** True when the friend is visibly playing something (Ghost Mode hides the track). */
export function isListening(friend: FriendPresence): boolean {
  return !friend.isGhostMode && friend.currentlyPlaying?.isPlaying === true;
}

/** Avatar status ring for a followed user. */
export function presenceStatus(friend: FriendPresence): AvatarStatus {
  if (friend.isGhostMode) return 'ghost';
  if (isListening(friend)) return 'live';
  return friend.isOnline ? 'online' : 'offline';
}

/** Listening first, then online, then Ghost Mode; alphabetical inside each group. */
export function sortFriends(friends: FriendPresence[]): FriendPresence[] {
  const rank = (f: FriendPresence) => (isListening(f) ? 0 : f.isGhostMode ? 2 : 1);
  return [...friends].sort(
    (a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username, 'it')
  );
}

/**
 * The friend's current track as something the 30s preview player can play. The id is stable per
 * track (catalog id, ISRC, or title+artist) so the play button reflects the shared player state.
 */
export function presenceToPlayingTrack(track: NowPlayingTrack): PlayingTrack {
  const key = track.trackId ?? track.isrc ?? `${track.artistName}::${track.title}`;
  return {
    id: `now-playing:${key}`,
    title: track.title,
    artist: track.artistName,
    coverUrl: track.coverUrl ?? null,
    previewUrl: track.previewUrl ?? null,
    isrc: track.isrc ?? null,
  };
}

export const PROVIDER_LABEL: Record<MusicProvider, string> = {
  SPOTIFY: 'Spotify',
  APPLE_MUSIC: 'Apple Music',
  LASTFM: 'Last.fm',
  OS_MEDIA_SESSION: 'il telefono',
};

/** Where the playhead is now, extrapolated from the last update while the track is playing. */
export function estimatedProgressMs(track: NowPlayingTrack, now: number): number {
  const elapsed = track.isPlaying ? Math.max(0, now - track.updatedAt) : 0;
  return Math.min(track.durationMs, track.progressMs + elapsed);
}
