import { loadWebEnv } from './src/lib/env';

import type { NextConfig } from 'next';

const { API_INTERNAL_URL } = loadWebEnv();

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
  experimental: {
    middlewareClientMaxBodySize: 32 * 1024 * 1024,
  },
};

export default nextConfig;
