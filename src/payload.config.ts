import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { Sites } from './collections/Sites'
import { Pages } from './collections/Pages'
import { Media } from './collections/Media'
import { Templates } from './collections/Templates'
import { Subscriptions } from './collections/Subscriptions'
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { Analytics } from './collections/Analytics'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** Connection string cho Postgres. Với DB từ xa ép sslmode=no-verify để tránh SELF_SIGNED_CERT_IN_CHAIN (DO managed DB). */
function getDatabaseConnectionString(): string {
  const raw = process.env.DATABASE_URI || 'postgresql://localhost/primeweb'
  if (raw.includes('localhost')) return raw
  const withoutSslmode = raw.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?')
  const join = withoutSslmode.includes('?') ? '&' : '?'
  return `${withoutSslmode}${join}sslmode=no-verify`
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— Web Store Admin',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    livePreview: {
      collections: ['pages'],
    },
  },
  collections: [
    Tenants,
    Users,
    Sites,
    Pages,
    Media,
    Templates,
    Subscriptions,
    Products,
    Orders,
    Analytics,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'fallback-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: getDatabaseConnectionString(),
    },
  }),
  sharp,
  plugins: [
    // Multi-tenant isolation handled via custom access control + middleware
    // Will add more plugins as needed (cloud-storage, seo, etc.)
  ],
  cors: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  ].filter(Boolean),
  csrf: [
    process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  ].filter(Boolean),
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  },
})
