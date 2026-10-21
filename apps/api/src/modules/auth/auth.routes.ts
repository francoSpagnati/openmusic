import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
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
import type { AuthService } from './auth.service';

const OAUTH_STATE_COOKIE = 'om_oauth_state';

export interface AuthRoutesOptions {
  /** Max register/login/password attempts per IP per minute. */
  rateLimitMax: number;
  cookieSecure: boolean;
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

    function withSession(reply: FastifyReply, session: MeResponse): AuthSessionResponse {
      return { ...session, ...fastify.issueSession(reply, session.user.id) };
    }

    // -- Local accounts ------------------------------------------------------

    fastify.post('/register', rateLimited, async (request, reply) => {
      const input = RegisterInputSchema.parse(request.body);
      const session = await authService.register(input);
      return reply.status(201).send(withSession(reply, session));
    });

    fastify.post('/login', rateLimited, async (request, reply) => {
      const input = LoginInputSchema.parse(request.body);
      const session = await authService.login(input);
      return reply.send(withSession(reply, session));
    });

    fastify.post('/logout', async (_request, reply) => {
      fastify.clearSession(reply);
      return reply.status(204).send();
    });

    fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
      return authService.getUserSessionData(requireAuth(request).userId);
    });

    fastify.patch('/me', { preHandler: fastify.authenticate }, async (request) => {
      const input = UpdateProfileSchema.parse(request.body);
      return authService.updateProfile(requireAuth(request).userId, input);
    });

    fastify.post(
      '/password',
      { ...rateLimited, preHandler: fastify.authenticate },
      async (request, reply) => {
        const input = ChangePasswordInputSchema.parse(request.body);
        await authService.changePassword(requireAuth(request).userId, input);
        return reply.status(204).send();
      }
    );

    // -- Optional linked accounts -------------------------------------------

    /**
     * Returns the Spotify consent URL. A random `state` is bound to the browser with a short-lived
     * httpOnly cookie and checked on callback (OAuth CSRF protection).
     */
    fastify.get('/spotify/login', async (_request, reply) => {
      const state = randomBytes(24).toString('base64url');
      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: options.cookieSecure,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 10 * 60,
      });
      const body: OAuthUrlResponse = { url: authService.getSpotifyAuthUrl(state) };
      return reply.send(body);
    });

    fastify.get(
      '/spotify/callback',
      { preHandler: fastify.optionalAuth },
      async (request, reply) => {
        const query = SpotifyAuthCallbackQuerySchema.parse(request.query);
        const expectedState = request.cookies[OAUTH_STATE_COOKIE];
        reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });

        if (!query.state || !expectedState || !safeEqual(query.state, expectedState)) {
          throw new ForbiddenError('Stato OAuth non valido o scaduto: riprova il collegamento');
        }
        if (query.error || !query.code) {
          throw new BadRequestError('Autorizzazione Spotify negata o codice mancante');
        }

        const session = await authService.handleSpotifyCallback(query.code, request.auth?.userId);
        return reply.send(withSession(reply, session));
      }
    );

    fastify.get('/lastfm/login', async () => {
      const body: OAuthUrlResponse = { url: authService.getLastFmAuthUrl() };
      return body;
    });

    fastify.get('/lastfm/callback', { preHandler: fastify.authenticate }, async (request) => {
      const query = LastFmAuthCallbackQuerySchema.parse(request.query);
      if (!query.token) throw new BadRequestError('Token Last.fm mancante');
      return authService.handleLastFmCallback(query.token, requireAuth(request).userId);
    });

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
