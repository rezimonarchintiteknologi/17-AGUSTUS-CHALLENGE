const API_URL = process.env.API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/health', destination: `${API_URL}/health` },
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
