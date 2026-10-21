import { prisma } from '@openmusic/db';
import {
  FollowStateSchema,
  NotificationPageSchema,
  PostPageSchema,
  PostSchema,
  UserProfileDataSchema,
  UserSummaryPageSchema,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { createRelease, createTracks, signedInUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

describe('social graph, feed and notifications', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function notificationsOf(headers: { authorization: string }) {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/notifications', headers });
    expect(res.statusCode).toBe(200);
    return NotificationPageSchema.parse(res.json());
  }

  describe('follows', () => {
    it('follows idempotently, notifies once, and unfollows', async () => {
      const alice = await signedInUser(ctx, { username: 'alice' });
      const bob = await signedInUser(ctx, { username: 'bob' });

      for (let i = 0; i < 2; i++) {
        const res = await ctx.app.inject({
          method: 'PUT',
          url: `/api/users/${bob.user.id}/follow`,
          headers: alice.headers,
        });
        expect(res.statusCode).toBe(200);
        expect(FollowStateSchema.parse(res.json())).toEqual({
          userId: bob.user.id,
          isFollowedByMe: true,
          followersCount: 1,
        });
      }

      const bobNotifications = await notificationsOf(bob.headers);
      expect(bobNotifications.items).toHaveLength(1);
      expect(bobNotifications.items[0]).toMatchObject({
        type: 'FOLLOW',
        actor: { id: alice.user.id, username: 'alice' },
        readAt: null,
      });

      const unfollow = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/users/${bob.user.id}/follow`,
        headers: alice.headers,
      });
      expect(FollowStateSchema.parse(unfollow.json()).isFollowedByMe).toBe(false);
      // The unread follow notification is retracted.
      expect((await notificationsOf(bob.headers)).items).toHaveLength(0);
    });

    it('rejects following yourself, unknown users, and anonymous callers', async () => {
      const alice = await signedInUser(ctx);
      const self = await ctx.app.inject({
        method: 'PUT',
        url: `/api/users/${alice.user.id}/follow`,
        headers: alice.headers,
      });
      expect(self.statusCode).toBe(400);

      const unknown = await ctx.app.inject({
        method: 'PUT',
        url: '/api/users/00000000-0000-4000-8000-000000000000/follow',
        headers: alice.headers,
      });
      expect(unknown.statusCode).toBe(404);

      const badId = await ctx.app.inject({
        method: 'PUT',
        url: '/api/users/not-a-uuid/follow',
        headers: alice.headers,
      });
      expect(badId.statusCode).toBe(400);

      const anonymous = await ctx.app.inject({
        method: 'PUT',
        url: `/api/users/${alice.user.id}/follow`,
      });
      expect(anonymous.statusCode).toBe(401);
    });

    it('lists followers/following and searches users with isFollowedByMe', async () => {
      const alice = await signedInUser(ctx, { username: 'alice' });
      const bob = await signedInUser(ctx, { username: 'bobby' });
      await signedInUser(ctx, { username: 'bobcat' });
      await prisma.follows.create({
        data: { followerId: alice.user.id, followingId: bob.user.id },
      });

      const search = await ctx.app.inject({
        method: 'GET',
        url: '/api/users/search?q=BOB&limit=1',
        headers: alice.headers,
      });
      const page1 = UserSummaryPageSchema.parse(search.json());
      expect(page1.items.map((u) => u.username)).toEqual(['bobby']);
      expect(page1.items[0]?.isFollowedByMe).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const search2 = await ctx.app.inject({
        method: 'GET',
        url: `/api/users/search?q=bob&limit=1&cursor=${page1.nextCursor ?? ''}`,
      });
      const page2 = UserSummaryPageSchema.parse(search2.json());
      expect(page2.items.map((u) => u.username)).toEqual(['bobcat']);
      expect(page2.nextCursor).toBeNull();

      const followers = await ctx.app.inject({
        method: 'GET',
        url: `/api/users/${bob.user.id}/followers`,
      });
      expect(UserSummaryPageSchema.parse(followers.json()).items.map((u) => u.id)).toEqual([
        alice.user.id,
      ]);

      const following = await ctx.app.inject({
        method: 'GET',
        url: `/api/users/${alice.user.id}/following`,
      });
      expect(UserSummaryPageSchema.parse(following.json()).items.map((u) => u.id)).toEqual([
        bob.user.id,
      ]);
    });

    it('public profiles expose social stats but never the email', async () => {
      const alice = await signedInUser(ctx, { username: 'alice' });
      const bob = await signedInUser(ctx, { username: 'bob' });
      await prisma.follows.create({
        data: { followerId: alice.user.id, followingId: bob.user.id },
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/profile/by-username/BOB',
        headers: alice.headers,
      });
      expect(res.statusCode).toBe(200);
      const profile = UserProfileDataSchema.parse(res.json());
      expect(profile.social).toEqual({
        followersCount: 1,
        followingCount: 0,
        postsCount: 0,
        isFollowedByMe: true,
        isMe: false,
      });
      expect(JSON.stringify(res.json())).not.toContain('@openmusic.test');

      const missing = await ctx.app.inject({ method: 'GET', url: '/api/profile/by-username/nope' });
      expect(missing.statusCode).toBe(404);
    });
  });

  describe('posts & feed', () => {
    it('creates a post with a release attachment and validates input', async () => {
      const alice = await signedInUser(ctx);
      const release = await createRelease('In Rainbows');
      const [track] = await createTracks(release.id, 1);
      if (!track) throw new Error('track not created');
      await prisma.track.update({
        where: { id: track.id },
        data: { previewUrl: 'https://cdn.example.com/preview.mp3' },
      });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/posts',
        headers: alice.headers,
        payload: { content: '  Disco della vita  ', releaseId: release.id, rating: 100 },
      });
      expect(res.statusCode).toBe(201);
      const post = PostSchema.parse(res.json());
      expect(post).toMatchObject({
        content: 'Disco della vita',
        rating: 100,
        likeCount: 0,
        isLikedByMe: false,
        release: { id: release.id, title: 'In Rainbows', previewTrack: { id: track.id } },
      });

      const ratingWithoutRelease = await ctx.app.inject({
        method: 'POST',
        url: '/api/posts',
        headers: alice.headers,
        payload: { content: 'x', rating: 80 },
      });
      expect(ratingWithoutRelease.statusCode).toBe(400);
      expect(ratingWithoutRelease.json().fieldErrors).toHaveProperty('rating');

      const unknownRelease = await ctx.app.inject({
        method: 'POST',
        url: '/api/posts',
        headers: alice.headers,
        payload: { content: 'x', releaseId: '00000000-0000-4000-8000-000000000000' },
      });
      expect(unknownRelease.statusCode).toBe(404);

      const anonymous = await ctx.app.inject({
        method: 'POST',
        url: '/api/posts',
        payload: { content: 'x' },
      });
      expect(anonymous.statusCode).toBe(401);
    });

    it('following feed shows followed authors and self; global shows everyone; paginates', async () => {
      const alice = await signedInUser(ctx);
      const bob = await signedInUser(ctx);
      const carol = await signedInUser(ctx);
      await prisma.follows.create({
        data: { followerId: alice.user.id, followingId: bob.user.id },
      });

      const t0 = Date.now();
      await prisma.post.createMany({
        data: [
          { authorId: alice.user.id, content: 'mine', createdAt: new Date(t0 - 3000) },
          { authorId: bob.user.id, content: 'bob', createdAt: new Date(t0 - 2000) },
          { authorId: carol.user.id, content: 'carol', createdAt: new Date(t0 - 1000) },
        ],
      });

      const following = await ctx.app.inject({
        method: 'GET',
        url: '/api/feed?limit=1',
        headers: alice.headers,
      });
      const page1 = PostPageSchema.parse(following.json());
      expect(page1.items.map((p) => p.content)).toEqual(['bob']);
      expect(page1.items[0]?.author.isFollowedByMe).toBe(true);

      const next = await ctx.app.inject({
        method: 'GET',
        url: `/api/feed?limit=1&cursor=${page1.nextCursor ?? ''}`,
        headers: alice.headers,
      });
      const page2 = PostPageSchema.parse(next.json());
      expect(page2.items.map((p) => p.content)).toEqual(['mine']);
      expect(page2.nextCursor).toBeNull();

      const global = await ctx.app.inject({ method: 'GET', url: '/api/feed?scope=global' });
      expect(PostPageSchema.parse(global.json()).items.map((p) => p.content)).toEqual([
        'carol',
        'bob',
        'mine',
      ]);

      // Anonymous visitors always get the global feed.
      const anonymous = await ctx.app.inject({ method: 'GET', url: '/api/feed' });
      expect(PostPageSchema.parse(anonymous.json()).items).toHaveLength(3);
    });

    it('likes notify the author once; unlike retracts; saves are private', async () => {
      const alice = await signedInUser(ctx);
      const bob = await signedInUser(ctx);
      const post = await prisma.post.create({ data: { authorId: alice.user.id, content: 'hi' } });

      const like = () =>
        ctx.app.inject({ method: 'PUT', url: `/api/posts/${post.id}/like`, headers: bob.headers });
      expect((await like()).json()).toEqual({ postId: post.id, isLikedByMe: true, likeCount: 1 });
      expect((await like()).json()).toMatchObject({ likeCount: 1 });

      const notifications = await notificationsOf(alice.headers);
      expect(notifications.items).toHaveLength(1);
      expect(notifications.items[0]).toMatchObject({ type: 'POST_LIKE', post: { id: post.id } });

      const unlike = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/posts/${post.id}/like`,
        headers: bob.headers,
      });
      expect(unlike.json()).toMatchObject({ isLikedByMe: false, likeCount: 0 });
      expect((await notificationsOf(alice.headers)).items).toHaveLength(0);

      await ctx.app.inject({
        method: 'PUT',
        url: `/api/posts/${post.id}/save`,
        headers: bob.headers,
      });
      const saved = await ctx.app.inject({
        method: 'GET',
        url: '/api/posts/saved',
        headers: bob.headers,
      });
      const savedPage = PostPageSchema.parse(saved.json());
      expect(savedPage.items.map((p) => p.id)).toEqual([post.id]);
      expect(savedPage.items[0]?.isSavedByMe).toBe(true);

      const missing = await ctx.app.inject({
        method: 'PUT',
        url: '/api/posts/00000000-0000-4000-8000-000000000000/like',
        headers: bob.headers,
      });
      expect(missing.statusCode).toBe(404);
    });

    it('only the author or a moderator can delete a post', async () => {
      const alice = await signedInUser(ctx);
      const bob = await signedInUser(ctx);
      const mod = await signedInUser(ctx, { role: 'MODERATOR' });
      const p1 = await prisma.post.create({ data: { authorId: alice.user.id, content: 'a' } });
      const p2 = await prisma.post.create({ data: { authorId: alice.user.id, content: 'b' } });

      const forbidden = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/posts/${p1.id}`,
        headers: bob.headers,
      });
      expect(forbidden.statusCode).toBe(403);

      const own = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/posts/${p1.id}`,
        headers: alice.headers,
      });
      expect(own.statusCode).toBe(204);

      const moderated = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/posts/${p2.id}`,
        headers: mod.headers,
      });
      expect(moderated.statusCode).toBe(204);
      expect(await prisma.post.count()).toBe(0);
    });
  });

  describe('notifications', () => {
    it('counts unread, marks selected or all as read, and is owner-scoped', async () => {
      const alice = await signedInUser(ctx);
      const bob = await signedInUser(ctx);
      const carol = await signedInUser(ctx);
      for (const follower of [bob, carol]) {
        await ctx.app.inject({
          method: 'PUT',
          url: `/api/users/${alice.user.id}/follow`,
          headers: follower.headers,
        });
      }

      const count = await ctx.app.inject({
        method: 'GET',
        url: '/api/notifications/unread-count',
        headers: alice.headers,
      });
      expect(count.json()).toEqual({ count: 2 });

      const list = await notificationsOf(alice.headers);
      const first = list.items[0];
      if (!first) throw new Error('expected a notification');

      // Bob cannot mark Alice's notifications.
      const foreign = await ctx.app.inject({
        method: 'POST',
        url: '/api/notifications/read',
        headers: bob.headers,
        payload: { ids: [first.id] },
      });
      expect(foreign.json()).toEqual({ updated: 0 });

      const one = await ctx.app.inject({
        method: 'POST',
        url: '/api/notifications/read',
        headers: alice.headers,
        payload: { ids: [first.id] },
      });
      expect(one.json()).toEqual({ updated: 1 });

      const unread = await ctx.app.inject({
        method: 'GET',
        url: '/api/notifications?unreadOnly=true',
        headers: alice.headers,
      });
      expect(NotificationPageSchema.parse(unread.json()).items).toHaveLength(1);

      const all = await ctx.app.inject({
        method: 'POST',
        url: '/api/notifications/read',
        headers: alice.headers,
      });
      expect(all.json()).toEqual({ updated: 1 });

      const anonymous = await ctx.app.inject({ method: 'GET', url: '/api/notifications' });
      expect(anonymous.statusCode).toBe(401);
    });
  });
});
