import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { IMAGE_REMOTE_PATTERNS } from './image-hosts.mjs';

const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The monorepo keeps a single .env at the root; load it so NEXT_PUBLIC_API_URL reaches the web app.
nextEnv.loadEnvConfig(MONOREPO_ROOT);

// apps/web/Dockerfile builds with NEXT_OUTPUT=standalone: a self-contained server.js with only the
// traced node_modules (docs/08_SELF_HOSTING.md, ADR-016). Render and local dev keep `next start`.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(standalone ? { output: 'standalone', outputFileTracingRoot: MONOREPO_ROOT } : {}),
  transpilePackages: ['@openmusic/shared'],
  // Local dev runs on http://127.0.0.1:3000 (Spotify rejects `localhost` redirect URIs, and the
  // web app must share the API's host for the session cookie). Next 16 only trusts `localhost`
  // for dev resources (HMR websocket, /_next/*): allow the loopback IP as well.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    // Only the catalog CDNs and seed hosts (see image-hosts.mjs): never an open image proxy.
    remotePatterns: IMAGE_REMOTE_PATTERNS.map((pattern) => ({ ...pattern })),
    formats: ['image/avif', 'image/webp'],
    // Covers are immutable per URL (a new cover gets a new URL): cache optimized copies a day.
    minimumCacheTTL: 86_400,
    // Thumbnails (24-96 px at 1x/2x) up to the hero cover; device sizes stay the defaults.
    imageSizes: [24, 32, 48, 64, 96, 128, 192, 256, 384],
  },
};

export default nextConfig;
