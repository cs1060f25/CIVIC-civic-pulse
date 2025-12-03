import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Exclude native modules from bundling - load from node_modules at runtime
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Ensure better-sqlite3 is treated as external
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }
    
    // Disable minification to avoid Next.js minifier bugs (e.g., false = '1' syntax error)
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
        minimizer: [],
      };
    }
    
    return config;
  },
  
  // Skip generating route handlers for static files to avoid minifier bugs
  experimental: {
    optimizePackageImports: [],
  },
  
  // Skip favicon route generation
  skipTrailingSlashRedirect: true,
  
  // Configure headers to allow Google OAuth popups
  // Using 'unsafe-none' is required for cross-origin OAuth popups (Google's domain)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
