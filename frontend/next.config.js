const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Disable turbopack completely (causes module resolution issues in Docker)
  // turbopack: {}, // Disabled for production builds
  
  // Enable standalone output for Docker optimization (smaller image size)
  output: 'standalone',
  
  transpilePackages: ["libsodium-wrappers"],
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
    // Optimize images in production
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    unoptimized: false,
  },
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    poweredByHeader: false,
    compress: true,
  }),
};

module.exports = withBundleAnalyzer(nextConfig);

