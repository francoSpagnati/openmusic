import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistDetails } from '@openmusic/shared';
import { api } from '../../../lib/api';

/** Private playlist where tracks saved from Reels end up (side A). */
export const REELS_PLAYLIST_TITLE = 'Scoperte dai Reels';

export interface ReelsLibrary {
  /** Track ids already in the playlist (from the server, plus optimistic saves). */
  savedTrackIds: ReadonlySet<string>;
  /** Adds the track; rejects with `ApiError` after rolling back. */
  save(trackId: string): Promise<void>;
}

/**
 * "Save" on a reel = add the track to the viewer's private "Scoperte dai Reels" playlist, created
 * on first save. The API has no endpoint to remove a playlist track yet, so a save cannot be undone
 * from the app (see the screen's README note).
 */
export function useReelsLibrary(userId: string | null): ReelsLibrary {
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const playlist = useRef<Promise<string> | null>(null);

  const findPlaylist = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    const mine = await api.playlists.byUser(userId);
    return mine.find((p) => p.title === REELS_PLAYLIST_TITLE)?.id ?? null;
  }, [userId]);

  // Seed the saved state from the existing playlist (best effort: the feed works without it).
  useEffect(() => {
    let cancelled = false;
    playlist.current = null;
    setSaved(new Set());
    findPlaylist()
      .then(async (id) => {
        if (!id || cancelled) return;
        playlist.current = Promise.resolve(id);
        const details: PlaylistDetails = await api.playlists.get(id);
        if (cancelled) return;
        const ids = [...details.sideATracks, ...details.sideBTracks].map((t) => t.track.id);
        setSaved((prev) => new Set([...prev, ...ids]));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [findPlaylist]);

  const ensurePlaylist = useCallback((): Promise<string> => {
    if (!playlist.current) {
      playlist.current = findPlaylist()
        .then(async (existing) => {
          if (existing) return existing;
          const created = await api.playlists.create({
            title: REELS_PLAYLIST_TITLE,
            description: 'Brani salvati dai Reels di OpenMusic.',
            isPublic: false,
          });
          return created.id;
        })
        .catch((err: unknown) => {
          playlist.current = null;
          throw err;
        });
    }
    return playlist.current;
  }, [findPlaylist]);

  const save = useCallback(
    async (trackId: string) => {
      setSaved((prev) => new Set(prev).add(trackId));
      try {
        const playlistId = await ensurePlaylist();
        await api.playlists.addTrack({ playlistId, trackId, side: 'A' });
      } catch (err) {
        setSaved((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
        throw err;
      }
    },
    [ensurePlaylist]
  );

  return { savedTrackIds: saved, save };
}
