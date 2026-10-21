import type { PrismaClient } from '@openmusic/db';

/** Which of `candidateIds` the viewer follows. Empty for anonymous viewers. */
export async function followedAmong(
  prisma: PrismaClient,
  viewerId: string | null,
  candidateIds: readonly string[]
): Promise<Set<string>> {
  if (!viewerId || candidateIds.length === 0) return new Set();
  const rows = await prisma.follows.findMany({
    where: { followerId: viewerId, followingId: { in: [...new Set(candidateIds)] } },
    select: { followingId: true },
  });
  return new Set(rows.map((r) => r.followingId));
}

/** Ids of the users who follow `userId` (the audience of their presence updates). */
export async function followerIdsOf(prisma: PrismaClient, userId: string): Promise<string[]> {
  const rows = await prisma.follows.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });
  return rows.map((r) => r.followerId);
}
