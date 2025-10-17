/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable Node.js runtime for middleware
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;