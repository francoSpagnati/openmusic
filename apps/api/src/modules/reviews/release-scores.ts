import type { PrismaClient } from '@openmusic/db';
import { aggregateScore } from './score';

/**
 * ADR-001/ADR-002 audience score: weighted mean and fresh share of non-critic reviews, where a
 * verified listen weighs 1.5x.
 */
export async function recalculateAudienceScore(
  prisma: PrismaClient,
  releaseId: string
): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { releaseId, isCritic: false },
    select: { rating: true, isVerifiedListen: true },
  });
  const score = aggregateScore(reviews);
  await prisma.release.update({
    where: { id: releaseId },
    data: { audienceAvg: score.avg, audienceFreshPct: score.freshPct, audienceCount: score.count },
  });
}

/** Critic score: unweighted, since accreditation (not scrobbles) is the trust signal. */
export async function recalculateCriticScore(
  prisma: PrismaClient,
  releaseId: string
): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { releaseId, isCritic: true },
    select: { rating: true, isVerifiedListen: true },
  });
  const score = aggregateScore(reviews, () => 1);
  await prisma.release.update({
    where: { id: releaseId },
    data: { criticAvg: score.avg, criticFreshPct: score.freshPct, criticCount: score.count },
  });
}

/** Both scores: a review can move between the two pools when its author's role changes. */
export async function recalculateReleaseScores(
  prisma: PrismaClient,
  releaseId: string
): Promise<void> {
  await recalculateAudienceScore(prisma, releaseId);
  await recalculateCriticScore(prisma, releaseId);
}
