'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WS_EVENTS,
  type ClientToServerEvents,
  type FriendPresence,
  type NowPlayingTrack,
  type ServerToClientEvents,
  type WsAck,
} from '@openmusic/shared';
import { API_URL } from './api/config';
import { nowPlayingApi } from './api/social';
import { useAuth } from './auth/AuthProvider';

export type OpenMusicSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 5000;

let socket: OpenMusicSocket | null = null;

/**
 * The app-wide socket. It authenticates with the httpOnly session cookie (`withCredentials`), so
 * it must only be connected while signed in; `useSocket` handles that.
 */
function getSocket(): OpenMusicSocket {
  socket ??= io(API_URL, {
    withCredentials: true,
    autoConnect: false,
    transports: ['websocket'],
  });
  return socket;
}

/** Closes the socket (called automatically on logout). */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export interface SocketState {
  socket: OpenMusicSocket | null;
  connected: boolean;
  /** `UNAUTHORIZED` when the session expired, otherwise a transport error message. */
  error: string | null;
}

/** Connects the shared socket while the user is authenticated and disconnects on logout. */
export function useSocket(): SocketState {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'anonymous') disconnectSocket();
      setConnected(false);
      return;
    }
    const s = getSocket();
    const onConnect = () => {
      setConnected(true);
      setError(null);
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => setError(err.message);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);
    if (s.connected) onConnect();
    else s.connect();
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
    };
  }, [status]);

  return { socket: status === 'authenticated' ? getSocket() : null, connected, error };
}

/**
 * Subscribes to a server event for the lifetime of the component, e.g.
 * `useSocketEvent('notification:new', (n) => toast.notify({ title: ... }))`.
 */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E]
): void {
  const { socket: s } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!s) return;
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (handlerRef.current as (...a: Parameters<ServerToClientEvents[E]>) => void)(
        ...args
      )) as ServerToClientEvents[E];
    // socket.io's typed on/off need the listener as the exact event signature.
    s.on(event, listener as never);
    return () => {
      s.off(event, listener as never);
    };
  }, [s, event]);
}

function emitWithAck(
  s: OpenMusicSocket,
  event: 'now_playing:update_track' | 'now_playing:toggle_ghost',
  payload: unknown
): Promise<WsAck> {
  // With `.timeout()` socket.io prepends an error argument to the ack callback.
  const timed = s.timeout(ACK_TIMEOUT_MS) as unknown as {
    emit: (e: string, p: unknown, cb: (err: Error | null, ack?: WsAck) => void) => void;
  };
  return new Promise((resolve) => {
    timed.emit(event, payload, (err, ack) => {
      if (err || !ack) {
        resolve({ ok: false, code: 'INTERNAL_ERROR', message: 'Nessuna risposta dal server' });
      } else {
        resolve(ack);
      }
    });
  });
}

export interface FriendsPresenceState {
  /** Followed users currently online (offline entries are dropped). */
  friends: FriendPresence[];
  connected: boolean;
  error: string | null;
  /** Publishes the track the user is playing to their followers. */
  updateTrack: (track: NowPlayingTrack) => Promise<WsAck>;
  /** One-tap Ghost Mode (hides the current track from followers). */
  setGhostMode: (isGhostMode: boolean) => Promise<WsAck>;
}

const NOT_CONNECTED: WsAck = { ok: false, code: 'UNAUTHORIZED', message: 'Non connesso' };

/**
 * Live "now playing" presence of the people the user follows (stories bar, live ticker).
 * Seeds from `GET /api/now-playing/friends` and then applies socket updates.
 */
export function useFriendsPresence(): FriendsPresenceState {
  const { socket: s, connected, error } = useSocket();
  const [byId, setById] = useState<Map<string, FriendPresence>>(new Map());

  const replaceAll = useCallback((list: FriendPresence[]) => {
    setById(new Map(list.filter((f) => f.isOnline).map((f) => [f.userId, f])));
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    nowPlayingApi
      .friends()
      .then((list) => {
        if (!cancelled) replaceAll(list);
      })
      .catch(() => {
        // The socket's initial state covers this; ignore transient REST failures.
      });
    return () => {
      cancelled = true;
    };
  }, [connected, replaceAll]);

  useSocketEvent(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, replaceAll);
  useSocketEvent(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, (friend) => {
    setById((prev) => {
      const next = new Map(prev);
      if (friend.isOnline) next.set(friend.userId, friend);
      else next.delete(friend.userId);
      return next;
    });
  });

  const updateTrack = useCallback(
    (track: NowPlayingTrack) =>
      s ? emitWithAck(s, WS_EVENTS.CLIENT_UPDATE_TRACK, track) : Promise.resolve(NOT_CONNECTED),
    [s]
  );
  const setGhostMode = useCallback(
    (isGhostMode: boolean) =>
      s
        ? emitWithAck(s, WS_EVENTS.CLIENT_TOGGLE_GHOST, { isGhostMode })
        : Promise.resolve(NOT_CONNECTED),
    [s]
  );

  return { friends: Array.from(byId.values()), connected, error, updateTrack, setGhostMode };
}
