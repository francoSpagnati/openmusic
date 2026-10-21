import type { NotificationType, Prisma, PrismaClient } from '@openmusic/db';
import type { NotificationItem, Page } from '@openmusic/shared';
import { nextCursorOf } from '../../lib/mappers';
import type { RealtimeEmitter } from '../../lib/realtime';

const NOTIFICATION_INCLUDE = {
  actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  post: { select: { id: true, content: true } },
  review: {
    select: {
      id: true,
      releaseId: true,
      release: { select: { title: true, artistName: true } },
    },
  },
  chatMessage: {
    select: { track: { select: { id: true, title: true, artistName: true } } },
  },
} satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof NOTIFICATION_INCLUDE }>;

export interface NotificationTarget {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  postId?: string;
  reviewId?: string;
  chatMessageId?: string;
}

const EXCERPT_LENGTH = 120;

function toItem(n: NotificationRow): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    actor: n.actor,
    post: n.post
      ? {
          id: n.post.id,
          excerpt:
            n.post.content.length > EXCERPT_LENGTH
              ? `${n.post.content.slice(0, EXCERPT_LENGTH - 1)}…`
              : n.post.content,
        }
      : null,
    review: n.review
      ? {
          id: n.review.id,
          releaseId: n.review.releaseId,
          releaseTitle: n.review.release?.title ?? null,
          artistName: n.review.release?.artistName ?? null,
        }
      : null,
    track: n.chatMessage?.track ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export class NotificationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly realtime: RealtimeEmitter
  ) {}

  /** Persists a notification and pushes it live. Self-notifications are dropped. */
  async notify(target: NotificationTarget): Promise<NotificationItem | null> {
    if (target.actorId !== null && target.actorId === target.recipientId) return null;
    const row = await this.prisma.notification.create({
      data: {
        recipientId: target.recipientId,
        actorId: target.actorId,
        type: target.type,
        postId: target.postId,
        reviewId: target.reviewId,
        chatMessageId: target.chatMessageId,
      },
      include: NOTIFICATION_INCLUDE,
    });
    const item = toItem(row);
    this.realtime.toUsers([target.recipientId], 'notification:new', item);
    return item;
  }

  /** Removes unread notifications for an action that was undone (unlike, unfollow, ...). */
  async retract(target: NotificationTarget): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        recipientId: target.recipientId,
        actorId: target.actorId,
        type: target.type,
        postId: target.postId,
        reviewId: target.reviewId,
        readAt: null,
      },
    });
  }

  async list(
    userId: string,
    query: { cursor?: string; limit: number; unreadOnly: boolean }
  ): Promise<Page<NotificationItem>> {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: userId, ...(query.unreadOnly ? { readAt: null } : {}) },
      include: NOTIFICATION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = nextCursorOf(rows, query.limit);
    return { items: page.items.map(toItem), nextCursor: page.nextCursor };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { recipientId: userId, readAt: null } });
  }

  /** Marks the given notifications (or all when `ids` is omitted) as read. Owner-scoped. */
  async markRead(userId: string, ids?: string[]): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
