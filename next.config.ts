import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

// Polyfill File + Blob for Node 18 (required by undici/Payload CMS)
if (typeof globalThis.File === 'undefined') {
  const { File, Blob } = require('node:buffer')
  globalThis.File = File
  if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob
}

const nextConfig: NextConfig = {
  // standalone is required for Docker (DO) but breaks multipart form-data on Vercel.
  // Vercel sets VERCEL=1 at build time — skip standalone for Vercel deployments.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  // ENABLE_HARNESS=1 includes `*.harness.tsx` files in the route table for the
  // AI gen test harness (Phase 03). Default build excludes them — production /
  // staging never sees the harness route. See plans/260414-0837-ai-gen-test-harness/.
  pageExtensions:
    process.env.ENABLE_HARNESS === '1'
      ? ['tsx', 'ts', 'jsx', 'js', 'harness.tsx']
      : ['tsx', 'ts', 'jsx', 'js'],
  serverExternalPackages: ['undici', 'pg', 'isomorphic-dompurify', 'web-push', 'googleapis'],
  // Bundle .harness-out/{matrix,report}.json into the serverless function for
  // /test-harness routes — files are generated at build time when ENABLE_HARNESS=1
  // (see vercel.json buildCommand) but Next.js auto-trace can't see fs.readFileSync
  // dynamic paths, so we have to include explicitly.
  outputFileTracingIncludes: {
    '/test-harness': ['./.harness-out/**/*.json'],
    '/test-harness/admin': ['./.harness-out/**/*.json'],
    '/test-harness/[fixtureId]': ['./.harness-out/**/*.json'],
    '/test-harness/[fixtureId]/[slug]': ['./.harness-out/**/*.json'],
    '/test-harness/ai/[category]': ['./.harness-out/**/*.json'],
    '/test-harness/ai/[category]/[slug]': ['./.harness-out/**/*.json'],
  },
  eslint: {
    // CI runs lint separately — skip during build to save ~1 min
    ignoreDuringBuilds: true,
  },
  typescript: {
    // CI runs typecheck separately — skip during build to save ~30s
    ignoreBuildErrors: true,
  },
  experimental: {
    reactCompiler: false,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'minio',
      },
    ],
  },
}

export default withPayload(nextConfig)
