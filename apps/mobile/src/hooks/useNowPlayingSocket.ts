import { useCallback, useEffect, useState } from 'react';
import type { FriendPresence, NowPlayingTrack, WsAck } from '@openmusic/shared';
import { useAuth } from '../lib/auth/AuthProvider';
import { useFriendsPresence } from '../lib/socket';

export interface UseNowPlayingSocketResult {
  friends: FriendPresence[];
  isGhostMode: boolean;
  isConnected: boolean;
  error: string | null;
  /** Optimistic one-tap toggle; rolls back if the server rejects it. */
  toggleGhostMode: (nextVal: boolean) => Promise<WsAck>;
  updateNowPlaying: (track: NowPlayingTrack) => Promise<WsAck>;
}

/**
 * "Now playing" presence for the signed-in user. Authentication is the JWT handshake done by
 * `useSocket` (the old `auth: { userId }` handshake is gone: the API ignores client-sent ids).
 * Ghost Mode starts from the user's saved setting.
 */
export function useNowPlayingSocket(): UseNowPlayingSocketResult {
  const { user } = useAuth();
  const { friends, connected, error, updateTrack, setGhostMode } = useFriendsPresence();
  const [isGhostMode, setIsGhostMode] = useState<boolean>(user?.isGhostMode ?? false);

  useEffect(() => {
    setIsGhostMode(user?.isGhostMode ?? false);
  }, [user?.isGhostMode]);

  const toggleGhostMode = useCallback(
    async (nextVal: boolean) => {
      setIsGhostMode(nextVal);
      const ack = await setGhostMode(nextVal);
      if (!ack.ok) setIsGhostMode(!nextVal);
      return ack;
    },
    [setGhostMode]
  );

  return {
    friends,
    isGhostMode,
    isConnected: connected,
    error,
    toggleGhostMode,
    updateNowPlaying: updateTrack,
  };
}
