import type { Prisma, PrismaClient } from '@openmusic/db';
import type { FollowState, Page, UserSummary } from '@openmusic/shared';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import { followedAmong } from '../../lib/follows';
import { nextCursorOf, toUserSummary, USER_SUMMARY_SELECT } from '../../lib/mappers';
import type { NotificationsService } from '../notifications/notifications.service';

interface PageQuery {
  cursor?: string;
  limit: number;
}

export class UsersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService
  ) {}

  /** Case-insensitive prefix/substring search on username and display name. */
  search(viewerId: string | null, q: string, page: PageQuery): Promise<Page<UserSummary>> {
    return this.listUsers(viewerId, page, {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  /**
   * "Who to follow": the most-followed users the viewer does not follow yet (anonymous viewers
   * get the most-followed overall).
   */
  async suggestions(viewerId: string | null, limit: number): Promise<UserSummary[]> {
    const rows = await this.prisma.user.findMany({
      where: viewerId
        ? { id: { not: viewerId }, followedBy: { none: { followerId: viewerId } } }
        : {},
      select: USER_SUMMARY_SELECT,
      orderBy: [{ followedBy: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map((u) => toUserSummary(u, new Set()));
  }

  async followers(viewerId: string | null, userId: string, page: PageQuery) {
    await this.assertUserExists(userId);
    return this.listUsers(viewerId, page, { following: { some: { followingId: userId } } });
  }

  async following(viewerId: string | null, userId: string, page: PageQuery) {
    await this.assertUserExists(userId);
    return this.listUsers(viewerId, page, { followedBy: { some: { followerId: userId } } });
  }

  async follow(followerId: string, targetId: string): Promise<FollowState> {
    if (followerId === targetId) throw new BadRequestError('Non puoi seguire te stesso');
    await this.assertUserExists(targetId);
    const created = await this.prisma.follows.createMany({
      data: [{ followerId, followingId: targetId }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await this.notifications.notify({
        recipientId: targetId,
        actorId: followerId,
        type: 'FOLLOW',
      });
    }
    return this.followState(followerId, targetId);
  }

  async unfollow(followerId: string, targetId: string): Promise<FollowState> {
    await this.assertUserExists(targetId);
    const deleted = await this.prisma.follows.deleteMany({
      where: { followerId, followingId: targetId },
    });
    if (deleted.count > 0) {
      await this.notifications.retract({
        recipientId: targetId,
        actorId: followerId,
        type: 'FOLLOW',
      });
    }
    return this.followState(followerId, targetId);
  }

  private async followState(viewerId: string, targetId: string): Promise<FollowState> {
    const [isFollowing, followersCount] = await Promise.all([
      this.prisma.follows.count({ where: { followerId: viewerId, followingId: targetId } }),
      this.prisma.follows.count({ where: { followingId: targetId } }),
    ]);
    return { userId: targetId, isFollowedByMe: isFollowing > 0, followersCount };
  }

  private async listUsers(
    viewerId: string | null,
    page: PageQuery,
    where: Prisma.UserWhereInput
  ): Promise<Page<UserSummary>> {
    const rows = await this.prisma.user.findMany({
      where,
      select: USER_SUMMARY_SELECT,
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const { items, nextCursor } = nextCursorOf(rows, page.limit);
    const followed = await followedAmong(
      this.prisma,
      viewerId,
      items.map((u) => u.id)
    );
    return { items: items.map((u) => toUserSummary(u, followed)), nextCursor };
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.count({ where: { id: userId } });
    if (exists === 0) throw new NotFoundError('Utente non trovato');
  }
}
