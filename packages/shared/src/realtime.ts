import { z } from 'zod';
import { ApiErrorCodeSchema } from './errors';
import type { FriendPresence, NowPlayingTrack } from './now-playing';
import type { NotificationItem } from './notifications';
import type { ChatMessage } from './social';

/**
 * Socket.io handshake. Native clients pass their session token as `auth: { token }`; the web app
 * passes a short-lived socket token from `GET /api/auth/socket-token` (ADR-014). The httpOnly
 * `om_session` cookie is still accepted when the browser sends it (API on the web app's site).
 * Connections without a valid session are rejected with a `connect_error` `UNAUTHORIZED`.
 */
export const SocketHandshakeAuthSchema = z.object({
  token: z.string().min(1).optional(),
});

/** Acknowledgement passed to the optional callback of every client -> server event. */
export const WsAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), code: ApiErrorCodeSchema, message: z.string() }),
]);

/**
 * Sent right before the server closes a socket whose session ended: logout from this session,
 * password change (every session of the user), token expiry, or a session that is no longer
 * valid when re-checked on an event. A server-side disconnect is NOT retried automatically by
 * socket.io-client: after `PASSWORD_CHANGED` the device that changed the password has a fresh
 * cookie and may call `socket.connect()` again; otherwise the client should sign out.
 */
export const SessionRevokedSchema = z.object({
  reason: z.enum(['LOGOUT', 'PASSWORD_CHANGED', 'EXPIRED', 'INVALID']),
});

export type SessionRevoked = z.infer<typeof SessionRevokedSchema>;
export type SocketHandshakeAuth = z.infer<typeof SocketHandshakeAuthSchema>;
export type WsAck = z.infer<typeof WsAckSchema>;
export type WsAckCallback = (ack: WsAck) => void;

/** Typed Socket.io maps: `Server<ClientToServerEvents, ServerToClientEvents>` and vice versa. */
export interface ServerToClientEvents {
  'now_playing:initial_friends_state': (friends: FriendPresence[]) => void;
  /** Sent only to users who follow the changed user. `isOnline: false` means they left. */
  'now_playing:friend_presence_changed': (friend: FriendPresence) => void;
  'notification:new': (notification: NotificationItem) => void;
  'chat:message': (message: ChatMessage) => void;
  'session:revoked': (payload: SessionRevoked) => void;
}

export interface ClientToServerEvents {
  'now_playing:update_track': (track: NowPlayingTrack, ack?: WsAckCallback) => void;
  'now_playing:toggle_ghost': (payload: { isGhostMode: boolean }, ack?: WsAckCallback) => void;
}
