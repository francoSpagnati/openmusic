import { z } from 'zod';
import { ApiErrorCodeSchema } from './errors';
import type { FriendPresence, NowPlayingTrack } from './now-playing';
import type { NotificationItem } from './notifications';
import type { ChatMessage } from './social';

/**
 * Socket.io handshake. Browsers authenticate with the httpOnly `om_session` cookie
 * (`withCredentials: true`); native clients pass `auth: { token }`. Connections without a valid
 * session are rejected with a `connect_error` whose `message` is `UNAUTHORIZED`.
 */
export const SocketHandshakeAuthSchema = z.object({
  token: z.string().min(1).optional(),
});

/** Acknowledgement passed to the optional callback of every client -> server event. */
export const WsAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), code: ApiErrorCodeSchema, message: z.string() }),
]);

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
}

export interface ClientToServerEvents {
  'now_playing:update_track': (track: NowPlayingTrack, ack?: WsAckCallback) => void;
  'now_playing:toggle_ghost': (payload: { isGhostMode: boolean }, ack?: WsAckCallback) => void;
}
