import type { FastifyPluginAsync } from 'fastify';
import {
  SpotifyAuthCallbackQuerySchema,
  LastFmAuthCallbackQuerySchema,
} from '@openmusic/shared';
import type { AuthService } from './auth.service';

export function createAuthRoutes(authService: AuthService): FastifyPluginAsync {
  return async (fastify) => {
    // 1. Endpoint di reindirizzamento Spotify OAuth
    fastify.get('/spotify/login', async (request, reply) => {
      const { state } = request.query as { state?: string };
      const url = authService.getSpotifyAuthUrl(state);
      return reply.send({ url });
    });

    // 2. Callback Spotify OAuth
    fastify.get('/spotify/callback', async (request, reply) => {
      const query = SpotifyAuthCallbackQuerySchema.parse(request.query);

      if (query.error || !query.code) {
        return reply.status(400).send({
          error: query.error ?? 'Missing authorization code',
        });
      }

      // Se presente un token JWT valido nell'header o cookie, usiamo l'ID utente corrente
      let currentUserId: string | undefined;
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        currentUserId = decoded.userId;
      } catch {
        // Nessun utente loggato: login o registrazione diretta
      }

      const { user, connectedAccounts } = await authService.handleSpotifyCallback(
        query.code,
        currentUserId
      );

      const token = fastify.jwt.sign({ userId: user.id });

      return reply.send({
        token,
        user,
        connectedAccounts,
      });
    });

    // 3. Endpoint di reindirizzamento Last.fm
    fastify.get('/lastfm/login', async (_request, reply) => {
      const url = authService.getLastFmAuthUrl();
      return reply.send({ url });
    });

    // 4. Callback Last.fm
    fastify.get('/lastfm/callback', async (request, reply) => {
      const query = LastFmAuthCallbackQuerySchema.parse(request.query);

      if (!query.token) {
        return reply.status(400).send({ error: 'Missing token parameter' });
      }

      // Last.fm richiede un utente loggato a cui associare l'account
      const decoded = await request.jwtVerify<{ userId: string }>();
      const { user, connectedAccounts } = await authService.handleLastFmCallback(
        query.token,
        decoded.userId
      );

      return reply.send({
        user,
        connectedAccounts,
      });
    });

    // 5. Verifica sessione utente corrente
    fastify.get('/me', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const session = await authService.getUserSessionData(decoded.userId);
        return reply.send(session);
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });
  };
}
