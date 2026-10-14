import type { FastifyPluginAsync } from 'fastify';
import type { NotificationPresenceService } from './notification-presence.service';

export function createNotificationPresenceRoutes(
  notificationService: NotificationPresenceService
): FastifyPluginAsync {
  return async (fastify) => {
    // Genera il payload per la notifica persistente (richiede token JWT)
    fastify.get('/presence-summary', async (request, reply) => {
      try {
        const decoded = await request.jwtVerify<{ userId: string }>();
        const summary = await notificationService.getPresenceSummary(decoded.userId);
        return reply.send(summary);
      } catch {
        return reply.status(401).send({ error: 'Non autorizzato' });
      }
    });
  };
}
