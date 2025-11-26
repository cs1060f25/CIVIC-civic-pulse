import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable minification entirely to avoid WebpackError constructor issue
  // This is a known bug in Next.js 15.3.3 with webpack minification
  experimental: {
    optimizePackageImports: [],
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      // Completely disable minification
      config.optimization = {
        ...config.optimization,
        minimize: false,
        minimizer: [],
      };
    }
    return config;
  },
  /* config options here */
};

export default nextConfig;
