import { prisma } from '@openmusic/db';
import {
  ApiErrorBodySchema,
  AuthSessionResponseSchema,
  ChangePasswordResponseSchema,
  MeResponseSchema,
  SESSION_COOKIE_NAME,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

const PASSWORD = 'correct horse battery';

describe('auth: local accounts', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  function register(body: Record<string, unknown>) {
    return ctx.app.inject({ method: 'POST', url: '/api/auth/register', payload: body });
  }

  function login(email: string, password: string) {
    return ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
  }

  it('registers, hashes the password and sets an httpOnly session cookie', async () => {
    const res = await register({
      email: 'Elena@Example.com',
      username: 'Elena_R',
      password: PASSWORD,
      favoriteGenres: ['Shoegaze'],
    });

    expect(res.statusCode).toBe(201);
    const body = AuthSessionResponseSchema.parse(res.json());
    expect(body.user).toMatchObject({
      email: 'elena@example.com',
      username: 'elena_r',
      role: 'USER',
      favoriteGenres: ['Shoegaze'],
      hasPassword: true,
    });
    expect(body.connectedAccounts).toEqual([]);

    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe(body.token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: body.user.id } });
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);
  });

  it('returns 400 with field errors for invalid input', async () => {
    const res = await register({ email: 'not-an-email', username: 'a', password: 'short' });

    expect(res.statusCode).toBe(400);
    const body = ApiErrorBodySchema.parse(res.json());
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(body.fieldErrors ?? {}).sort()).toEqual(['email', 'password', 'username']);
  });

  it('returns 409 when the email or username is taken', async () => {
    await register({ email: 'a@example.com', username: 'first', password: PASSWORD });

    const sameEmail = await register({
      email: 'A@example.com',
      username: 'second',
      password: PASSWORD,
    });
    expect(sameEmail.statusCode).toBe(409);
    expect(sameEmail.json()).toMatchObject({ code: 'CONFLICT', message: 'Email già registrata' });

    const sameUsername = await register({
      email: 'b@example.com',
      username: 'FIRST',
      password: PASSWORD,
    });
    expect(sameUsername.statusCode).toBe(409);
    expect(sameUsername.json()).toMatchObject({ message: 'Username già in uso' });
  });

  it('logs in with the right password and rejects wrong or unknown credentials alike', async () => {
    await register({ email: 'user@example.com', username: 'user1', password: PASSWORD });

    const ok = await login('USER@example.com', PASSWORD);
    expect(ok.statusCode).toBe(200);
    AuthSessionResponseSchema.parse(ok.json());

    const wrong = await login('user@example.com', 'wrong password!!');
    const unknown = await login('nobody@example.com', PASSWORD);
    for (const res of [wrong, unknown]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email o password non corretti',
      });
    }
  });

  it('rejects password login for OAuth-only accounts', async () => {
    await prisma.user.create({ data: { email: 'oauth@example.com', username: 'oauth_only' } });
    const res = await login('oauth@example.com', PASSWORD);
    expect(res.statusCode).toBe(401);
  });

  it('GET /me works with the bearer token and with the cookie', async () => {
    const reg = await register({
      email: 'me@example.com',
      username: 'me_user',
      password: PASSWORD,
    });
    const { token, user } = AuthSessionResponseSchema.parse(reg.json());

    const viaBearer = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(viaBearer.statusCode).toBe(200);
    expect(MeResponseSchema.parse(viaBearer.json()).user.id).toBe(user.id);

    const viaCookie = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { [SESSION_COOKIE_NAME]: token },
    });
    expect(viaCookie.statusCode).toBe(200);
  });

  it.each([
    ['no credentials', {}],
    ['a malformed token', { authorization: 'Bearer not-a-jwt' }],
    [
      'a token signed with another key',
      {
        authorization:
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.c2lnbmF0dXJl',
      },
    ],
  ])('GET /me returns 401 with %s', async (_label, headers) => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('GET /me returns 401 for a valid token whose user was deleted', async () => {
    const reg = await register({ email: 'gone@example.com', username: 'gone', password: PASSWORD });
    const { token, user } = AuthSessionResponseSchema.parse(reg.json());
    await prisma.user.delete({ where: { id: user.id } });

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe('');
  });

  it('PATCH /me updates settings and rejects unknown fields', async () => {
    const reg = await register({
      email: 'set@example.com',
      username: 'settings',
      password: PASSWORD,
    });
    const { token } = AuthSessionResponseSchema.parse(reg.json());
    const headers = { authorization: `Bearer ${token}` };

    const ok = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers,
      payload: { displayName: 'Nuovo Nome', isGhostMode: true, favoriteGenres: ['Jazz'] },
    });
    expect(ok.statusCode).toBe(200);
    expect(MeResponseSchema.parse(ok.json()).user).toMatchObject({
      displayName: 'Nuovo Nome',
      isGhostMode: true,
      favoriteGenres: ['Jazz'],
    });

    const escalation = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers,
      payload: { role: 'ADMIN' },
    });
    expect(escalation.statusCode).toBe(400);
  });

  it('changes the password only with the current one', async () => {
    const reg = await register({
      email: 'pw@example.com',
      username: 'pw_user',
      password: PASSWORD,
    });
    const { token } = AuthSessionResponseSchema.parse(reg.json());
    const headers = { authorization: `Bearer ${token}` };

    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers,
      payload: { currentPassword: 'nope nope nope', newPassword: 'another long password' },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers,
      payload: { currentPassword: PASSWORD, newPassword: 'another long password' },
    });
    expect(ok.statusCode).toBe(200);
    // Native clients get a replacement Bearer token in the body; the old one is revoked.
    const { token: fresh } = ChangePasswordResponseSchema.parse(ok.json());
    const meWith = (bearer: string) =>
      ctx.app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${bearer}` },
      });
    expect((await meWith(fresh)).statusCode).toBe(200);
    expect((await login('pw@example.com', 'another long password')).statusCode).toBe(200);
    expect((await login('pw@example.com', PASSWORD)).statusCode).toBe(401);
  });

  it('rejects the Spotify callback without a matching OAuth state (redirect to the web app)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/spotify/callback?code=abc&state=forged',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      'http://localhost:3000/auth?oauth=spotify&status=error&code=FORBIDDEN'
    );
  });

  it('redirects OAuth callbacks back to the web app with an error status', async () => {
    const state = 'state-for-test-1234567890';
    const cookies = { om_oauth_state: state };

    // User denied consent on Spotify while signed in: back to the settings page.
    const reg = await register({
      email: 'oauth@example.com',
      username: 'oauth_u',
      password: PASSWORD,
    });
    const { token } = AuthSessionResponseSchema.parse(reg.json());
    const denied = await ctx.app.inject({
      method: 'GET',
      url: `/api/auth/spotify/callback?error=access_denied&state=${state}`,
      cookies,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(denied.statusCode).toBe(302);
    expect(denied.headers.location).toBe(
      'http://localhost:3000/settings?oauth=spotify&status=error&code=BAD_REQUEST'
    );

    // Last.fm needs a signed-in user: no JSON 401, a redirect the web can show.
    const anonymous = await ctx.app.inject({
      method: 'GET',
      url: `/api/auth/lastfm/callback?token=t0k3n&state=${state}`,
      cookies,
    });
    expect(anonymous.statusCode).toBe(302);
    expect(anonymous.headers.location).toBe(
      'http://localhost:3000/settings?oauth=lastfm&status=error&code=UNAUTHORIZED'
    );
  });

  it('sends security headers and never leaks internals on unknown errors', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();

    const notFound = await ctx.app.inject({ method: 'GET', url: '/api/nope' });
    expect(notFound.statusCode).toBe(404);
    expect(ApiErrorBodySchema.parse(notFound.json()).code).toBe('NOT_FOUND');
  });
});

describe('auth: rate limiting', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp({ authRateLimitMax: 3 });
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('returns 429 after too many login attempts from one IP', async () => {
    const attempt = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'x@example.com', password: 'whatever-password' },
      });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await attempt()).statusCode);

    expect(statuses).toEqual([401, 401, 401, 429]);
    const limited = await attempt();
    expect(ApiErrorBodySchema.parse(limited.json()).code).toBe('RATE_LIMITED');
  });
});
