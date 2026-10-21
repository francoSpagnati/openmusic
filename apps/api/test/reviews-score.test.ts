import { prisma } from '@openmusic/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { createRelease, createUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

/** ADR-001 dual rating: audience aggregates recomputed on every review write. */
describe('ReviewsService audience score', () => {
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

  async function review(releaseId: string, rating: number, role: 'USER' | 'CRITIC' = 'USER') {
    const user = await createUser({ role });
    return ctx.reviewsService.createOrUpdateReview(user.id, { releaseId, rating, vibeTags: [] });
  }

  it('averages ratings on the 0.5-5.0 scale and computes the fresh percentage (>= 70)', async () => {
    const release = await createRelease();
    await review(release.id, 100);
    await review(release.id, 70);
    await review(release.id, 40);

    const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
    // (100 + 70 + 40) / 3 = 70 -> 3.5 stars; 2 of 3 ratings are >= 70 -> 67%
    expect(updated.audienceAvg).toBe(3.5);
    expect(updated.audienceFreshPct).toBe(67);
    expect(updated.audienceCount).toBe(3);
  });

  it('rounds the average to one decimal', async () => {
    const release = await createRelease();
    await review(release.id, 90);
    await review(release.id, 80);
    await review(release.id, 80);

    const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
    // 250 / 3 = 83.33 -> 4.1666 stars -> 4.2
    expect(updated.audienceAvg).toBe(4.2);
    expect(updated.audienceFreshPct).toBe(100);
  });

  it('excludes critic reviews from the audience score', async () => {
    const release = await createRelease();
    await review(release.id, 60);
    const criticReview = await review(release.id, 100, 'CRITIC');

    expect(criticReview.isCritic).toBe(true);
    const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
    expect(updated.audienceAvg).toBe(3);
    expect(updated.audienceFreshPct).toBe(0);
    expect(updated.audienceCount).toBe(1);
  });

  it('updates an existing review instead of duplicating it', async () => {
    const release = await createRelease();
    const user = await createUser();
    await ctx.reviewsService.createOrUpdateReview(user.id, {
      releaseId: release.id,
      rating: 30,
      vibeTags: [],
    });
    const second = await ctx.reviewsService.createOrUpdateReview(user.id, {
      releaseId: release.id,
      rating: 90,
      vibeTags: ['notturno'],
    });

    expect(second.rating).toBe(90);
    expect(await prisma.review.count({ where: { releaseId: release.id } })).toBe(1);
    const updated = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
    expect(updated.audienceAvg).toBe(4.5);
    expect(updated.audienceCount).toBe(1);
  });
});
