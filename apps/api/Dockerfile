# syntax=docker/dockerfile:1.7
#
# OpenMusic API (Fastify + Socket.io + now-playing poller). Build from the REPOSITORY ROOT:
#
#   docker build -f apps/api/Dockerfile -t openmusic-api .
#
# Runs like render.yaml's `npm run start:api` (prisma migrate deploy, then the TypeScript sources
# through tsx, ADR-014 §6), without the two npm wrapper processes (~100 MB of RAM on a small box).
# Self-hosting guide: docs/08_SELF_HOSTING.md, decision: ADR-016.
#
# Alpine: its base already ships libssl.so.3, which Prisma's engine needs (Debian slim images do
# not, and would need apt at build time). Prisma looks for it only in /lib on Alpine (it lives in
# /usr/lib), so the `base` stage links it there; then `prisma generate` and the client at runtime
# both pick the right engine (linux-musl-openssl-3.0.x) instead of falling back to OpenSSL 1.1.

ARG NODE_IMAGE=node:22.23.4-alpine3.24
ARG TURBO_VERSION=2.11.8

FROM ${NODE_IMAGE} AS base
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3

# 1. Only the workspaces the API needs (api, db, shared) and a lockfile trimmed to them: the
#    mobile app's Expo/React Native tree and the web app's Next.js never get installed.
FROM ${NODE_IMAGE} AS prune
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN npx --yes turbo@${TURBO_VERSION} prune @openmusic/api --docker --out-dir /out

# 2. Production dependencies (tsx and the prisma CLI are runtime dependencies) + Prisma client.
FROM base AS deps
WORKDIR /app
ENV NODE_ENV=production \
  CHECKPOINT_DISABLE=1
COPY --from=prune /out/json/ ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev --no-audit --no-fund
COPY --from=prune /out/full/ ./
COPY tsconfig.base.json ./
RUN cd packages/db && ../../node_modules/.bin/prisma generate \
  # Tests, fixtures and tooling configs are not needed at runtime.
  && cd /app && rm -rf apps/api/test apps/api/vitest.config.mts apps/api/tsconfig.test.json \
    packages/shared/test packages/shared/vitest.config.mts packages/shared/tsconfig.test.json

# 3. Runtime: the app as root-owned read-only files, running as the unprivileged `node` user.
FROM base AS runtime
# npm/corepack/yarn are not used at runtime: drop them (smaller image, fewer CVEs to track).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=4000 \
  CHECKPOINT_DISABLE=1
COPY --from=deps /app ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# = `npm run start:api`: apply pending migrations, then start the API (node is PID 1 and handles
# SIGTERM itself: graceful shutdown in src/server.ts).
CMD ["sh", "-c", "cd /app/packages/db && /app/node_modules/.bin/prisma migrate deploy && cd /app/apps/api && exec node --import tsx src/server.ts"]
