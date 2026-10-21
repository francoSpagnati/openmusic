import type { CatalogTrack } from '@openmusic/shared';
import type { PlayingTrack } from '@/context/AudioPlayerContext';

/** A catalog track in the shape the 30s preview player expects. */
export function catalogToPlayingTrack(track: CatalogTrack): PlayingTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artistName,
    coverUrl: track.coverUrl ?? null,
    previewUrl: track.previewUrl ?? null,
    isrc: track.isrc ?? null,
    releaseId: track.releaseId ?? null,
  };
}
