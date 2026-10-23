import { createHash } from 'node:crypto';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import type { PrismaClient, Role } from '@openmusic/db';
import { SESSION_COOKIE_NAME } from '@openmusic/shared';
import type { Env } from '../config/env';
import { ForbiddenError, UnauthorizedError } from './errors';

/** The authenticated principal attached to a request by `authenticate` / `optionalAuth`. */
export interface AuthContext {
  userId: string;
  role: Role;
}

export interface SessionTokenPayload {
  sub: string;
  /** `User.sessionVersion` at issue time; a password change bumps it and revokes older tokens. */
  sv?: number;
  /**
   * Token kind. Absent = session token (cookie / Bearer). `socket` = short-lived Socket.io
   * handshake token (`GET /api/auth/socket-token`), never accepted by HTTP routes.
   */
  typ?: 'socket';
  /** Socket tokens: sha256 of the session token they were derived from (logout closes them). */
  sid?: string;
  /** Socket tokens: expiry (seconds since epoch) of that session; the socket closes then. */
  sexp?: number;
}

/** Lifetime of a Socket.io handshake token: long enough to connect, useless once leaked. */
export const SOCKET_TOKEN_TTL_SECONDS = 60;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionTokenPayload;
    user: SessionTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    /** preHandler: 401 unless a valid session (Bearer header or `om_session` cookie) is present. */
    authenticate: preHandlerAsyncHookHandler;
    /** preHandler: sets `request.auth` when a valid session is present, otherwise null. */
    optionalAuth: preHandlerAsyncHookHandler;
    /** preHandler factory: 403 unless the authenticated user has one of `roles`. */
    requireRole: (...roles: Role[]) => preHandlerAsyncHookHandler;
    issueSession: (
      reply: FastifyReply,
      userId: string
    ) => Promise<{ token: string; expiresAt: string }>;
    clearSession: (reply: FastifyReply) => void;
  }
}

/** Returns the authenticated principal or throws 401. Use inside handlers behind `authenticate`. */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth;
}

function hasCredentials(request: FastifyRequest): boolean {
  return (
    /^Bearer\s/i.test(request.headers.authorization ?? '') ||
    Boolean(request.cookies?.[SESSION_COOKIE_NAME])
  );
}

/** Verifies a raw session token and loads the current role (roles can change after login). */
export async function resolveSessionToken(
  app: FastifyInstance,
  prisma: PrismaClient,
  token: string
): Promise<AuthContext | null> {
  let payload: SessionTokenPayload;
  try {
    payload = app.jwt.verify<SessionTokenPayload>(token);
  } catch {
    return null;
  }
  return loadPrincipal(prisma, payload);
}

export interface VerifiedSession {
  auth: AuthContext;
  /** `sv` claim: compared with `User.sessionVersion` when the session is re-checked. */
  sessionVersion: number;
  /** Session expiry (ms since epoch), null when the token has no `exp`. */
  expiresAt: number | null;
  /** sha256 of the SESSION token (for a socket token: of the session it was issued for). */
  sessionHash: string;
}

/**
 * Verifies a token presented on a long-lived connection (Socket.io handshake): a session token
 * (native apps, cookie) or a socket token issued by `GET /api/auth/socket-token` (browsers whose
 * session cookie lives on the web origin). Keeps the claims needed to re-check it later.
 */
export async function verifySessionToken(
  app: FastifyInstance,
  prisma: PrismaClient,
  token: string
): Promise<VerifiedSession | null> {
  let payload: SessionTokenPayload & { exp?: number };
  try {
    payload = app.jwt.verify<SessionTokenPayload & { exp?: number }>(token);
  } catch {
    return null;
  }
  const isSocketToken = payload.typ === 'socket';
  if (isSocketToken && typeof payload.sid !== 'string') return null;
  const auth = await loadPrincipal(prisma, payload, { allowSocketToken: isSocketToken });
  if (!auth) return null;
  const exp = isSocketToken ? payload.sexp : payload.exp;
  return {
    auth,
    sessionVersion: payload.sv ?? 0,
    expiresAt: typeof exp === 'number' ? exp * 1000 : null,
    sessionHash: isSocketToken ? (payload.sid as string) : hashSessionToken(token),
  };
}

/**
 * Short-lived Socket.io handshake token for the session `sessionToken` (already verified by
 * `authenticate`). Browsers cannot send the session cookie to the API's own origin when the web
 * app proxies `/api/*` (ADR-014), so they fetch this through the proxy and pass it as
 * `auth.token`. It carries the session's version, hash and expiry: logout, password change and
 * expiry close the socket exactly as for a cookie-authenticated one.
 */
export function issueSocketToken(
  app: FastifyInstance,
  sessionToken: string
): { token: string; expiresAt: string } {
  const session = app.jwt.decode<SessionTokenPayload & { exp?: number }>(sessionToken);
  if (!session || typeof session.sub !== 'string' || session.typ === 'socket') {
    throw new UnauthorizedError();
  }
  const ttl =
    typeof session.exp === 'number'
      ? Math.max(1, Math.min(SOCKET_TOKEN_TTL_SECONDS, session.exp - Math.floor(Date.now() / 1000)))
      : SOCKET_TOKEN_TTL_SECONDS;
  const payload: SessionTokenPayload = {
    sub: session.sub,
    sv: session.sv ?? 0,
    typ: 'socket',
    sid: hashSessionToken(sessionToken),
    ...(typeof session.exp === 'number' ? { sexp: session.exp } : {}),
  };
  const token = app.jwt.sign(payload, { expiresIn: ttl });
  return { token, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
}

/** True while the user exists and still has the session version the token was issued with. */
export async function isSessionVersionCurrent(
  prisma: PrismaClient,
  userId: string,
  sessionVersion: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return user !== null && user.sessionVersion === sessionVersion;
}

/** The raw session token of a request (Bearer header first, then the cookie), if any. */
export function requestSessionToken(request: FastifyRequest): string | null {
  const header = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '');
  if (header?.[1]) return header[1].trim();
  return request.cookies?.[SESSION_COOKIE_NAME] ?? null;
}

async function loadPrincipal(
  prisma: PrismaClient,
  payload: SessionTokenPayload,
  options: { allowSocketToken?: boolean } = {}
): Promise<AuthContext | null> {
  if (typeof payload.sub !== 'string') return null;
  // A socket token only opens a socket: never a session for HTTP routes.
  if (payload.typ !== undefined && !(payload.typ === 'socket' && options.allowSocketToken)) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, sessionVersion: true },
  });
  if (!user || (payload.sv ?? 0) !== user.sessionVersion) return null;
  return { userId: user.id, role: user.role };
}

/**
 * Session strategy (see docs/06_API_AND_AUTH.md):
 * - Browsers: httpOnly, SameSite=Lax `om_session` cookie set by login/register.
 * - Native apps / scripts: `Authorization: Bearer <token>` (the same JWT, returned in the body).
 * Both are verified here; the header wins when both are present.
 */
export function registerAuth(app: FastifyInstance, prisma: PrismaClient, env: Env): void {
  app.decorateRequest('auth', null);

  async function resolve(request: FastifyRequest): Promise<AuthContext | null> {
    let payload: SessionTokenPayload;
    try {
      payload = await request.jwtVerify<SessionTokenPayload>();
    } catch {
      return null;
    }
    return loadPrincipal(prisma, payload);
  }

  app.decorate('authenticate', async function authenticate(request: FastifyRequest) {
    const auth = hasCredentials(request) ? await resolve(request) : null;
    if (!auth) throw new UnauthorizedError();
    request.auth = auth;
  });

  app.decorate('optionalAuth', async function optionalAuth(request: FastifyRequest) {
    // An expired/invalid session on a public route degrades to anonymous instead of failing.
    request.auth = hasCredentials(request) ? await resolve(request) : null;
  });

  app.decorate('requireRole', (...roles: Role[]): preHandlerAsyncHookHandler => {
    return async function requireRole(request: FastifyRequest) {
      const auth = requireAuth(request);
      if (!roles.includes(auth.role)) throw new ForbiddenError('Permessi insufficienti');
    };
  });

  app.decorate('issueSession', async (reply: FastifyReply, userId: string) => {
    const expiresInSeconds = env.JWT_EXPIRES_IN_SECONDS;
    const { sessionVersion } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    const token = app.jwt.sign(
      { sub: userId, sv: sessionVersion },
      { expiresIn: expiresInSeconds }
    );
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      domain: env.COOKIE_DOMAIN,
      maxAge: expiresInSeconds,
    });
    return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
  });

  app.decorate('clearSession', (reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/', domain: env.COOKIE_DOMAIN });
  });
}
