import { dirname } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const rootDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Required for Docker standalone builds (Dockerfile copies from .next/standalone)
  output: 'standalone',
  turbopack: {
    root: rootDir,
  },
  images: {
    // Serve optimized images in modern formats
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days
    minimumCacheTTL: 2592000,
    // Device breakpoints for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        // MinIO local development
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        // MinIO — match any port on localhost/IP (dev & prod)
        protocol: 'http',
        hostname: '*.localhost',
      },
      {
        // Production MinIO / S3-compatible storage
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        // Production MinIO custom domain
        protocol: 'https',
        hostname: '*.swastik.health',
      },
    ],
  },
};

export default nextConfig;
