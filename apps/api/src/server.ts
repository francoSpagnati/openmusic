import { prisma } from '@openmusic/db';
import { buildApp } from './app';
import { env } from './config/env';

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

  // ADR-013: background Spotify/Last.fm reading. Never started by buildApp (tests, scripts).
  if (env.NOW_PLAYING_POLLER_ENABLED) {
    if (redis.status === 'ready') ctx.nowPlayingPoller.start();
    else app.log.warn('Now-playing poller not started: Redis is not connected');
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
