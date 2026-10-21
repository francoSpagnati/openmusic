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
  type MeResponse,
  type OAuthUrlResponse,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import { BadRequestError, ForbiddenError } from '../../lib/errors';
import type { NowPlayingService } from '../now-playing/now-playing.service';
import type { AuthService } from './auth.service';

const OAUTH_STATE_COOKIE = 'om_oauth_state';

export interface AuthRoutesOptions {
  /** Max register/login/password attempts per IP per minute. */
  rateLimitMax: number;
  cookieSecure: boolean;
  /** Ghost Mode must also clear the live presence and notify followers, not just set the flag. */
  presence: Pick<NowPlayingService, 'setGhostMode'>;
}

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

    fastify.post('/logout', async (_request, reply) => {
      fastify.clearSession(reply);
      return reply.status(204).send();
    });

    fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
      return authService.getUserSessionData(requireAuth(request).userId);
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
        // Revokes every other session; this device gets a fresh cookie and stays signed in.
        await authService.changePassword(userId, input);
        await fastify.issueSession(reply, userId);
        return reply.status(204).send();
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

    fastify.get(
      '/spotify/callback',
      { preHandler: fastify.optionalAuth },
      async (request, reply) => {
        const query = SpotifyAuthCallbackQuerySchema.parse(request.query);
        consumeOAuthState(request, reply, query.state);
        if (query.error || !query.code) {
          throw new BadRequestError('Autorizzazione Spotify negata o codice mancante');
        }

        const session = await authService.handleSpotifyCallback(query.code, request.auth?.userId);
        return reply.send(await withSession(reply, session));
      }
    );

    fastify.get('/lastfm/login', async (_request, reply) => {
      const body: OAuthUrlResponse = { url: authService.getLastFmAuthUrl(issueOAuthState(reply)) };
      return reply.send(body);
    });

    fastify.get(
      '/lastfm/callback',
      { preHandler: fastify.authenticate },
      async (request, reply) => {
        const query = LastFmAuthCallbackQuerySchema.parse(request.query);
        consumeOAuthState(request, reply, query.state);
        if (!query.token) throw new BadRequestError('Token Last.fm mancante');
        return authService.handleLastFmCallback(query.token, requireAuth(request).userId);
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
