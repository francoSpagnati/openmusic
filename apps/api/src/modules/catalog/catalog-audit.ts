import type { Prisma, PrismaClient } from '@openmusic/db';
import { releaseGroupMatchKey } from '@openmusic/shared';

/**
 * `npm run catalog:audit` (ADR-012). Before editions existed, the importer merged releases by
 * normalized title + artist only, so two different albums with the same title (Weezer's
 * self-titled records) or an original and its remaster could end up in ONE row with both
 * tracklists. This audit finds rows that look like that.
 */

export type AuditReason =
  /** Two or more tracks share the same disc + track number. */
  | 'duplicate-positions'
  /** The same song title appears more than once. */
  | 'duplicate-titles'
  /** More track rows than the provider's track count. */
  | 'more-tracks-than-provider-count';

export interface AuditFinding {
  releaseId: string;
  title: string;
  artistName: string;
  reasons: AuditReason[];
  trackRows: number;
  trackCount: number | null;
  providerIds: { deezer: string | null; itunes: string | null; musicbrainz: string | null };
  /** Reviews, posts, scrobbles, playlist entries, chat messages, videos pointing at it. */
  userReferences: number;
  /** True when `splitRelease` may reset it (no user content would move or be lost). */
  splittable: boolean;
}

interface CountRow {
  releaseId: string;
  n: bigint;
}

export async function auditCatalog(prisma: PrismaClient): Promise<AuditFinding[]> {
  const [positions, titles, overCount] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT "releaseId", COUNT(*) AS n FROM (
        SELECT "releaseId" FROM "Track"
        WHERE "trackNumber" IS NOT NULL
        GROUP BY "releaseId", COALESCE("discNumber", 1), "trackNumber"
        HAVING COUNT(*) > 1
      ) dup GROUP BY "releaseId"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT "releaseId", COUNT(*) AS n FROM (
        SELECT "releaseId" FROM "Track"
        WHERE "matchKey" IS NOT NULL
        GROUP BY "releaseId", "matchKey"
        HAVING COUNT(*) > 1
      ) dup GROUP BY "releaseId"`,
    prisma.$queryRaw<CountRow[]>`
      SELECT r."id" AS "releaseId", COUNT(t."id") AS n
      FROM "Release" r JOIN "Track" t ON t."releaseId" = r."id"
      WHERE r."trackCount" IS NOT NULL
      GROUP BY r."id", r."trackCount"
      HAVING COUNT(t."id") > r."trackCount"`,
  ]);

  const reasons = new Map<string, Set<AuditReason>>();
  const add = (rows: CountRow[], reason: AuditReason) => {
    for (const row of rows) {
      const set = reasons.get(row.releaseId) ?? new Set<AuditReason>();
      set.add(reason);
      reasons.set(row.releaseId, set);
    }
  };
  add(positions, 'duplicate-positions');
  add(titles, 'duplicate-titles');
  add(overCount, 'more-tracks-than-provider-count');
  if (reasons.size === 0) return [];

  const releases = await prisma.release.findMany({
    where: { id: { in: [...reasons.keys()] } },
    include: { _count: { select: { tracks: true } } },
    orderBy: [{ artistName: 'asc' }, { title: 'asc' }, { id: 'asc' }],
  });
  const findings: AuditFinding[] = [];
  for (const release of releases) {
    const userReferences = await countUserReferences(prisma, release.id);
    findings.push({
      releaseId: release.id,
      title: release.title,
      artistName: release.artistName,
      reasons: [...(reasons.get(release.id) ?? [])].sort(),
      trackRows: release._count.tracks,
      trackCount: release.trackCount,
      providerIds: {
        deezer: release.deezerId,
        itunes: release.itunesId,
        musicbrainz: release.musicbrainzId,
      },
      userReferences,
      splittable:
        userReferences === 0 &&
        Boolean(release.deezerId ?? release.itunesId ?? release.musicbrainzId),
    });
  }
  return findings;
}

async function countUserReferences(
  prisma: Prisma.TransactionClient,
  releaseId: string
): Promise<number> {
  const trackFilter = { track: { releaseId } };
  const counts = await Promise.all([
    prisma.review.count({ where: { OR: [{ releaseId }, trackFilter] } }),
    prisma.post.count({ where: { OR: [{ releaseId }, trackFilter] } }),
    prisma.scrobbleLog.count({ where: { OR: [{ releaseId }, trackFilter] } }),
    prisma.playlistTrack.count({ where: trackFilter }),
    prisma.chatMessage.count({ where: trackFilter }),
    prisma.musicVideoContent.count({ where: { releaseId } }),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

export type SplitOutcome = 'reset' | 'refused-user-content' | 'refused-no-provider-id' | 'missing';

/**
 * "Split" a wrongly merged row the only way that is safe offline: we cannot tell which track or
 * which provider id belongs to which album, so the row is RESET to a single edition — it keeps
 * one provider id (Deezer, else iTunes, else MusicBrainz), drops the others, its barcode,
 * MusicBrainz ids, group link and tracklist, and is marked as never synced. The next time it is
 * opened the API re-imports that one edition, and the dropped ids become their own editions when
 * resolved again (with the ADR-012 rules). Refused when any user content points at the row or
 * its tracks: that must be reviewed by hand.
 */
export async function splitRelease(prisma: PrismaClient, releaseId: string): Promise<SplitOutcome> {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id: releaseId } });
    if (!release) return 'missing';
    if (!(release.deezerId ?? release.itunesId ?? release.musicbrainzId)) {
      return 'refused-no-provider-id';
    }
    if ((await countUserReferences(tx, releaseId)) > 0) {
      return 'refused-user-content';
    }
    const keep = release.deezerId ? 'deezer' : release.itunesId ? 'itunes' : 'musicbrainz';
    await tx.track.deleteMany({ where: { releaseId } });
    await tx.release.update({
      where: { id: releaseId },
      data: {
        deezerId: keep === 'deezer' ? release.deezerId : null,
        itunesId: keep === 'itunes' ? release.itunesId : null,
        musicbrainzId: keep === 'musicbrainz' ? release.musicbrainzId : null,
        musicbrainzReleaseGroupId: null,
        releaseGroupId: null,
        upc: null,
        trackCount: null,
        releaseDate: null,
        editionLabel: null,
        metadataSyncedAt: null,
        enrichedAt: null,
      },
    });
    if (release.releaseGroupId) {
      await tx.releaseGroup.deleteMany({
        where: { id: release.releaseGroupId, releases: { none: {} } },
      });
    }
    return 'reset';
  });
}

/**
 * The editions migration (20261022090000) backfilled `ReleaseGroup.matchKey` from the release's
 * own `matchKey` (the older title+artist key, NULL on legacy rows), but new editions look groups
 * up by `releaseGroupMatchKey()`. Where the two differ ("Album - Deluxe Version", "(Reissue)",
 * legacy rows) the next edition of that album would open a duplicate group. This recomputes the
 * key of every group: from the MusicBrainz title for MusicBrainz groups, else from the oldest
 * edition's title. Idempotent; touches nothing but `ReleaseGroup.matchKey`. Returns the number of
 * groups whose key was stale (and, with `apply`, was fixed).
 */
export async function repairGroupMatchKeys(prisma: PrismaClient, apply: boolean): Promise<number> {
  const groups = await prisma.releaseGroup.findMany({
    select: {
      id: true,
      title: true,
      artistName: true,
      musicbrainzId: true,
      matchKey: true,
      releases: {
        select: { title: true },
        orderBy: [{ releaseDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        take: 1,
      },
    },
  });
  let stale = 0;
  for (const group of groups) {
    const title = group.musicbrainzId ? group.title : (group.releases[0]?.title ?? group.title);
    const key = releaseGroupMatchKey(title, group.artistName);
    if (key === group.matchKey) continue;
    stale++;
    if (apply) {
      await prisma.releaseGroup.update({ where: { id: group.id }, data: { matchKey: key } });
    }
  }
  return stale;
}
