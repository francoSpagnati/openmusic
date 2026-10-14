import { buildApp } from './app';
import { env } from './config/env';

async function main() {
  const { app, redis } = await buildApp();

  try {
    // Connetti a Redis
    await redis.connect().catch((err) => {
      app.log.warn(`Redis connection failed (running in offline/disconnected mode): ${err.message}`);
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
}

main();
