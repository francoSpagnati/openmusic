import { aggregateScore } from '../../api/src/modules/reviews/score';
import { E2E_EMAIL_DOMAIN, E2E_EMAIL_PREFIX } from './account';

/**
 * Removes the accounts the smoke test registered (and, by cascade, their reviews, messages and
 * notifications), then recomputes the audience score of every release they reviewed, so repeated
 * local runs leave the seeded dev database as they found it. Set E2E_KEEP_DATA=1 to skip.
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_DATA === '1') return;
  // The generated client from packages/db (its schema); imported directly because the
  // @openmusic/db entry point is TypeScript source that Playwright does not transpile.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: E2E_EMAIL_PREFIX, endsWith: E2E_EMAIL_DOMAIN } },
      select: { id: true },
    });
    if (users.length === 0) return;
    const userIds = users.map((u) => u.id);

    const touched = await prisma.review.findMany({
      where: { userId: { in: userIds }, releaseId: { not: null } },
      select: { releaseId: true },
      distinct: ['releaseId'],
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    for (const { releaseId } of touched) {
      if (!releaseId) continue;
      const reviews = await prisma.review.findMany({
        where: { releaseId, isCritic: false },
        select: { rating: true, isVerifiedListen: true },
      });
      const score = aggregateScore(reviews);
      await prisma.release.update({
        where: { id: releaseId },
        data: {
          audienceAvg: score.avg,
          audienceFreshPct: score.freshPct,
          audienceCount: score.count,
        },
      });
    }
    console.log(`[e2e] removed ${userIds.length} test account(s)`);
  } finally {
    await prisma.$disconnect();
  }
}
