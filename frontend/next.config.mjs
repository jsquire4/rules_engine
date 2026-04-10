/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Allow importing .wasm files (needed for @cedar-policy/cedar-wasm)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.MANAGEMENT_INTERNAL_URL || 'http://management:8080'}/api/v1/:path*`,
      },
      {
        source: '/engine/:path*',
        destination: `${process.env.ENGINE_INTERNAL_URL || 'http://engine:3001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
