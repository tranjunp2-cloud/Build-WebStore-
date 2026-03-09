import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

// Polyfill File + Blob for Node 18 (required by undici/Payload CMS)
if (typeof globalThis.File === 'undefined') {
  const { File, Blob } = require('node:buffer')
  globalThis.File = File
  if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob
}

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['undici', 'pg'],
  experimental: {
    reactCompiler: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default withPayload(nextConfig)
