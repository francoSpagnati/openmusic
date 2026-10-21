import type { Prisma, PrismaClient } from '@openmusic/db';
import type { Page, Post, PostLikeState, PostSaveState } from '@openmusic/shared';
import type { CreatePostInputSchema } from '@openmusic/shared';
import type { z } from 'zod';
import type { AuthContext } from '../../lib/auth';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { followedAmong } from '../../lib/follows';
import {
  nextCursorOf,
  toCatalogTrack,
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../../lib/mappers';
import type { NotificationsService } from '../notifications/notifications.service';

type CreatePostData = z.output<typeof CreatePostInputSchema>;

interface PageQuery {
  cursor?: string;
  limit: number;
}

/** A sentinel that matches no row, so `{ some: { userId: NOBODY } }` is always empty. */
const NOBODY = '00000000-0000-0000-0000-000000000000';

function postInclude(viewerId: string | null) {
  const viewer = viewerId ?? NOBODY;
  return {
    author: { select: USER_SUMMARY_SELECT },
    release: {
      include: {
        tracks: {
          where: { previewUrl: { not: null } },
          orderBy: { title: 'asc' },
          take: 1,
          include: { release: { select: { coverUrl: true } } },
        },
      },
    },
    track: { include: { release: { select: { coverUrl: true } } } },
    likes: { where: { userId: viewer }, select: { userId: true } },
    saves: { where: { userId: viewer }, select: { userId: true } },
    _count: { select: { likes: true } },
  } satisfies Prisma.PostInclude;
}

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

export class FeedService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: NotificationsService
  ) {}

  async create(authorId: string, input: CreatePostData): Promise<Post> {
    let releaseId = input.releaseId;
    if (input.trackId) {
      const track = await this.prisma.track.findUnique({
        where: { id: input.trackId },
        select: { releaseId: true },
      });
      if (!track) throw new NotFoundError('Brano non trovato');
      if (releaseId && releaseId !== track.releaseId) {
        throw new BadRequestError('Il brano non appartiene al disco indicato');
      }
      releaseId = track.releaseId;
    }
    if (releaseId) {
      const exists = await this.prisma.release.count({ where: { id: releaseId } });
      if (exists === 0) throw new NotFoundError('Disco non trovato');
    }

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: input.content,
        releaseId,
        trackId: input.trackId,
        rating: input.rating,
        vibeTags: input.vibeTags,
      },
      include: postInclude(authorId),
    });
    return (await this.mapPosts([post], authorId))[0] as Post;
  }

  async get(viewerId: string | null, postId: string): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: postInclude(viewerId),
    });
    if (!post) throw new NotFoundError('Post non trovato');
    return (await this.mapPosts([post], viewerId))[0] as Post;
  }

  async remove(auth: AuthContext, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundError('Post non trovato');
    const isModerator = auth.role === 'MODERATOR' || auth.role === 'ADMIN';
    if (post.authorId !== auth.userId && !isModerator) {
      throw new ForbiddenError('Puoi eliminare solo i tuoi post');
    }
    await this.prisma.post.delete({ where: { id: postId } });
  }

  /** Home feed: `following` = people the viewer follows plus the viewer; `global` = everyone. */
  async feed(
    viewerId: string | null,
    scope: 'following' | 'global',
    page: PageQuery
  ): Promise<Page<Post>> {
    let where: Prisma.PostWhereInput = {};
    if (scope === 'following' && viewerId) {
      where = {
        OR: [
          { authorId: viewerId },
          { author: { followedBy: { some: { followerId: viewerId } } } },
        ],
      };
    }
    return this.page(viewerId, where, page);
  }

  async byUser(viewerId: string | null, userId: string, page: PageQuery): Promise<Page<Post>> {
    return this.page(viewerId, { authorId: userId }, page);
  }

  async saved(viewerId: string, page: PageQuery): Promise<Page<Post>> {
    return this.page(viewerId, { saves: { some: { userId: viewerId } } }, page);
  }

  async like(userId: string, postId: string): Promise<PostLikeState> {
    const post = await this.requirePost(postId);
    const created = await this.prisma.postLike.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await this.notifications.notify({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
    return this.likeState(userId, postId);
  }

  async unlike(userId: string, postId: string): Promise<PostLikeState> {
    const post = await this.requirePost(postId);
    const deleted = await this.prisma.postLike.deleteMany({ where: { postId, userId } });
    if (deleted.count > 0) {
      await this.notifications.retract({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
    return this.likeState(userId, postId);
  }

  async setSaved(userId: string, postId: string, saved: boolean): Promise<PostSaveState> {
    await this.requirePost(postId);
    if (saved) {
      await this.prisma.postSave.createMany({ data: [{ postId, userId }], skipDuplicates: true });
    } else {
      await this.prisma.postSave.deleteMany({ where: { postId, userId } });
    }
    return { postId, isSavedByMe: saved };
  }

  private async likeState(userId: string, postId: string): Promise<PostLikeState> {
    const [mine, likeCount] = await Promise.all([
      this.prisma.postLike.count({ where: { postId, userId } }),
      this.prisma.postLike.count({ where: { postId } }),
    ]);
    return { postId, isLikedByMe: mine > 0, likeCount };
  }

  private async requirePost(postId: string): Promise<{ authorId: string }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundError('Post non trovato');
    return post;
  }

  private async page(
    viewerId: string | null,
    where: Prisma.PostWhereInput,
    page: PageQuery
  ): Promise<Page<Post>> {
    const rows = await this.prisma.post.findMany({
      where,
      include: postInclude(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const { items, nextCursor } = nextCursorOf(rows, page.limit);
    return { items: await this.mapPosts(items, viewerId), nextCursor };
  }

  private async mapPosts(rows: PostRow[], viewerId: string | null): Promise<Post[]> {
    const followed = await followedAmong(
      this.prisma,
      viewerId,
      rows.map((r) => r.authorId)
    );
    return rows.map((p) => {
      const previewTrack = p.release?.tracks[0];
      return {
        id: p.id,
        author: toUserSummary(p.author, followed),
        content: p.content,
        release: p.release
          ? {
              id: p.release.id,
              title: p.release.title,
              artistName: p.release.artistName,
              coverUrl: p.release.coverUrl,
              dominantColor: p.release.dominantColor,
              releaseDate: p.release.releaseDate?.toISOString() ?? null,
              previewTrack: previewTrack ? toCatalogTrack(previewTrack) : null,
            }
          : null,
        track: p.track ? toCatalogTrack(p.track) : null,
        rating: p.rating,
        vibeTags: p.vibeTags,
        likeCount: p._count.likes,
        isLikedByMe: p.likes.length > 0,
        isSavedByMe: p.saves.length > 0,
        createdAt: p.createdAt.toISOString(),
      };
    });
  }
}
