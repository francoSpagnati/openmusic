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
    ctx = await createTestApp();
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
});
