import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@openmusic/db';
import {
  SESSION_COOKIE_NAME,
  SocketHandshakeAuthSchema,
  ToggleGhostModeSchema,
  WS_EVENTS,
  type WsAck,
  type WsAckCallback,
} from '@openmusic/shared';
import { resolveSessionToken } from '../../lib/auth';
import { toApiError } from '../../lib/error-handler';
import { userRoom, type OpenMusicIo } from '../../lib/realtime';
import type { NowPlayingService } from './now-playing.service';

interface SocketData {
  userId: string;
}

/** Bearer token from `auth.token` (native apps) or the httpOnly session cookie (browsers). */
function extractToken(
  app: FastifyInstance,
  handshake: { auth: unknown; headers: { cookie?: string } }
) {
  const parsed = SocketHandshakeAuthSchema.safeParse(handshake.auth ?? {});
  if (parsed.success && parsed.data.token) return parsed.data.token;
  const cookieHeader = handshake.headers.cookie;
  if (!cookieHeader) return null;
  return app.parseCookie(cookieHeader)[SESSION_COOKIE_NAME] ?? null;
}

function respond(ack: unknown, result: WsAck): void {
  if (typeof ack === 'function') (ack as WsAckCallback)(result);
}

export function registerNowPlayingGateway(
  app: FastifyInstance,
  io: OpenMusicIo,
  prisma: PrismaClient,
  nowPlayingService: NowPlayingService
): void {
  // Handshake authentication: the user id ALWAYS comes from a verified session, never from the
  // client payload. Unauthenticated sockets are rejected before `connection` fires.
  io.use((socket, next) => {
    const token = extractToken(app, socket.handshake);
    if (!token) return next(new Error('UNAUTHORIZED'));
    resolveSessionToken(app, prisma, token)
      .then((auth) => {
        if (!auth) return next(new Error('UNAUTHORIZED'));
        (socket.data as SocketData).userId = auth.userId;
        next();
      })
      .catch(() => next(new Error('UNAUTHORIZED')));
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data as SocketData;
    // In-memory adapter: join is synchronous, so handlers below are attached before any await.
    void socket.join(userRoom(userId));

    async function handle(ack: unknown, action: () => Promise<unknown>): Promise<void> {
      try {
        await action();
        respond(ack, { ok: true });
      } catch (err) {
        const body = toApiError(err);
        if (body.statusCode >= 500) app.log.error({ err, userId }, 'Socket handler failed');
        respond(ack, { ok: false, code: body.code, message: body.message });
      }
    }

    socket.on(WS_EVENTS.CLIENT_UPDATE_TRACK, (payload: unknown, ack?: unknown) => {
      void handle(ack, () => nowPlayingService.updateUserNowPlaying(userId, payload));
    });

    socket.on(WS_EVENTS.CLIENT_TOGGLE_GHOST, (payload: unknown, ack?: unknown) => {
      void handle(ack, async () => {
        const { isGhostMode } = ToggleGhostModeSchema.parse(payload);
        await nowPlayingService.setGhostMode(userId, isGhostMode);
      });
    });

    socket.on('disconnect', () => {
      // Only the last tab/device going away makes the user offline.
      const remaining = io.sockets.adapter.rooms.get(userRoom(userId))?.size ?? 0;
      if (remaining === 0) {
        nowPlayingService.setOffline(userId).catch((err: unknown) => {
          app.log.warn({ err, userId }, 'Failed to publish offline presence');
        });
      }
    });

    try {
      const initialFriends = await nowPlayingService.getFriendsLivePresence(userId);
      socket.emit(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, initialFriends);
    } catch (err) {
      app.log.warn({ err, userId }, 'Failed to load initial friends presence');
      socket.emit(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, []);
    }
  });
}
