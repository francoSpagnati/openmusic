/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@openmusic/shared'],
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
