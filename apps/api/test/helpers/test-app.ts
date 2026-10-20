import { prisma } from '@openmusic/db';
import { buildApp, type AppContext } from '../../src/app';

/**
 * Builds the real Fastify app (routes, services, Socket.io) against the local
 * `openmusic_test` Postgres database and Redis logical DB 15 (see vitest.config.ts).
 */
export async function createTestApp(): Promise<AppContext> {
  assertTestEnvironment();
  const ctx = await buildApp();
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
