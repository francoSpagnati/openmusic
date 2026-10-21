import { prisma } from '@openmusic/db';
import {
  CriticAccreditationStatusSchema,
  GenreListSchema,
  PlaylistDetailsSchema,
  ReleasePageSchema,
  ReviewItemSchema,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { createRelease, createTracks, signedInUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

describe('roles, critics, reviews, playlists, catalog', () => {
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

  describe('critic accreditation (ADMIN verify)', () => {
    const request = { outletName: 'Rumore Bianco', portfolioUrl: 'https://example.com/portfolio' };

    it('keeps the role unchanged until an admin approves', async () => {
      const writer = await signedInUser(ctx);
      const accredit = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/accredit',
        headers: writer.headers,
        payload: request,
      });
      expect(accredit.statusCode).toBe(200);
      expect(CriticAccreditationStatusSchema.parse(accredit.json()).status).toBe('PENDING');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: writer.user.id } })).role).toBe(
        'USER'
      );

      // Not yet a critic: cannot publish critic reviews.
      const release = await createRelease();
      const publish = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/reviews',
        headers: writer.headers,
        payload: { releaseId: release.id, rating: 90, content: 'Un disco essenziale.' },
      });
      expect(publish.statusCode).toBe(403);
    });

    it('rejects /critic/verify and /critic/requests for non-admins', async () => {
      const writer = await signedInUser(ctx);
      const critic = await signedInUser(ctx, { role: 'CRITIC' });
      const moderator = await signedInUser(ctx, { role: 'MODERATOR' });

      for (const caller of [writer, critic, moderator]) {
        const verify = await ctx.app.inject({
          method: 'POST',
          url: '/api/critic/verify',
          headers: caller.headers,
          payload: { userId: writer.user.id, approve: true },
        });
        expect(verify.statusCode).toBe(403);
        expect(verify.json().code).toBe('FORBIDDEN');
      }

      const anonymous = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/verify',
        payload: { userId: writer.user.id, approve: true },
      });
      expect(anonymous.statusCode).toBe(401);

      const queue = await ctx.app.inject({
        method: 'GET',
        url: '/api/critic/requests',
        headers: writer.headers,
      });
      expect(queue.statusCode).toBe(403);
    });

    it('admin approval grants CRITIC, notifies, and enables critic reviews', async () => {
      const writer = await signedInUser(ctx);
      const admin = await signedInUser(ctx, { role: 'ADMIN' });
      await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/accredit',
        headers: writer.headers,
        payload: request,
      });

      const queue = await ctx.app.inject({
        method: 'GET',
        url: '/api/critic/requests',
        headers: admin.headers,
      });
      expect(queue.json()).toEqual([
        expect.objectContaining({ userId: writer.user.id, outletName: 'Rumore Bianco' }),
      ]);

      const verify = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/verify',
        headers: admin.headers,
        payload: { userId: writer.user.id, approve: true },
      });
      expect(verify.statusCode).toBe(200);
      expect(CriticAccreditationStatusSchema.parse(verify.json()).status).toBe('APPROVED');
      expect(
        await prisma.notification.count({
          where: { recipientId: writer.user.id, type: 'CRITIC_APPROVED' },
        })
      ).toBe(1);

      // The role is read from the DB per request: the old token now carries CRITIC rights.
      const release = await createRelease();
      const publish = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/reviews',
        headers: writer.headers,
        payload: { releaseId: release.id, rating: 90, content: 'Un disco essenziale.' },
      });
      expect(publish.statusCode).toBe(201);
      const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      expect(updated.criticAvg).toBe(4.5);
      expect(updated.criticCount).toBe(1);
    });

    it('admin rejection clears the request', async () => {
      const writer = await signedInUser(ctx);
      const admin = await signedInUser(ctx, { role: 'ADMIN' });
      await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/accredit',
        headers: writer.headers,
        payload: request,
      });
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/verify',
        headers: admin.headers,
        payload: { userId: writer.user.id, approve: false },
      });
      expect(CriticAccreditationStatusSchema.parse(res.json()).status).toBe('NONE');
    });
  });

  describe('videos', () => {
    const video = {
      title: 'Saggio su In Rainbows',
      creatorName: 'Rumore Bianco',
      videoUrl: 'https://example.com/v.mp4',
      durationSeconds: 600,
    };

    it('only critics and staff can publish video content', async () => {
      const user = await signedInUser(ctx);
      const critic = await signedInUser(ctx, { role: 'CRITIC' });

      const anonymous = await ctx.app.inject({
        method: 'POST',
        url: '/api/videos',
        payload: video,
      });
      expect(anonymous.statusCode).toBe(401);
      const forbidden = await ctx.app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: user.headers,
        payload: video,
      });
      expect(forbidden.statusCode).toBe(403);
      const ok = await ctx.app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: critic.headers,
        payload: video,
      });
      expect(ok.statusCode).toBe(201);
    });
  });

  describe('reviews', () => {
    it('weighs verified listens 1.5x in the audience score (ADR-002)', async () => {
      const release = await createRelease();
      const tracks = await createTracks(release.id, 4);
      const verified = await signedInUser(ctx);
      const casual = await signedInUser(ctx);
      for (const track of tracks.slice(0, 3)) {
        await prisma.scrobbleLog.create({
          data: { userId: verified.user.id, trackId: track.id, provider: 'SPOTIFY' },
        });
      }

      const v = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: verified.headers,
        payload: { releaseId: release.id, rating: 100 },
      });
      expect(ReviewItemSchema.parse(v.json()).isVerifiedListen).toBe(true);

      const c = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: casual.headers,
        payload: { releaseId: release.id, rating: 40 },
      });
      expect(ReviewItemSchema.parse(c.json()).isVerifiedListen).toBe(false);

      const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      // (1.5 * 100 + 1 * 40) / 2.5 = 76 -> 3.8 stars; fresh weight 1.5 / 2.5 = 60%
      expect(updated.audienceAvg).toBe(3.8);
      expect(updated.audienceFreshPct).toBe(60);
      expect(updated.audienceCount).toBe(2);
    });

    it('does not verify a release review with fewer than 3 distinct scrobbled tracks', async () => {
      const release = await createRelease();
      const tracks = await createTracks(release.id, 5);
      const user = await signedInUser(ctx);
      const first = tracks[0];
      if (!first) throw new Error('no tracks');
      for (let i = 0; i < 5; i++) {
        await prisma.scrobbleLog.create({
          data: { userId: user.user.id, trackId: first.id, provider: 'SPOTIFY' },
        });
      }
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: user.headers,
        payload: { releaseId: release.id, rating: 80 },
      });
      expect(ReviewItemSchema.parse(res.json()).isVerifiedListen).toBe(false);
    });

    it('requires a session and a target; reactions notify the author', async () => {
      const release = await createRelease();
      const author = await signedInUser(ctx);
      const reader = await signedInUser(ctx);

      const anonymous = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { releaseId: release.id, rating: 80 },
      });
      expect(anonymous.statusCode).toBe(401);

      const noTarget = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: author.headers,
        payload: { rating: 80 },
      });
      expect(noTarget.statusCode).toBe(400);

      const review = ReviewItemSchema.parse(
        (
          await ctx.app.inject({
            method: 'POST',
            url: '/api/reviews',
            headers: author.headers,
            payload: { releaseId: release.id, rating: 80, content: 'Bello' },
          })
        ).json()
      );

      const react = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews/reaction',
        headers: reader.headers,
        payload: { reviewId: review.id, type: 'WELL_WRITTEN' },
      });
      expect(react.json()).toEqual({ added: true, type: 'WELL_WRITTEN' });
      expect(
        await prisma.notification.count({
          where: { recipientId: author.user.id, type: 'REVIEW_REACTION' },
        })
      ).toBe(1);

      const list = await ctx.app.inject({
        method: 'GET',
        url: `/api/reviews/release/${release.id}`,
        headers: reader.headers,
      });
      const [item] = list.json<unknown[]>().map((r) => ReviewItemSchema.parse(r));
      expect(item?.reactions.WELL_WRITTEN).toBe(1);
      expect(item?.userReaction).toBe('WELL_WRITTEN');

      const missing = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews/reaction',
        headers: reader.headers,
        payload: { reviewId: '00000000-0000-4000-8000-000000000000', type: 'AGREE' },
      });
      expect(missing.statusCode).toBe(404);
    });
  });

  describe('playlists', () => {
    it('hides private playlists from everyone but the owner and blocks foreign edits', async () => {
      const owner = await signedInUser(ctx);
      const other = await signedInUser(ctx);
      const release = await createRelease();
      const [track] = await createTracks(release.id, 1);
      if (!track) throw new Error('no track');

      const created = PlaylistDetailsSchema.parse(
        (
          await ctx.app.inject({
            method: 'POST',
            url: '/api/playlists',
            headers: owner.headers,
            payload: { title: 'Notturni', isPublic: false },
          })
        ).json()
      );

      const asOwner = await ctx.app.inject({
        method: 'GET',
        url: `/api/playlists/${created.id}`,
        headers: owner.headers,
      });
      expect(asOwner.statusCode).toBe(200);
      for (const headers of [other.headers, {}]) {
        const res = await ctx.app.inject({
          method: 'GET',
          url: `/api/playlists/${created.id}`,
          headers,
        });
        expect(res.statusCode).toBe(404);
      }

      const listForOther = await ctx.app.inject({
        method: 'GET',
        url: `/api/playlists/user/${owner.user.id}`,
        headers: other.headers,
      });
      expect(listForOther.json()).toEqual([]);

      const foreignAdd = await ctx.app.inject({
        method: 'POST',
        url: '/api/playlists/track',
        headers: other.headers,
        payload: { playlistId: created.id, trackId: track.id, side: 'B' },
      });
      expect(foreignAdd.statusCode).toBe(403);

      const add = await ctx.app.inject({
        method: 'POST',
        url: '/api/playlists/track',
        headers: owner.headers,
        payload: { playlistId: created.id, trackId: track.id, side: 'B' },
      });
      expect(PlaylistDetailsSchema.parse(add.json()).sideBTracks).toHaveLength(1);
    });
  });

  describe('catalog', () => {
    it('browses releases by genre with pagination and lists genres', async () => {
      await createRelease('A', ['Shoegaze']);
      await createRelease('B', ['Shoegaze', 'Dream Pop']);
      await createRelease('C', ['Jazz']);

      const genres = GenreListSchema.parse(
        (await ctx.app.inject({ method: 'GET', url: '/api/catalog/genres' })).json()
      );
      expect(genres[0]).toEqual({ name: 'Shoegaze', releaseCount: 2 });

      const page1 = ReleasePageSchema.parse(
        (
          await ctx.app.inject({
            method: 'GET',
            url: '/api/catalog/releases?genre=shoegaze&limit=1',
          })
        ).json()
      );
      expect(page1.items).toHaveLength(1);
      const page2 = ReleasePageSchema.parse(
        (
          await ctx.app.inject({
            method: 'GET',
            url: `/api/catalog/releases?genre=shoegaze&limit=1&cursor=${page1.nextCursor ?? ''}`,
          })
        ).json()
      );
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();
      expect(new Set([...page1.items, ...page2.items].map((r) => r.title))).toEqual(
        new Set(['A', 'B'])
      );
    });

    it('returns 400 for malformed ids and 404 for unknown releases', async () => {
      expect(
        (await ctx.app.inject({ method: 'GET', url: '/api/catalog/releases/not-a-uuid' }))
          .statusCode
      ).toBe(400);
      expect(
        (
          await ctx.app.inject({
            method: 'GET',
            url: '/api/catalog/releases/00000000-0000-4000-8000-000000000000',
          })
        ).statusCode
      ).toBe(404);
    });
  });
});
