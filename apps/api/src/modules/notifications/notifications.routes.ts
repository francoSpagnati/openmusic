import type { FastifyPluginAsync } from 'fastify';
import {
  MarkNotificationsReadInputSchema,
  NotificationsQuerySchema,
  type UnreadCount,
} from '@openmusic/shared';
import { requireAuth } from '../../lib/auth';
import type { NotificationsService } from './notifications.service';
import type { NotificationPresenceService } from './notification-presence.service';

export function createNotificationsRoutes(
  notifications: NotificationsService,
  presence: NotificationPresenceService
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', async (request) => {
      const query = NotificationsQuerySchema.parse(request.query);
      return notifications.list(requireAuth(request).userId, query);
    });

    fastify.get('/unread-count', async (request) => {
      const body: UnreadCount = {
        count: await notifications.unreadCount(requireAuth(request).userId),
      };
      return body;
    });

    fastify.post('/read', async (request) => {
      const { ids } = MarkNotificationsReadInputSchema.parse(request.body ?? {});
      const updated = await notifications.markRead(requireAuth(request).userId, ids);
      return { updated };
    });

    // ADR-004: payload for the persistent OS notification / live activity.
    fastify.get('/presence-summary', async (request) => {
      return presence.getPresenceSummary(requireAuth(request).userId);
    });
  };
}
