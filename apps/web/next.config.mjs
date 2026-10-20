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
