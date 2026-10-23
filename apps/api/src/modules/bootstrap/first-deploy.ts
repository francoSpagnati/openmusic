import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@openmusic/db';
import {
  CuratedFileSchema,
  type CuratedAlbum,
  type CuratedImportResult,
} from '../catalog/curated-import';

/**
 * First-deploy data for an online instance (docs/07_DEPLOY.md, ADR-014).
 *
 * Free hosting has no shell to run `npm run db:seed` / `catalog:import` by hand, so the API does
 * it on start when SEED_ON_START=true, at most once per database: every task is recorded in the
 * `SystemMarker` table and skipped on later starts (also after a cold start of a sleeping
 * instance). A lease keeps two instances (old and new during a deploy) from running a task
 * together; a task interrupted midway is retried once its lease expires. Both tasks are
 * idempotent anyway (upserts / imports keyed by external ids).
 *
 * - `demo-seed:v1` (only with DEMO_PASSWORD): the dev seed's users, reviews, posts and chats,
 *   every account with DEMO_PASSWORD. Never run without an explicit password.
 * - `curated-catalog:<hash of curated-albums.json>`: the curated real albums from Deezer/iTunes.
 *   Editing the file changes the key, so new albums are imported on the next deploy.
 */

export const DEMO_SEED_MARKER = 'demo-seed:v1';
export const CURATED_MARKER_PREFIX = 'curated-catalog:';
export const DEFAULT_CURATED_FILE = path.resolve(__dirname, '../../../data/curated-albums.json');

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export interface FirstDeployLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

export interface FirstDeployDeps {
  prisma: PrismaClient;
  logger: FirstDeployLogger;
  /** Writes the demo community with this password (packages/db `seedDemoData`). */
  seedDemo: (password: string) => Promise<unknown>;
  /** Throws when the external catalog (Deezer) is unreachable. */
  probeCatalog: () => Promise<void>;
  importAlbums: (albums: readonly CuratedAlbum[]) => Promise<CuratedImportResult[]>;
}

export interface FirstDeployOptions {
  demoPassword?: string;
  catalogExternalEnabled: boolean;
  curatedFile?: string;
  leaseMs?: number;
  now?: () => Date;
}

export type TaskOutcome = 'done' | 'skipped' | 'busy' | 'failed' | 'disabled';

export interface FirstDeployReport {
  demo: TaskOutcome;
  catalog: TaskOutcome;
}

type Claim = 'claimed' | 'done' | 'busy';

async function claim(
  prisma: PrismaClient,
  key: string,
  leaseMs: number,
  now: Date
): Promise<Claim> {
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const existing = await prisma.systemMarker.findUnique({ where: { key } });
  if (existing?.completedAt) return 'done';
  if (!existing) {
    try {
      await prisma.systemMarker.create({ data: { key, leaseUntil } });
      return 'claimed';
    } catch {
      return 'busy'; // another instance created it first
    }
  }
  const { count } = await prisma.systemMarker.updateMany({
    where: { key, completedAt: null, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseUntil },
  });
  return count === 1 ? 'claimed' : 'busy';
}

async function complete(
  prisma: PrismaClient,
  key: string,
  details: Record<string, unknown>,
  now: Date
): Promise<void> {
  await prisma.systemMarker.update({
    where: { key },
    data: { completedAt: now, leaseUntil: null, details: details as object },
  });
}

async function releaseLease(prisma: PrismaClient, key: string): Promise<void> {
  await prisma.systemMarker.update({ where: { key }, data: { leaseUntil: null } }).catch(() => {
    // Best effort: the lease expires by itself.
  });
}

export function curatedMarkerKey(fileContents: string): string {
  return `${CURATED_MARKER_PREFIX}${createHash('sha256').update(fileContents).digest('hex').slice(0, 12)}`;
}

export async function runFirstDeployTasks(
  deps: FirstDeployDeps,
  options: FirstDeployOptions
): Promise<FirstDeployReport> {
  const { prisma, logger } = deps;
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const now = options.now ?? (() => new Date());
  const report: FirstDeployReport = { demo: 'disabled', catalog: 'disabled' };

  // 1. Demo community (before the catalog: the import then upgrades the seeded albums in place).
  if (options.demoPassword) {
    const state = await claim(prisma, DEMO_SEED_MARKER, leaseMs, now());
    if (state === 'claimed') {
      try {
        const counts = await deps.seedDemo(options.demoPassword);
        await complete(prisma, DEMO_SEED_MARKER, { counts }, now());
        // The seed writes placeholder covers: import the real ones again over them.
        await prisma.systemMarker.deleteMany({
          where: { key: { startsWith: CURATED_MARKER_PREFIX } },
        });
        report.demo = 'done';
        logger.info({ counts }, '[first-deploy] demo community created');
      } catch (err) {
        await releaseLease(prisma, DEMO_SEED_MARKER);
        report.demo = 'failed';
        logger.warn({ err }, '[first-deploy] demo seed failed (retried on next start)');
      }
    } else {
      report.demo = state === 'done' ? 'skipped' : 'busy';
    }
  }

  // 2. Curated real albums.
  if (!options.catalogExternalEnabled) {
    logger.info({}, '[first-deploy] CATALOG_EXTERNAL_ENABLED=false: curated import skipped');
    return report;
  }
  const file = options.curatedFile ?? DEFAULT_CURATED_FILE;
  const contents = readFileSync(file, 'utf8');
  const key = curatedMarkerKey(contents);
  const state = await claim(prisma, key, leaseMs, now());
  if (state !== 'claimed') {
    report.catalog = state === 'done' ? 'skipped' : 'busy';
    return report;
  }
  try {
    await deps.probeCatalog();
  } catch (err) {
    await releaseLease(prisma, key);
    report.catalog = 'failed';
    logger.warn({ err }, '[first-deploy] Deezer unreachable: curated import retried on next start');
    return report;
  }
  try {
    const { albums } = CuratedFileSchema.parse(JSON.parse(contents));
    logger.info({ albums: albums.length }, '[first-deploy] importing curated albums');
    const results = await deps.importAlbums(albums);
    const count = (status: CuratedImportResult['status']) =>
      results.filter((r) => r.status === status).length;
    const summary = {
      imported: count('imported'),
      notFound: count('not-found'),
      failed: count('failed'),
      failures: results
        .filter((r) => r.status === 'failed')
        .map((r) => `${r.entry.artist} - ${r.entry.title}: ${r.error ?? 'error'}`),
    };
    if (summary.imported === 0) throw new Error(`nothing imported (${summary.failed} failed)`);
    // Partial failures are recorded, not retried on every cold start.
    await complete(prisma, key, summary, now());
    report.catalog = 'done';
    logger.info(summary, '[first-deploy] curated albums imported');
  } catch (err) {
    await releaseLease(prisma, key);
    report.catalog = 'failed';
    logger.warn({ err }, '[first-deploy] curated import failed (retried on next start)');
  }
  return report;
}
