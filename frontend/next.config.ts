import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Disable turbopack in production for stability
  ...(process.env.NODE_ENV === 'development' && { turbopack: {} }),
  
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

export default nextConfig;
