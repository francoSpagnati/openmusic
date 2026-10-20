import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from '../../../scripts/test-env.mjs';

/** Recreates the `openmusic_test` schema from the Prisma migrations once per test run. */
export default function setup(): void {
  execFileSync(process.execPath, [path.join(repoRoot, 'scripts/prepare-test-db.mjs')], {
    stdio: 'inherit',
  });
}
