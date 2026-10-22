// Shared helpers that derive the isolated test database / Redis URLs.
// Used by scripts/prepare-test-db.mjs and by the Vitest configs, so every entry point agrees.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Loads the root .env (if present) without overriding variables already set (e.g. in CI). */
export function loadRootEnv() {
  const file = path.join(repoRoot, '.env');
  if (existsSync(file) && typeof process.loadEnvFile === 'function') {
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
}

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/openmusic?schema=public';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/** TEST_DATABASE_URL, or DATABASE_URL with the database name swapped to `openmusic_test`. */
export function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
  url.pathname = '/openmusic_test';
  return url.toString();
}

/** TEST_REDIS_URL, or REDIS_URL pointed at logical DB 15 so tests never flush dev data. */
export function testRedisUrl() {
  if (process.env.TEST_REDIS_URL) return process.env.TEST_REDIS_URL;
  const url = new URL(process.env.REDIS_URL || DEFAULT_REDIS_URL);
  url.pathname = '/15';
  return url.toString();
}

export function testEnv() {
  loadRootEnv();
  return {
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    REDIS_URL: testRedisUrl(),
    JWT_SECRET: 'openmusic-test-secret-not-for-production-use',
    // Pinned (not read from .env) so assertions on CORS and OAuth redirects stay stable.
    CORS_ORIGIN: 'http://localhost:3000',
    WEB_APP_URL: 'http://localhost:3000',
  };
}
