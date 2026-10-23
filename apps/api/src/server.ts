import { prisma } from '@openmusic/db';
import { seedDemoData } from '@openmusic/db/src/seed';
import { buildApp, type AppContext } from './app';
import { env } from './config/env';
import { runFirstDeployTasks } from './modules/bootstrap/first-deploy';
import { importCuratedAlbums } from './modules/catalog/curated-import';

/** SEED_ON_START: first-deploy data, once per database (docs/07_DEPLOY.md). Never blocks start. */
function startFirstDeployTasks(ctx: AppContext): void {
  const { app } = ctx;
  runFirstDeployTasks(
    {
      prisma,
      logger: app.log,
      seedDemo: (password) => seedDemoData(prisma, password),
      probeCatalog: async () => {
        await ctx.catalogProviders.deezer.searchArtists('Radiohead', 1);
      },
      importAlbums: (albums) =>
        importCuratedAlbums(
          {
            prisma,
            providers: ctx.catalogProviders,
            importer: ctx.catalogImportService,
            enrichment: ctx.catalogEnrichmentService,
          },
          albums,
          // MusicBrainz enrichment (1 req/s) runs later, when a release page is opened.
          { dryRun: false, enrich: false, onlyLocal: false }
        ),
    },
    { demoPassword: env.DEMO_PASSWORD, catalogExternalEnabled: env.CATALOG_EXTERNAL_ENABLED }
  )
    .then((report) => app.log.info({ report }, '[first-deploy] finished'))
    .catch((err: unknown) => app.log.error({ err }, '[first-deploy] failed'));
}

async function main() {
  const ctx = await buildApp();
  const { app, redis, io } = ctx;

  try {
    // Connetti a Redis
    await redis.connect().catch((err) => {
      app.log.warn(
        `Redis connection failed (running in offline/disconnected mode): ${err.message}`
      );
    });

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    app.log.info(`🚀 OpenMusic Backend API running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  if (env.SEED_ON_START) startFirstDeployTasks(ctx);

  // ADR-013: background Spotify/Last.fm reading. Never started by buildApp (tests, scripts).
  if (env.NOW_PLAYING_POLLER_ENABLED) {
    if (redis.status === 'ready') {
      ctx.nowPlayingPoller.start();
    } else {
      // ioredis keeps reconnecting: start as soon as Redis is back instead of never.
      app.log.warn('Now-playing poller waiting for Redis');
      redis.once('ready', () => ctx.nowPlayingPoller.start());
    }
  } else {
    app.log.info('Now-playing poller disabled (NOW_PLAYING_POLLER_ENABLED=false)');
  }

  // Graceful shutdown: finish in-flight polls (their leases are released), then close
  // sockets, HTTP, Redis and Postgres.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} received: shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    try {
      await ctx.nowPlayingPoller.stop();
      io.close();
      await app.close();
      if (redis.status === 'ready') await redis.quit();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}

main();
