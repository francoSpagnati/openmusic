/**
 * Finds catalog rows that are probably two different albums (or two editions) merged into one
 * release, a leftover of the pre-ADR-012 title-only dedupe.
 *
 *   npm run catalog:audit                 # report only (exit code 1 when something is found)
 *   npm run catalog:audit -- --json       # machine-readable report
 *   npm run catalog:audit -- --split      # reset the rows that are safe to reset (see below)
 *   npm run catalog:audit -- --repair-group-keys  # recompute ReleaseGroup.matchKey (run once
 *                                                 # after the editions migration)
 *
 * --split never guesses which tracks belong to which album: it resets a suspicious row to the
 * single edition of one provider id (dropping the other ids, barcode, tracklist) so the API
 * re-imports it cleanly on next open. Rows with reviews, posts, scrobbles, playlist entries or
 * chat messages are refused and only reported: they need a manual decision.
 */
import { prisma } from '@openmusic/db';
import {
  auditCatalog,
  repairGroupMatchKeys,
  splitRelease,
  type AuditFinding,
} from '../src/modules/catalog/catalog-audit';

function describe(f: AuditFinding): string {
  const ids = Object.entries(f.providerIds)
    .filter(([, id]) => id)
    .map(([provider, id]) => `${provider}:${id}`)
    .join(' ');
  return [
    `${f.artistName} — ${f.title}  (${f.releaseId})`,
    `    reasons: ${f.reasons.join(', ')}`,
    `    tracks: ${f.trackRows} rows / provider count ${f.trackCount ?? 'n/a'}; ids: ${ids || 'none'}`,
    `    user references: ${f.userReferences}; ${f.splittable ? 'can be reset with --split' : 'manual review needed'}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const split = process.argv.includes('--split');
  const repairKeys = process.argv.includes('--repair-group-keys');
  const staleKeys = await repairGroupMatchKeys(prisma, repairKeys);
  if (staleKeys > 0 && !json) {
    console.log(
      repairKeys
        ? `catalog:audit: recomputed the match key of ${staleKeys} release group(s).`
        : `catalog:audit: ${staleKeys} release group(s) have a stale match key: run with --repair-group-keys.`
    );
  }
  const findings = await auditCatalog(prisma);

  if (json) {
    console.log(JSON.stringify(findings, null, 2));
  } else if (findings.length === 0) {
    console.log('catalog:audit: no suspicious releases found.');
  } else {
    console.log(`catalog:audit: ${findings.length} suspicious release(s)\n`);
    for (const finding of findings) console.log(`${describe(finding)}\n`);
  }

  if (split) {
    for (const finding of findings) {
      const outcome = await splitRelease(prisma, finding.releaseId);
      console.log(
        `${outcome.padEnd(24)} ${finding.artistName} — ${finding.title} (${finding.releaseId})`
      );
    }
  }
  process.exitCode = findings.length > 0 && !split ? 1 : 0;
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
