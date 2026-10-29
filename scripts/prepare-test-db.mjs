#!/usr/bin/env node
// Creates (if missing) and resets the `openmusic_test` database by replaying all Prisma
// migrations from scratch. Never touches the development database.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { repoRoot, testEnv } from './test-env.mjs';

const env = { ...process.env, ...testEnv() };
const dbName = new URL(env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  console.error(`Refusing to reset "${dbName}": test database names must end with "_test".`);
  process.exit(1);
}

// The Prisma CLI runs under this same node: spawning `npx` needs a shell on Windows (npx.cmd).
const dbDir = path.join(repoRoot, 'packages/db');
const prismaCli = createRequire(path.join(dbDir, 'package.json')).resolve('prisma/build/index.js');
const args = ['migrate', 'reset', '--force', '--skip-seed', '--skip-generate'];
execFileSync(process.execPath, [prismaCli, ...args], {
  cwd: dbDir,
  env,
  stdio: process.env.CI ? 'inherit' : 'pipe',
});
console.log(`Test database "${dbName}" migrated and empty.`);
