#!/usr/bin/env node
// Creates (if missing) and resets the `openmusic_test` database by replaying all Prisma
// migrations from scratch. Never touches the development database.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot, testEnv } from './test-env.mjs';

const env = { ...process.env, ...testEnv() };
const dbName = new URL(env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  console.error(`Refusing to reset "${dbName}": test database names must end with "_test".`);
  process.exit(1);
}

execFileSync('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'], {
  cwd: path.join(repoRoot, 'packages/db'),
  env,
  stdio: process.env.CI ? 'inherit' : 'pipe',
});
console.log(`Test database "${dbName}" migrated and empty.`);
