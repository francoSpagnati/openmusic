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
let socketToken: string | null = null;

/**
 * The app-wide socket, authenticated with the JWT in the handshake (`auth: { token }`): the API
 * takes the user id from the token only. A new token (login, password change) replaces the socket.
 */
function getSocket(token: string): OpenMusicSocket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socket = io(API_URL, {
    auth: { token },
    autoConnect: false,
    transports: ['websocket'],
    reconnectionDelayMax: 10_000,
  });
  socketToken = token;
  return socket;
}

/** Closes the socket (called automatically when the user signs out). */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

export interface SocketState {
  socket: OpenMusicSocket | null;
  connected: boolean;
  /** `UNAUTHORIZED` when the token was rejected, otherwise a transport error message. */
  error: string | null;
}

/** Connects the shared socket while signed in; disconnects on logout or token change. */
export function useSocket(): SocketState {
  const { status, token, refresh } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = status === 'authenticated' && token !== null;

  useEffect(() => {
    if (!active || token === null) {
      if (status === 'anonymous') disconnectSocket();
      setConnected(false);
      return;
    }
    const s = getSocket(token);
    const onConnect = () => {
      setConnected(true);
      setError(null);
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => {
      setError(err.message);
      // A rejected handshake means the token is expired/revoked: let the auth layer verify it
      // (a 401 from /api/auth/me signs the user out).
      if (err.message === 'UNAUTHORIZED') void refresh().catch(() => undefined);
    };
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
  }, [active, status, token, refresh]);

  return { socket: active && token !== null ? getSocket(token) : null, connected, error };
}

/** Subscribes to a typed server event for the lifetime of the component. */
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
 * Live "now playing" presence of followed users. Seeds from `GET /api/now-playing/friends` and
 * then applies socket updates (same contract as the web `useFriendsPresence`).
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

/**
 * Live presence of one user, for the profile "In ascolto ora" card (same contract as the web
 * `useUserPresence`): seeds from `GET /api/now-playing/users/:userId` (`null` when the viewer
 * neither is nor follows them), then applies `friend_presence_changed` for that user and, on the
 * own profile, `self_presence_changed`.
 */
export function useUserPresence(userId: string | null): FriendPresence | null {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [presence, setPresence] = useState<FriendPresence | null>(null);
  const isMe = userId !== null && user?.id === userId;
  // A socket update already applied is newer than whatever the REST call returns later.
  const liveRef = useRef(false);

  useEffect(() => {
    liveRef.current = false;
    setPresence(null);
  }, [userId]);

  useEffect(() => {
    if (!userId || !user) return;
    let cancelled = false;
    nowPlayingApi
      .user(userId)
      .then((p) => {
        if (!cancelled && !liveRef.current) setPresence(p);
      })
      .catch(() => {
        // Not allowed (404) or transient failure: the card simply stays hidden.
      });
    return () => {
      cancelled = true;
    };
    // Refetch after a reconnect: events sent while offline are lost.
  }, [userId, user, connected]);

  const apply = (p: FriendPresence) => {
    if (p.userId !== userId) return;
    liveRef.current = true;
    setPresence(p);
  };
  useSocketEvent(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, apply);
  useSocketEvent(WS_EVENTS.SERVER_SELF_PRESENCE_CHANGED, (p) => {
    if (isMe) apply(p);
  });

  return presence;
}
