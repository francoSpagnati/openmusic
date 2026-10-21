import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

// The monorepo keeps a single .env at the root; load it so NEXT_PUBLIC_API_URL reaches the web app.
nextEnv.loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@openmusic/shared'],
  // Lint runs as its own CI step (`npm run lint`); don't run it twice during `next build`.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
