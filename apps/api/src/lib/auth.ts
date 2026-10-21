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
  /** Token expiry (ms since epoch), null when the token has no `exp`. */
  expiresAt: number | null;
}

/** Like `resolveSessionToken`, keeping the claims long-lived connections need to re-check. */
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
  const auth = await loadPrincipal(prisma, payload);
  if (!auth) return null;
  return {
    auth,
    sessionVersion: payload.sv ?? 0,
    expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : null,
  };
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
  payload: SessionTokenPayload
): Promise<AuthContext | null> {
  if (typeof payload.sub !== 'string') return null;
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
