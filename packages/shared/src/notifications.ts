import { z } from 'zod';
import { CursorQuerySchema, pageSchema } from './common';

export const NotificationTypeSchema = z.enum([
  'FOLLOW',
  'POST_LIKE',
  'REVIEW_REACTION',
  'TRACK_LISTENED',
  'CRITIC_APPROVED',
]);

export const NotificationActorSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  /** Null only for system notifications (CRITIC_APPROVED). */
  actor: NotificationActorSchema.nullable(),
  /** POST_LIKE */
  post: z.object({ id: z.string().uuid(), excerpt: z.string() }).nullable(),
  /** REVIEW_REACTION */
  review: z
    .object({
      id: z.string().uuid(),
      releaseId: z.string().uuid().nullable(),
      releaseTitle: z.string().nullable(),
      artistName: z.string().nullable(),
    })
    .nullable(),
  /** TRACK_LISTENED: the track recommended in chat. */
  track: z.object({ id: z.string().uuid(), title: z.string(), artistName: z.string() }).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export const NotificationsQuerySchema = CursorQuerySchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const NotificationPageSchema = pageSchema(NotificationItemSchema);

/** `POST /api/notifications/read` — omit `ids` to mark everything as read. */
export const MarkNotificationsReadInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
});

export const UnreadCountSchema = z.object({ count: z.number().int().nonnegative() });

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationActor = z.infer<typeof NotificationActorSchema>;
export type NotificationItem = z.infer<typeof NotificationItemSchema>;
export type NotificationsQuery = z.input<typeof NotificationsQuerySchema>;
export type NotificationPage = z.infer<typeof NotificationPageSchema>;
export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadInputSchema>;
export type UnreadCount = z.infer<typeof UnreadCountSchema>;
