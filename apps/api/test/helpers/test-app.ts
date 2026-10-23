import { prisma } from '@openmusic/db';
import { buildApp, type AppContext, type BuildAppOptions } from '../../src/app';

/**
 * Builds the real Fastify app (routes, services, Socket.io) against the local
 * `openmusic_test` Postgres database and Redis logical DB 15 (see vitest.config.ts).
 */
export async function createTestApp(options: BuildAppOptions = {}): Promise<AppContext> {
  assertTestEnvironment();
  // Many suites register/login repeatedly from the same IP; only rate-limit.test.ts lowers this.
  const ctx = await buildApp({
    authRateLimitMax: 10_000,
    ...options,
    // A suite that injects catalog fixtures wants the external catalog ON, whatever the shell
    // exported (CATALOG_EXTERNAL_ENABLED=false from a dev .env would silently disable the
    // fixtures). Without fixtures buildApp already forces it OFF in tests. An explicit option wins.
    catalogExternalEnabled:
      options.catalogExternalEnabled ?? (options.catalogFetch ? true : undefined),
  });
  await ctx.redis.connect();
  await ctx.app.ready();
  return ctx;
}

export async function closeTestApp(ctx: AppContext): Promise<void> {
  ctx.io.close();
  await ctx.app.close();
  if (ctx.redis.status === 'ready') await ctx.redis.quit();
  await prisma.$disconnect();
}

/** Empties every application table and the test Redis DB. Call in `beforeEach`/`beforeAll`. */
export async function resetTestState(ctx?: AppContext): Promise<void> {
  assertTestEnvironment();
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  if (ctx && ctx.redis.status === 'ready') await ctx.redis.flushdb();
}

function assertTestEnvironment(): void {
  const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (process.env.NODE_ENV !== 'test' || !dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against non-test database "${dbName}"`);
  }
}
