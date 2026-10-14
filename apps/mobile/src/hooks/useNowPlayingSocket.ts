import { useEffect, useState, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  type FriendPresence,
  type NowPlayingTrack,
  WS_EVENTS,
} from '@openmusic/shared';

interface UseNowPlayingSocketOptions {
  serverUrl: string;
  userId: string | null;
  initialGhostMode?: boolean;
}

export interface UseNowPlayingSocketResult {
  friends: FriendPresence[];
  isGhostMode: boolean;
  isConnected: boolean;
  toggleGhostMode: (nextVal: boolean) => void;
  updateNowPlaying: (track: NowPlayingTrack) => void;
}

export function useNowPlayingSocket({
  serverUrl,
  userId,
  initialGhostMode = false,
}: UseNowPlayingSocketOptions): UseNowPlayingSocketResult {
  const [friends, setFriends] = useState<FriendPresence[]>([]);
  const [isGhostMode, setIsGhostMode] = useState<boolean>(initialGhostMode);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) {
      setFriends([]);
      setIsConnected(false);
      return;
    }

    const socket = io(serverUrl, {
      auth: { userId },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Ricezione stato iniziale degli amici online (Euristica #1: Visibilità stato)
    socket.on(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, (initialFriends: FriendPresence[]) => {
      setFriends(initialFriends);
    });

    // Aggiornamento reattivo delta per singolo amico
    socket.on(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, (changedFriend: FriendPresence) => {
      setFriends((prevFriends) => {
        const index = prevFriends.findIndex((f) => f.userId === changedFriend.userId);
        if (index >= 0) {
          const updated = [...prevFriends];
          updated[index] = changedFriend;
          return updated;
        }
        return [...prevFriends, changedFriend];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, userId]);

  // Toggle Ghost Mode ottimistico a 1-tap (Euristica #3 di Nielsen)
  const toggleGhostMode = useCallback(
    (nextVal: boolean) => {
      setIsGhostMode(nextVal);
      if (socketRef.current?.connected) {
        socketRef.current.emit(WS_EVENTS.CLIENT_TOGGLE_GHOST, { isGhostMode: nextVal });
      }
    },
    []
  );

  // Aggiornamento brano in ascolto
  const updateNowPlaying = useCallback((track: NowPlayingTrack) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(WS_EVENTS.CLIENT_UPDATE_TRACK, track);
    }
  }, []);

  return {
    friends,
    isGhostMode,
    isConnected,
    toggleGhostMode,
    updateNowPlaying,
  };
}
