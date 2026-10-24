'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WS_EVENTS,
  type ClientToServerEvents,
  type FriendPresence,
  type NowPlayingTrack,
  type ServerToClientEvents,
  type SessionRevoked,
  type WsAck,
} from '@openmusic/shared';
import { authApi } from './api/auth';
import { isApiError } from './api/errors';
import { nowPlayingApi } from './api/social';
import { useAuth } from './auth/AuthProvider';

export type OpenMusicSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 5000;

/*
 * ADR-014: HTTP goes through the web app's same-origin `/api` proxy, but Socket.io connects
 * straight to the API (proxies do not carry websocket upgrades reliably). The session cookie
 * belongs to the web origin, so every handshake (first connect and each reconnect) presents a
 * fresh 60-second token from `GET /api/auth/socket-token`, which also says where the API is.
 */
let socket: OpenMusicSocket | null = null;
let pending: Promise<OpenMusicSocket> | null = null;
/** Bumped by `disconnectSocket` so a socket still being created is dropped. */
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: OpenMusicSocket | null): void {
  socket = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The app-wide socket, created (not connected) once a socket token was obtained. */
function ensureSocket(): Promise<OpenMusicSocket> {
  if (socket) return Promise.resolve(socket);
  if (pending) return pending;
  const myGeneration = generation;
  pending = authApi
    .socketToken()
    .then(({ token, url }) => {
      if (myGeneration !== generation) throw new Error('SIGNED_OUT');
      let firstToken: string | null = token;
      const created: OpenMusicSocket = io(url, {
        autoConnect: false,
        transports: ['websocket'],
        auth: (cb) => {
          if (firstToken) {
            const t = firstToken;
            firstToken = null;
            cb({ token: t });
            return;
          }
          authApi.socketToken().then(
            (r) => cb({ token: r.token }),
            // No session any more: the handshake fails with UNAUTHORIZED.
            () => cb({})
          );
        },
      });
      publish(created);
      return created;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Closes the socket (called automatically on logout). */
export function disconnectSocket(): void {
  generation += 1;
  const current = socket;
  if (current) {
    current.disconnect();
    publish(null);
  }
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
  const s = useSyncExternalStore(
    subscribe,
    () => socket,
    () => null
  );
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'anonymous') disconnectSocket();
      return;
    }
    ensureSocket().catch((err: unknown) => {
      if (err instanceof Error && err.message === 'SIGNED_OUT') return;
      setError(isApiError(err) && err.status === 401 ? 'UNAUTHORIZED' : 'Realtime non disponibile');
    });
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !s) {
      setConnected(false);
      return;
    }
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
  }, [status, s]);

  return { socket: status === 'authenticated' ? s : null, connected, error };
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

/**
 * Reacts to `session:revoked`, sent right before the server closes the socket. socket.io does
 * not reconnect after a server-side disconnect, so once the old socket is closed:
 * - `PASSWORD_CHANGED`: reconnect. If the password was changed here this browser already has a
 *   fresh cookie; if it was changed elsewhere the handshake fails with `UNAUTHORIZED`;
 * - other reasons (logout, expiry, invalid session): reconnect only if `/api/auth/me` still
 *   accepts the cookie (e.g. another tab signed in again).
 * When the cookie is no longer valid the session is refreshed, which turns the app anonymous
 * (and disconnects the socket), and `onSignedOut` lets the UI explain why.
 * Mount once, in the layout.
 */
export function useSessionRevocation(
  onSignedOut: (reason: SessionRevoked['reason']) => void
): void {
  const { socket: s } = useSocket();
  const { refresh } = useAuth();
  const onSignedOutRef = useRef(onSignedOut);
  onSignedOutRef.current = onSignedOut;

  useSocketEvent(WS_EVENTS.SERVER_SESSION_REVOKED, ({ reason }) => {
    if (!s) return;
    const signOut = () => {
      refresh().catch(() => undefined);
      // This tab's own logout already says goodbye.
      if (reason !== 'LOGOUT') onSignedOutRef.current(reason);
    };
    // true = cookie still valid, false = signed out (401), null = network trouble (leave it).
    const sessionValid = () =>
      authApi
        .me()
        .then(() => true)
        .catch((err: unknown) => (isApiError(err) && err.status === 401 ? false : null));
    const reconnectIfValid = () =>
      void sessionValid().then((valid) => {
        if (valid === true) s.connect();
        else if (valid === false) signOut();
      });

    s.once('disconnect', () => {
      if (reason !== 'PASSWORD_CHANGED') {
        reconnectIfValid();
        return;
      }
      // The fresh cookie from the password change may land just after this event: on a
      // rejected handshake, check the session once more before giving up.
      s.once('connect_error', (err: Error) => {
        if (err.message === 'UNAUTHORIZED') reconnectIfValid();
      });
      s.connect();
    });
  });
}
