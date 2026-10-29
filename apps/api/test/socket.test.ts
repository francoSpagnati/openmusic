import type { AddressInfo } from 'node:net';
import { prisma } from '@openmusic/db';
import {
  SESSION_COOKIE_NAME,
  WS_EVENTS,
  type ClientToServerEvents,
  type FriendPresence,
  type NotificationItem,
  type NowPlayingTrack,
  type ServerToClientEvents,
  type WsAck,
} from '@openmusic/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { createUser, tokenFor } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TRACK: NowPlayingTrack = {
  title: 'Weird Fishes/Arpeggi',
  artistName: 'Radiohead',
  dominantColor: '#D97736',
  durationMs: 318_000,
  progressMs: 10_000,
  provider: 'SPOTIFY',
  isPlaying: true,
  updatedAt: Date.now(),
};

describe('Socket.io gateway', () => {
  let ctx: AppContext;
  let url: string;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    // Re-check the session on every event and use a short now-playing throttle window.
    ctx = await createTestApp({ sessionRecheckMs: 0, nowPlayingIntervalMs: 300 });
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = ctx.app.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  function open(options: { token?: string; cookie?: string } = {}): ClientSocket {
    const socket: ClientSocket = connect(url, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      auth: options.token ? { token: options.token } : {},
      extraHeaders: options.cookie ? { cookie: options.cookie } : undefined,
    });
    sockets.push(socket);
    return socket;
  }

  function connectError(socket: ClientSocket): Promise<Error> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => reject(new Error('unexpectedly connected')));
      socket.once('connect_error', resolve);
    });
  }

  /** Resolves with the initial friends state, which the server sends right after `connection`. */
  function ready(socket: ClientSocket): Promise<FriendPresence[]> {
    return new Promise((resolve, reject) => {
      socket.once('connect_error', reject);
      socket.once(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, resolve);
    });
  }

  function next<E extends keyof ServerToClientEvents>(
    socket: ClientSocket,
    event: E,
    timeoutMs = 2000
  ): Promise<Parameters<ServerToClientEvents[E]>[0]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      const handler = (payload: Parameters<ServerToClientEvents[E]>[0]) => {
        clearTimeout(timer);
        resolve(payload);
      };
      // socket.io-client's typed `once` needs the listener cast to the event's signature.
      socket.once(event, handler as never);
    });
  }

  function emitWithAck(
    socket: ClientSocket,
    event: 'now_playing:update_track' | 'now_playing:toggle_ghost',
    payload: unknown
  ): Promise<WsAck> {
    return new Promise((resolve) => {
      (socket.emit as (e: string, p: unknown, ack: (a: WsAck) => void) => void)(
        event,
        payload,
        resolve
      );
    });
  }

  it('rejects connections without a session', async () => {
    const err = await connectError(open());
    expect(err.message).toBe('UNAUTHORIZED');
  });

  it('rejects a forged userId in the handshake (no impersonation)', async () => {
    const victim = await createUser();
    const socket: ClientSocket = connect(url, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      auth: { userId: victim.id },
    });
    sockets.push(socket);
    expect((await connectError(socket)).message).toBe('UNAUTHORIZED');
  });

  it('rejects invalid tokens and tokens of deleted users', async () => {
    expect((await connectError(open({ token: 'garbage' }))).message).toBe('UNAUTHORIZED');

    const user = await createUser();
    const token = tokenFor(ctx, user.id);
    await prisma.user.delete({ where: { id: user.id } });
    expect((await connectError(open({ token }))).message).toBe('UNAUTHORIZED');
  });

  it('accepts a bearer token in auth and the session cookie', async () => {
    const user = await createUser();
    const token = tokenFor(ctx, user.id);

    await expect(ready(open({ token }))).resolves.toEqual([]);
    await expect(ready(open({ cookie: `${SESSION_COOKIE_NAME}=${token}` }))).resolves.toEqual([]);
  });

  it('echoes the own presence back to the own sockets, not to strangers', async () => {
    const dj = await createUser({ username: 'djself' });
    const stranger = await createUser({ username: 'strangerself' });
    const djSocket = open({ token: tokenFor(ctx, dj.id) });
    const strangerSocket = open({ token: tokenFor(ctx, stranger.id) });
    await Promise.all([ready(djSocket), ready(strangerSocket)]);

    let strangerReceived = false;
    strangerSocket.on(WS_EVENTS.SERVER_SELF_PRESENCE_CHANGED, () => {
      strangerReceived = true;
    });

    const received = next(djSocket, WS_EVENTS.SERVER_SELF_PRESENCE_CHANGED);
    expect(await emitWithAck(djSocket, WS_EVENTS.CLIENT_UPDATE_TRACK, TRACK)).toEqual({ ok: true });
    expect(await received).toMatchObject({
      userId: dj.id,
      currentlyPlaying: { title: TRACK.title },
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(strangerReceived).toBe(false);
  });

  it('sends presence only to followers, never to other sockets', async () => {
    const dj = await createUser({ username: 'dj' });
    const follower = await createUser({ username: 'follower' });
    const stranger = await createUser({ username: 'stranger' });
    await prisma.follows.create({ data: { followerId: follower.id, followingId: dj.id } });

    const djSocket = open({ token: tokenFor(ctx, dj.id) });
    const followerSocket = open({ token: tokenFor(ctx, follower.id) });
    const strangerSocket = open({ token: tokenFor(ctx, stranger.id) });
    await Promise.all([ready(djSocket), ready(followerSocket), ready(strangerSocket)]);

    let strangerReceived = false;
    strangerSocket.on(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, () => {
      strangerReceived = true;
    });

    const received = next(followerSocket, WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED);
    const ack = await emitWithAck(djSocket, WS_EVENTS.CLIENT_UPDATE_TRACK, TRACK);
    expect(ack).toEqual({ ok: true });

    const presence = await received;
    expect(presence).toMatchObject({
      userId: dj.id,
      isOnline: true,
      currentlyPlaying: { title: TRACK.title },
    });

    // Ghost mode hides the track from followers.
    const ghost = next(followerSocket, WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED);
    expect(
      await emitWithAck(djSocket, WS_EVENTS.CLIENT_TOGGLE_GHOST, { isGhostMode: true })
    ).toEqual({
      ok: true,
    });
    expect(await ghost).toMatchObject({ isGhostMode: true, currentlyPlaying: null });

    await new Promise((r) => setTimeout(r, 100));
    expect(strangerReceived).toBe(false);

    // A late-joining follower gets the stored state on connect.
    const late = open({ token: tokenFor(ctx, follower.id) });
    const initial = await ready(late);
    expect(initial.map((p) => p.userId)).toEqual([dj.id]);

    // Leaving publishes an offline presence to followers.
    const offline = next(followerSocket, WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED);
    djSocket.disconnect();
    expect(await offline).toMatchObject({ userId: dj.id, isOnline: false });
  });

  it('acks validation errors for malformed payloads without disconnecting', async () => {
    const user = await createUser();
    const socket = open({ token: tokenFor(ctx, user.id) });
    await ready(socket);

    const ack = await emitWithAck(socket, WS_EVENTS.CLIENT_UPDATE_TRACK, { title: '' });
    expect(ack).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(socket.connected).toBe(true);

    const ghostAck = await emitWithAck(socket, WS_EVENTS.CLIENT_TOGGLE_GHOST, {
      isGhostMode: 'yes',
    });
    expect(ghostAck).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('pushes notifications live to the recipient', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const socket = open({ token: tokenFor(ctx, alice.id) });
    await ready(socket);

    const live = next(socket, WS_EVENTS.SERVER_NOTIFICATION);
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${alice.id}/follow`,
      headers: { authorization: `Bearer ${tokenFor(ctx, bob.id)}` },
    });
    const notification: NotificationItem = await live;
    expect(notification).toMatchObject({ type: 'FOLLOW', actor: { id: bob.id } });
  });

  it('closes only the logged-out session sockets on logout', async () => {
    const user = await createUser();
    const tokenA = ctx.app.jwt.sign({ sub: user.id });
    const tokenB = ctx.app.jwt.sign({ sub: user.id, sv: 0 });
    expect(tokenA).not.toBe(tokenB);
    const a = open({ token: tokenA });
    const b = open({ cookie: `${SESSION_COOKIE_NAME}=${tokenB}` });
    await Promise.all([ready(a), ready(b)]);

    const revoked = next(a, WS_EVENTS.SERVER_SESSION_REVOKED);
    const closed = new Promise((resolve) => a.once('disconnect', resolve));
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(204);
    expect(await revoked).toEqual({ reason: 'LOGOUT' });
    expect(await closed).toBe('io server disconnect');
    expect(b.connected).toBe(true);
  });

  it('closes every socket of the user on password change', async () => {
    const reg = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'sock-pw@example.com', username: 'sock_pw', password: 'a long password 1' },
    });
    const { token } = reg.json() as { token: string };
    const a = open({ token });
    const b = open({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
    await Promise.all([ready(a), ready(b)]);

    const revokedA = next(a, WS_EVENTS.SERVER_SESSION_REVOKED);
    const revokedB = next(b, WS_EVENTS.SERVER_SESSION_REVOKED);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'a long password 1', newPassword: 'a new long password 2' },
    });
    expect(res.statusCode).toBe(200);
    expect(await revokedA).toEqual({ reason: 'PASSWORD_CHANGED' });
    expect(await revokedB).toEqual({ reason: 'PASSWORD_CHANGED' });
    // The old token can no longer open a socket.
    expect((await connectError(open({ token }))).message).toBe('UNAUTHORIZED');
  });

  it('re-validates the session on events and disconnects revoked sessions', async () => {
    const user = await createUser();
    const socket = open({ token: tokenFor(ctx, user.id) });
    await ready(socket);
    // Revoked out of band (e.g. password changed on another API instance).
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    const revoked = next(socket, WS_EVENTS.SERVER_SESSION_REVOKED);
    const ack = await emitWithAck(socket, WS_EVENTS.CLIENT_UPDATE_TRACK, TRACK);
    expect(ack).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(await revoked).toEqual({ reason: 'INVALID' });
  });

  it('disconnects a socket when its token expires', async () => {
    const user = await createUser();
    const token = ctx.app.jwt.sign({ sub: user.id }, { expiresIn: 1 });
    const socket = open({ token });
    await ready(socket);
    expect(await next(socket, WS_EVENTS.SERVER_SESSION_REVOKED, 3_000)).toEqual({
      reason: 'EXPIRED',
    });
  });

  it('throttles now-playing updates: first at once, then only the latest per window', async () => {
    const dj = await createUser();
    const follower = await createUser();
    await prisma.follows.create({ data: { followerId: follower.id, followingId: dj.id } });
    const djSocket = open({ token: tokenFor(ctx, dj.id) });
    const followerSocket = open({ token: tokenFor(ctx, follower.id) });
    await Promise.all([ready(djSocket), ready(followerSocket)]);

    const received: string[] = [];
    followerSocket.on(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, (p) => {
      if (p.currentlyPlaying) received.push(p.currentlyPlaying.title);
    });
    for (let i = 1; i <= 5; i++) {
      const ack = await emitWithAck(djSocket, WS_EVENTS.CLIENT_UPDATE_TRACK, {
        ...TRACK,
        title: `Track ${i}`,
      });
      expect(ack).toEqual({ ok: true });
    }
    await new Promise((r) => setTimeout(r, 600));
    expect(received).toEqual(['Track 1', 'Track 5']);
  });
});
