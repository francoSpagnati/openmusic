import type { AddressInfo } from 'node:net';
import { prisma } from '@openmusic/db';
import {
  ApiErrorBodySchema,
  SESSION_COOKIE_NAME,
  SocketTokenResponseSchema,
  WS_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@openmusic/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { env } from '../src/config/env';
import { hashSessionToken } from '../src/lib/auth';
import { PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from '../src/lib/client-ip';
import { createUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

/**
 * ADR-014 (deploy on two different sites): the web app proxies `/api/*`, browsers open
 * Socket.io on the API with a short-lived socket token, and rate limiting keys on the real
 * client IP behind proxies.
 */

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function register(ctx: AppContext, name: string) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: `${name}@example.com`, username: name, password: 'a long password 1' },
  });
  expect(res.statusCode).toBe(201);
  const { token, user } = res.json() as { token: string; user: { id: string } };
  return { token, userId: user.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

describe('GET /api/auth/socket-token and socket handshake', () => {
  let ctx: AppContext;
  let url: string;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp({ sessionRecheckMs: 0 });
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
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

  function open(token: string): ClientSocket {
    const socket: ClientSocket = connect(url, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      auth: { token },
    });
    sockets.push(socket);
    return socket;
  }

  function ready(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect_error', reject);
      socket.once(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, () => resolve());
    });
  }

  function connectError(socket: ClientSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => reject(new Error('unexpectedly connected')));
      socket.once('connect_error', (err) => resolve(err.message));
    });
  }

  async function socketToken(cookie: string) {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/socket-token',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    return SocketTokenResponseSchema.parse(res.json());
  }

  it('requires a session', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/socket-token' });
    expect(res.statusCode).toBe(401);
    expect(ApiErrorBodySchema.parse(res.json()).code).toBe('UNAUTHORIZED');
  });

  it('returns a 60 s token bound to the session and the public API URL', async () => {
    const { cookie, token: session } = await register(ctx, 'sock_tok');
    const body = await socketToken(cookie);
    expect(body.url).toBe(env.PUBLIC_API_URL);
    const ttl = Date.parse(body.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(50_000);
    expect(ttl).toBeLessThanOrEqual(60_000);

    const claims = ctx.app.jwt.decode<{ typ: string; sid: string; sexp: number; exp: number }>(
      body.token
    );
    const sessionClaims = ctx.app.jwt.decode<{ exp: number }>(session);
    expect(claims?.typ).toBe('socket');
    expect(claims?.sid).toBe(hashSessionToken(session));
    expect(claims?.sexp).toBe(sessionClaims?.exp);
  });

  it('is never accepted as a session by HTTP routes', async () => {
    const { cookie } = await register(ctx, 'sock_http');
    const { token } = await socketToken(cookie);
    const asBearer = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(asBearer.statusCode).toBe(401);
    const asCookie = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(asCookie.statusCode).toBe(401);
    // ...nor can it mint further socket tokens.
    const again = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/socket-token',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(again.statusCode).toBe(401);
  });

  it('opens a socket, which outlives the token itself (session expiry applies)', async () => {
    const user = await createUser();
    const session = ctx.app.jwt.sign({ sub: user.id, sv: 0 });
    // A socket token that expires in 1 s, for a session valid for a week.
    const shortLived = ctx.app.jwt.sign(
      {
        sub: user.id,
        sv: 0,
        typ: 'socket',
        sid: hashSessionToken(session),
        sexp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      },
      { expiresIn: 1 }
    );
    const socket = open(shortLived);
    await ready(socket);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(socket.connected).toBe(true);
    // Once expired it can no longer open a new one.
    expect(await connectError(open(shortLived))).toBe('UNAUTHORIZED');
  });

  it('logout of the session closes the sockets opened with its socket tokens', async () => {
    const { cookie, userId, token: session } = await register(ctx, 'sock_logout');
    // A second session of the same user (another browser); a different expiry makes it a
    // different token (two logins in the same second would sign identical JWTs).
    const otherSession = ctx.app.jwt.sign({ sub: userId, sv: 0 }, { expiresIn: 3600 });
    expect(otherSession).not.toBe(session);
    const otherCookie = `${SESSION_COOKIE_NAME}=${otherSession}`;

    const a = open((await socketToken(cookie)).token);
    const b = open((await socketToken(otherCookie)).token);
    await Promise.all([ready(a), ready(b)]);

    const revoked = new Promise((resolve) => a.once(WS_EVENTS.SERVER_SESSION_REVOKED, resolve));
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);
    expect(await revoked).toEqual({ reason: 'LOGOUT' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(a.connected).toBe(false);
    expect(b.connected).toBe(true);
  });

  it('rejects socket tokens of a session revoked by a password change', async () => {
    const { cookie } = await register(ctx, 'sock_revoked');
    const { token } = await socketToken(cookie);
    await prisma.user.update({
      where: { username: 'sock_revoked' },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(await connectError(open(token))).toBe('UNAUTHORIZED');
  });
});

describe('rate limiting behind proxies', () => {
  const SECRET = 'proxy-secret-for-tests-0123456789abcdef';
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp({ authRateLimitMax: 2, trustProxy: true, proxySecret: SECRET });
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function login(headers: Record<string, string>): Promise<number> {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers,
      payload: { email: 'nobody@example.com', password: 'whatever-password' },
    });
    return res.statusCode;
  }

  it('keys on the client IP reported by the web proxy when it presents the secret', async () => {
    const viaProxy = (ip: string) => ({
      'x-forwarded-for': '10.0.0.1',
      [PROXY_SECRET_HEADER]: SECRET,
      [PROXY_CLIENT_IP_HEADER]: ip,
    });
    expect([
      await login(viaProxy('203.0.113.7')),
      await login(viaProxy('203.0.113.7')),
      await login(viaProxy('203.0.113.7')),
    ]).toEqual([401, 401, 429]);
    // Another browser behind the same web server has its own budget.
    expect(await login(viaProxy('198.51.100.9'))).toBe(401);
  });

  it('ignores the client IP header without the right secret (falls back to the request IP)', async () => {
    const forged = (ip: string) => ({
      'x-forwarded-for': '192.0.2.50',
      [PROXY_SECRET_HEADER]: 'wrong-secret-wrong-secret-wrong-secret',
      [PROXY_CLIENT_IP_HEADER]: ip,
    });
    expect([
      await login(forged('203.0.113.1')),
      await login(forged('203.0.113.2')),
      await login(forged('203.0.113.3')),
    ]).toEqual([401, 401, 429]);
  });

  it('with TRUST_PROXY uses X-Forwarded-For (direct clients such as the mobile app)', async () => {
    expect([
      await login({ 'x-forwarded-for': '192.0.2.10' }),
      await login({ 'x-forwarded-for': '192.0.2.10' }),
      await login({ 'x-forwarded-for': '192.0.2.10' }),
    ]).toEqual([401, 401, 429]);
    expect(await login({ 'x-forwarded-for': '192.0.2.11' })).toBe(401);
  });
});

describe('rate limiting without TRUST_PROXY', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp({ authRateLimitMax: 2, trustProxy: false });
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('ignores X-Forwarded-For (it could be forged)', async () => {
    const statuses: number[] = [];
    for (const ip of ['192.0.2.1', '192.0.2.2', '192.0.2.3']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-forwarded-for': ip },
        payload: { email: 'nobody@example.com', password: 'whatever-password' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([401, 401, 429]);
  });
});
