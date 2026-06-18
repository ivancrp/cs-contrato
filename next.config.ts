import type { NextConfig } from 'next';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/health',
        destination: `${apiTarget}/health`,
      },
      {
        source: '/api/backend/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
