const API_URL = process.env.API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default proxy timeout for rewrites is 30s — /api/metrics genuinely takes 70-80s
  // (live full-table aggregation over 15M rows, see DATABASE_NOTES.md), so the rewrite
  // was aborting with a 502 before the API could ever respond.
  experimental: {
    proxyTimeout: 120000,
  },
  async rewrites() {
    return [
      { source: '/health', destination: `${API_URL}/health` },
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
