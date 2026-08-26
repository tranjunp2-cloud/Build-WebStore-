import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

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
  // Bundle runtime JSON files into serverless for /test-harness routes:
  //   1. .harness-out/*.json — matrix + rubric reports (built via vercel.json
  //      buildCommand when ENABLE_HARNESS=1)
  //   2. scripts/test-harness/rubric/*.json — rubric definition files loaded by
  //      scoreFixture() on every fixture render (loadRubric via fs.readFileSync)
  // Next.js auto-trace can't see fs.readFileSync dynamic paths → include explicitly.
  // Without #2, fixture routes throw ENOENT → 500 (admin page only uses the
  // pre-computed report, so it wasn't affected before).
  outputFileTracingIncludes: {
    '/test-harness': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    '/test-harness/admin': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    '/test-harness/[fixtureId]': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    '/test-harness/[fixtureId]/[slug]': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    '/test-harness/ai/[category]': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    '/test-harness/ai/[category]/[slug]': ['./.harness-out/**/*.json', './scripts/test-harness/rubric/*.json'],
    // nft can't trace dynamic fs.readFileSync paths — include crate-carton placeholder
    // for all product routes where getOrCreateCrateCartonIdAction is invoked as a server action
    '/products': ['./public/images/crate-carton.png'],
    '/products/new': ['./public/images/crate-carton.png'],
    '/products/[id]': ['./public/images/crate-carton.png'],
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
    serverActions: {
      bodySizeLimit: '50mb',
    },
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

const sentryWebpackOptions = {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    widenClientFileUpload: false,
    sourcemaps: {
        deleteSourcemapsAfterUpload: true,
    },
    tunnelRoute: '/sentry-tunnel',
    hideSourceMaps: true,
    webpack: {
        treeshake: { removeDebugLogging: true },
        automaticVercelMonitors: false,
    },
}

export default withSentryConfig(withPayload(nextConfig), sentryWebpackOptions)
