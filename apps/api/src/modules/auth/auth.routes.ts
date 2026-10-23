import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ChangePasswordInputSchema,
  ConnectedProviderSchema,
  LastFmAuthCallbackQuerySchema,
  LoginInputSchema,
  RegisterInputSchema,
  SpotifyAuthCallbackQuerySchema,
  UpdateProfileSchema,
  type AuthSessionResponse,
  type ChangePasswordResponse,
  type MeResponse,
  type OAuthUrlResponse,
} from '@openmusic/shared';
import { requireAuth, requestSessionToken } from '../../lib/auth';
import { toApiError } from '../../lib/error-handler';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../../lib/errors';
import type { SessionSockets } from '../now-playing/now-playing.gateway';
import type { NowPlayingService } from '../now-playing/now-playing.service';
import type { AuthService } from './auth.service';

const OAUTH_STATE_COOKIE = 'om_oauth_state';

export interface AuthRoutesOptions {
  /** Max register/login/password attempts per IP per minute. */
  rateLimitMax: number;
  cookieSecure: boolean;
  /** Ghost Mode must also clear the live presence and notify followers, not just set the flag. */
  presence: Pick<NowPlayingService, 'setGhostMode'>;
  /** Closes live sockets when a session ends (logout) or is revoked (password change). */
  sockets: SessionSockets;
  /** Web app origin: OAuth callbacks redirect the browser back there. */
  webAppUrl: string;
  /** ADR-013 hooks: last-seen tracking and an immediate first read after (re)linking. */
  activity?: {
    seen(userId: string): Promise<void>;
    providerLinked(userId: string): Promise<void>;
  };
}

type OAuthProvider = 'spotify' | 'lastfm';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createAuthRoutes(
  authService: AuthService,
  options: AuthRoutesOptions
): FastifyPluginAsync {
  return async (fastify) => {
    const rateLimited = {
      config: { rateLimit: { max: options.rateLimitMax, timeWindow: '1 minute' } },
    };

    async function withSession(
      reply: FastifyReply,
      session: MeResponse
    ): Promise<AuthSessionResponse> {
      return { ...session, ...(await fastify.issueSession(reply, session.user.id)) };
    }

    /** Linking never fails because the poller could not be woken up. */
    async function notifyLinked(userId: string): Promise<void> {
      await options.activity?.providerLinked(userId).catch((err: unknown) => {
        fastify.log.warn({ err, userId }, 'Failed to schedule the first now-playing read');
      });
    }

    // -- Local accounts ------------------------------------------------------

    fastify.post('/register', rateLimited, async (request, reply) => {
      const input = RegisterInputSchema.parse(request.body);
      const session = await authService.register(input);
      return reply.status(201).send(await withSession(reply, session));
    });

    fastify.post('/login', rateLimited, async (request, reply) => {
      const input = LoginInputSchema.parse(request.body);
      const session = await authService.login(input);
      return reply.send(await withSession(reply, session));
    });

    fastify.post('/logout', { preHandler: fastify.optionalAuth }, async (request, reply) => {
      const token = requestSessionToken(request);
      fastify.clearSession(reply);
      // Close the sockets opened with this session (other devices stay connected).
      if (request.auth && token) await options.sockets.revoke(request.auth.userId, 'LOGOUT', token);
      return reply.status(204).send();
    });

    fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
      const { userId } = requireAuth(request);
      // Every app start calls /me: it marks the user as seen (the poller keeps reading them).
      options.activity?.seen(userId).catch((err: unknown) => {
        fastify.log.warn({ err, userId }, 'Failed to record last seen');
      });
      return authService.getUserSessionData(userId);
    });

    fastify.patch('/me', { preHandler: fastify.authenticate }, async (request) => {
      const { isGhostMode, ...profile } = UpdateProfileSchema.parse(request.body);
      const { userId } = requireAuth(request);
      if (isGhostMode !== undefined) await options.presence.setGhostMode(userId, isGhostMode);
      return authService.updateProfile(userId, profile);
    });

    fastify.post(
      '/password',
      { ...rateLimited, preHandler: fastify.authenticate },
      async (request, reply) => {
        const input = ChangePasswordInputSchema.parse(request.body);
        const { userId } = requireAuth(request);
        // Revokes every session; this device gets a fresh cookie (web) and token (native) and
        // stays signed in.
        await authService.changePassword(userId, input);
        const session: ChangePasswordResponse = await fastify.issueSession(reply, userId);
        // Every open socket carries the old session version: close them all.
        await options.sockets.revoke(userId, 'PASSWORD_CHANGED');
        return reply.send(session);
      }
    );

    // -- Optional linked accounts -------------------------------------------

    /**
     * OAuth CSRF protection: a random `state` is bound to the browser with a short-lived httpOnly
     * cookie when the consent URL is requested, and must come back unchanged on the callback.
     * Without it an attacker could make a signed-in victim link the attacker's provider account.
     */
    function issueOAuthState(reply: FastifyReply): string {
      const state = randomBytes(24).toString('base64url');
      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: options.cookieSecure,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 10 * 60,
      });
      return state;
    }

    function consumeOAuthState(
      request: FastifyRequest,
      reply: FastifyReply,
      state: string | undefined
    ): void {
      const expected = request.cookies[OAUTH_STATE_COOKIE];
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });
      if (!state || !expected || !safeEqual(state, expected)) {
        throw new ForbiddenError('Stato OAuth non valido o scaduto: riprova il collegamento');
      }
    }

    fastify.get('/spotify/login', async (_request, reply) => {
      const body: OAuthUrlResponse = {
        url: authService.getSpotifyAuthUrl(issueOAuthState(reply)),
      };
      return reply.send(body);
    });

    /**
     * The provider sends the BROWSER here, so the outcome is a redirect back to the web app, never
     * a JSON body: `<WEB_APP_URL><path>?oauth=<provider>&status=success|error[&code=<ApiErrorCode>]`.
     * Only fixed paths on the configured origin are used (no open redirect).
     */
    async function oauthRedirect(
      reply: FastifyReply,
      provider: OAuthProvider,
      paths: { success: string; error: string },
      action: () => Promise<void>
    ): Promise<FastifyReply> {
      const params = new URLSearchParams({ oauth: provider });
      let path = paths.success;
      try {
        await action();
        params.set('status', 'success');
      } catch (err) {
        const body = toApiError(err);
        if (body.statusCode >= 500) fastify.log.error({ err, provider }, 'OAuth callback failed');
        params.set('status', 'error');
        params.set('code', body.code);
        path = paths.error;
      }
      return reply.redirect(`${options.webAppUrl}${path}?${params.toString()}`, 302);
    }

    fastify.get(
      '/spotify/callback',
      { preHandler: fastify.optionalAuth },
      async (request, reply) => {
        // Signed in = linking from the settings page; anonymous = "sign in with Spotify".
        const linking = request.auth !== null;
        return oauthRedirect(
          reply,
          'spotify',
          { success: linking ? '/settings' : '/', error: linking ? '/settings' : '/auth' },
          async () => {
            const query = SpotifyAuthCallbackQuerySchema.parse(request.query);
            consumeOAuthState(request, reply, query.state);
            if (query.error || !query.code) {
              throw new BadRequestError('Autorizzazione Spotify negata o codice mancante');
            }
            const session = await authService.handleSpotifyCallback(
              query.code,
              request.auth?.userId
            );
            await withSession(reply, session);
            await notifyLinked(session.user.id);
          }
        );
      }
    );

    fastify.get('/lastfm/login', async (_request, reply) => {
      const body: OAuthUrlResponse = { url: authService.getLastFmAuthUrl(issueOAuthState(reply)) };
      return reply.send(body);
    });

    fastify.get(
      '/lastfm/callback',
      { preHandler: fastify.optionalAuth },
      async (request, reply) => {
        return oauthRedirect(
          reply,
          'lastfm',
          { success: '/settings', error: '/settings' },
          async () => {
            const query = LastFmAuthCallbackQuerySchema.parse(request.query);
            consumeOAuthState(request, reply, query.state);
            if (!request.auth) throw new UnauthorizedError();
            if (!query.token) throw new BadRequestError('Token Last.fm mancante');
            await authService.handleLastFmCallback(query.token, request.auth.userId);
            await notifyLinked(request.auth.userId);
          }
        );
      }
    );

    fastify.delete(
      '/providers/:provider',
      { preHandler: fastify.authenticate },
      async (request) => {
        const { provider } = z.object({ provider: ConnectedProviderSchema }).parse(request.params);
        return authService.disconnectProvider(requireAuth(request).userId, provider);
      }
    );
  };
}
