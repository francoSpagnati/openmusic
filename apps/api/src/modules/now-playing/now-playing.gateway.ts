import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@openmusic/db';
import {
  NowPlayingTrackSchema,
  SESSION_COOKIE_NAME,
  SocketHandshakeAuthSchema,
  ToggleGhostModeSchema,
  WS_EVENTS,
  type NowPlayingTrack,
  type SessionRevoked,
  type WsAck,
  type WsAckCallback,
} from '@openmusic/shared';
import { isSessionVersionCurrent, verifySessionToken } from '../../lib/auth';
import { toApiError } from '../../lib/error-handler';
import { UnauthorizedError } from '../../lib/errors';
import { userRoom, type OpenMusicIo } from '../../lib/realtime';
import type { NowPlayingService } from './now-playing.service';

interface SocketData {
  userId: string;
  sessionVersion: number;
  /** sha256 of the session token: lets logout close only the sockets of that session. */
  tokenHash: string;
  expiresAt: number | null;
  /** Last time the session was re-checked against the database. */
  validatedAt: number;
}

export interface GatewayOptions {
  /** How often (at most) an event re-checks the session in the DB. */
  sessionRecheckMs?: number;
  /** Minimum spacing of now-playing broadcasts per user; extra updates are coalesced. */
  nowPlayingIntervalMs?: number;
}

/** Closes sockets whose session ended (used by logout and password change). */
export interface SessionSockets {
  /** Every socket of the user, or only those opened with `token` when given. */
  revoke(userId: string, reason: SessionRevoked['reason'], token?: string): Promise<number>;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

/**
 * Leading + trailing throttle per user: the first update is broadcast at once, later ones within
 * the interval are coalesced and only the latest is sent when the interval ends. Scrubbing a
 * track or a buggy client can no longer flood every follower.
 */
class NowPlayingThrottle {
  private readonly lastSent = new Map<string, number>();
  private readonly pending = new Map<string, { track: NowPlayingTrack; timer: NodeJS.Timeout }>();

  constructor(
    private readonly intervalMs: number,
    private readonly publish: (userId: string, track: NowPlayingTrack) => Promise<unknown>,
    private readonly onError: (err: unknown, userId: string) => void
  ) {}

  /** Returns true when the update was published now, false when it was deferred. */
  async submit(userId: string, track: NowPlayingTrack): Promise<boolean> {
    const now = Date.now();
    const last = this.lastSent.get(userId) ?? 0;
    const queued = this.pending.get(userId);
    if (!queued && now - last >= this.intervalMs) {
      this.lastSent.set(userId, now);
      await this.publish(userId, track);
      return true;
    }
    if (queued) {
      queued.track = track;
      return false;
    }
    const timer = setTimeout(
      () => {
        const entry = this.pending.get(userId);
        this.pending.delete(userId);
        if (!entry) return;
        this.lastSent.set(userId, Date.now());
        this.publish(userId, entry.track).catch((err: unknown) => this.onError(err, userId));
      },
      this.intervalMs - (now - last)
    );
    timer.unref();
    this.pending.set(userId, { track, timer });
    return false;
  }

  /** Drops a pending update (user went offline / session revoked). */
  cancel(userId: string): void {
    const entry = this.pending.get(userId);
    if (entry) clearTimeout(entry.timer);
    this.pending.delete(userId);
    this.lastSent.delete(userId);
  }

  dispose(): void {
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
    this.lastSent.clear();
  }
}

export function registerNowPlayingGateway(
  app: FastifyInstance,
  io: OpenMusicIo,
  prisma: PrismaClient,
  nowPlayingService: NowPlayingService,
  options: GatewayOptions = {}
): SessionSockets {
  const recheckMs = options.sessionRecheckMs ?? 15_000;
  const throttle = new NowPlayingThrottle(
    options.nowPlayingIntervalMs ?? 2_000,
    (userId, track) => nowPlayingService.updateUserNowPlaying(userId, track),
    (err, userId) => app.log.warn({ err, userId }, 'Deferred now-playing update failed')
  );
  const expiryTimers = new Map<string, NodeJS.Timeout>();
  app.addHook('onClose', async () => {
    throttle.dispose();
    for (const timer of expiryTimers.values()) clearTimeout(timer);
    expiryTimers.clear();
  });

  type ServerSocket = Parameters<Parameters<OpenMusicIo['on']>[1]>[0];

  function revokeSocket(socket: ServerSocket, reason: SessionRevoked['reason']): void {
    if (!socket.connected) return;
    socket.emit(WS_EVENTS.SERVER_SESSION_REVOKED, { reason });
    socket.disconnect(true);
  }

  // Handshake authentication: the user id ALWAYS comes from a verified session, never from the
  // client payload. Unauthenticated sockets are rejected before `connection` fires.
  io.use((socket, next) => {
    const token = extractToken(app, socket.handshake);
    if (!token) return next(new Error('UNAUTHORIZED'));
    verifySessionToken(app, prisma, token)
      .then((session) => {
        if (!session) return next(new Error('UNAUTHORIZED'));
        const data: SocketData = {
          userId: session.auth.userId,
          sessionVersion: session.sessionVersion,
          tokenHash: hashSessionToken(token),
          expiresAt: session.expiresAt,
          validatedAt: Date.now(),
        };
        Object.assign(socket.data as SocketData, data);
        next();
      })
      .catch(() => next(new Error('UNAUTHORIZED')));
  });

  io.on('connection', async (socket) => {
    const data = socket.data as SocketData;
    const { userId } = data;
    // In-memory adapter: join is synchronous, so handlers below are attached before any await.
    void socket.join(userRoom(userId));

    // A token expiring while connected closes the socket at that moment.
    if (data.expiresAt !== null) {
      const delay = Math.max(0, Math.min(data.expiresAt - Date.now(), 2 ** 31 - 1));
      const timer = setTimeout(() => revokeSocket(socket, 'EXPIRED'), delay);
      timer.unref();
      expiryTimers.set(socket.id, timer);
    }

    /**
     * Re-checks the session (expiry, password change, deleted user) before acting on an event.
     * Returns why it is no longer valid, or null.
     */
    async function sessionProblem(): Promise<SessionRevoked['reason'] | null> {
      const now = Date.now();
      if (data.expiresAt !== null && now >= data.expiresAt) return 'EXPIRED';
      if (now - data.validatedAt < recheckMs) return null;
      if (!(await isSessionVersionCurrent(prisma, userId, data.sessionVersion))) return 'INVALID';
      data.validatedAt = now;
      return null;
    }

    async function handle(ack: unknown, action: () => Promise<unknown>): Promise<void> {
      try {
        const problem = await sessionProblem();
        if (problem) {
          // Ack first: packets are delivered in order, so the client sees why before the close.
          const body = toApiError(new UnauthorizedError('Sessione non più valida'));
          respond(ack, { ok: false, code: body.code, message: body.message });
          revokeSocket(socket, problem);
          return;
        }
        await action();
        respond(ack, { ok: true });
      } catch (err) {
        const body = toApiError(err);
        if (body.statusCode >= 500) app.log.error({ err, userId }, 'Socket handler failed');
        respond(ack, { ok: false, code: body.code, message: body.message });
      }
    }

    socket.on(WS_EVENTS.CLIENT_UPDATE_TRACK, (payload: unknown, ack?: unknown) => {
      void handle(ack, async () => {
        // Validate before throttling so malformed payloads still get an error ack.
        const track = NowPlayingTrackSchema.parse(payload);
        await throttle.submit(userId, track);
      });
    });

    socket.on(WS_EVENTS.CLIENT_TOGGLE_GHOST, (payload: unknown, ack?: unknown) => {
      void handle(ack, async () => {
        const { isGhostMode } = ToggleGhostModeSchema.parse(payload);
        // Ghost Mode must not be overtaken by a deferred track update.
        if (isGhostMode) throttle.cancel(userId);
        await nowPlayingService.setGhostMode(userId, isGhostMode);
      });
    });

    socket.on('disconnect', () => {
      const timer = expiryTimers.get(socket.id);
      if (timer) clearTimeout(timer);
      expiryTimers.delete(socket.id);
      // Only the last tab/device going away makes the user offline.
      const remaining = io.sockets.adapter.rooms.get(userRoom(userId))?.size ?? 0;
      if (remaining === 0) {
        throttle.cancel(userId);
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

  return {
    async revoke(userId, reason, token) {
      const tokenHash = token ? hashSessionToken(token) : null;
      const sockets = await io.in(userRoom(userId)).fetchSockets();
      let count = 0;
      for (const remote of sockets) {
        const socketData = remote.data as SocketData;
        if (tokenHash && socketData.tokenHash !== tokenHash) continue;
        remote.emit(WS_EVENTS.SERVER_SESSION_REVOKED, { reason });
        remote.disconnect(true);
        count++;
      }
      return count;
    },
  };
}
