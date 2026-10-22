import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { IMAGE_REMOTE_PATTERNS } from './image-hosts.mjs';

// The monorepo keeps a single .env at the root; load it so NEXT_PUBLIC_API_URL reaches the web app.
nextEnv.loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@openmusic/shared'],
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
