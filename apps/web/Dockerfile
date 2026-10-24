# syntax=docker/dockerfile:1.7
#
# OpenMusic web app (Next.js 16, with the same-origin /api proxy route). Build from the
# REPOSITORY ROOT:
#
#   docker build -f apps/web/Dockerfile -t openmusic-web .
#
# `output: 'standalone'` (enabled by NEXT_OUTPUT=standalone, see next.config.mjs): the image holds
# only server.js, the traced node_modules and the static assets, not the monorepo's dependencies.
# API_ORIGIN and PROXY_SECRET are read at RUNTIME by the proxy route: one image fits every deploy.
# Self-hosting guide: docs/08_SELF_HOSTING.md, decision: ADR-016.

ARG NODE_IMAGE=node:22.23.4-alpine3.24
ARG TURBO_VERSION=2.11.8

# 1. Only the workspaces the web app needs (web, shared) and a lockfile trimmed to them.
FROM ${NODE_IMAGE} AS prune
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN npx --yes turbo@${TURBO_VERSION} prune @openmusic/web --docker --out-dir /out

# 2. Build (needs the devDependencies: TypeScript, Tailwind, PostCSS).
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
  CHECKPOINT_DISABLE=1
COPY --from=prune /out/json/ ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --no-audit --no-fund
COPY --from=prune /out/full/ ./
COPY tsconfig.base.json ./
# The Playwright suite is not part of the app, and its teardown imports the API workspace (not in
# this pruned tree): leave it out of `next build`'s type check.
RUN rm -rf apps/web/e2e apps/web/playwright.config.ts
# Cap the V8 heap so a build on a small home server (8 GB shared with other services) cannot
# grow without bound; override with --build-arg WEB_BUILD_MAX_OLD_SPACE_MB=... if needed.
ARG WEB_BUILD_MAX_OLD_SPACE_MB=2048
RUN NEXT_OUTPUT=standalone NODE_ENV=production \
  NODE_OPTIONS="--max-old-space-size=${WEB_BUILD_MAX_OLD_SPACE_MB}" \
  npm --workspace=@openmusic/web run build \
  # sharp ships glibc and wasm builds next to the musl one this image uses (~25 MB): drop them.
  && rm -rf apps/web/.next/standalone/node_modules/@img/sharp-linux-* \
    apps/web/.next/standalone/node_modules/@img/sharp-libvips-linux-* \
    apps/web/.next/standalone/node_modules/@img/sharp-wasm32

# 3. Runtime: standalone server + static assets, running as the unprivileged `node` user.
FROM ${NODE_IMAGE} AS runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3000
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# The image optimizer writes its cache here: the only writable path the server needs.
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
