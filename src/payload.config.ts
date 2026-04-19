import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'

import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { Sites } from './collections/Sites'
import { Pages } from './collections/Pages'
import { Media } from './collections/Media'
import { Templates } from './collections/Templates'
import { Subscriptions } from './collections/Subscriptions'
import { Subscribers } from './collections/Subscribers'
import { ContactSubmissions } from './collections/ContactSubmissions'
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { Analytics } from './collections/Analytics'
import { SEOMetaJobs } from './collections/SEOMetaJobs'
import { Blogs } from './collections/Blogs'
import { BlogCategories } from './collections/BlogCategories'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { Categories } from './collections/Categories'
import { Notifications } from './collections/Notifications'
import { PushSubscriptions } from './collections/PushSubscriptions'
import { AiUsageLogs } from './collections/AiUsageLogs'
import { TemplateQualityScores } from './collections/TemplateQualityScores'
import { BlockCatalogEntries } from './collections/BlockCatalogEntries'
import { BlockVariants } from './collections/BlockVariants'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const require = createRequire(import.meta.url)

/** Trả về connection string (bỏ sslmode để tránh parse ghi đè pool.ssl). */
function getDatabaseConnectionString(): string {
  const raw = process.env.DATABASE_URI || process.env.DATABASE_URL || 'postgresql://localhost/primeweb'
  const withoutSslmode = raw.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '')
  return withoutSslmode || raw
}

/** Có phải DB từ xa (cần SSL, có thể self-signed) không. */
function isRemoteDatabase(): boolean {
  const raw = process.env.DATABASE_URI || process.env.DATABASE_URL || ''
  return (
    raw.length > 0 &&
    !raw.includes('localhost') &&
    !raw.includes('127.0.0.1') &&
    !raw.includes('postgres:')
  )
}

/** Schema push: auto-enable for local dev, explicit for Docker/staging.
 * - Local dev (NODE_ENV=development): always push (dev needs latest schema)
 * - Docker/staging: only when PAYLOAD_PUSH_SCHEMA=true (db-setup controls this)
 * - Production: never push
 *
 * History: commit 5934144 disabled auto-push to fix 45s timeout in dev Docker.
 * But this broke local dev — fields added to collections didn't create columns.
 * Fix: auto-push for local dev, explicit for Docker (db-setup sets the env var).
 */
function shouldPushSchema(): boolean {
  if (process.env.PAYLOAD_PUSH_SCHEMA === 'false') return false
  if (process.env.PAYLOAD_PUSH_SCHEMA === 'true') return true
  // Auto-push for local dev only
  const isDev = process.env.NODE_ENV === 'development'
  return isDev
}


export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  // Email: SMTP via AWS SES when MAIL_HOST is configured, otherwise log to console (safe fallback)
  email: process.env.MAIL_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.MAIL_FROM_ADDRESS || 'noreply@primeweb.app',
        defaultFromName: process.env.MAIL_FROM_NAME || 'PrimeWeb',
        transportOptions: {
          host: process.env.MAIL_HOST,
          port: parseInt(process.env.MAIL_PORT || '587'),
          secure: process.env.MAIL_PORT === '465',
          auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
          },
        },
      })
    : nodemailerAdapter({
        defaultFromAddress: 'noreply@primeweb.app',
        defaultFromName: 'PrimeWeb',
        // No SMTP configured — use stream transport (logs to console, no crash)
        transportOptions: {
          streamTransport: true,
          newline: 'unix',
        } as Record<string, unknown>,
      }),
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
    Subscribers,
    ContactSubmissions,
    Products,
    Orders,
    Analytics,
    SEOMetaJobs,
    Blogs,
    BlogCategories,
    Categories,
    Notifications,
    PushSubscriptions,
    AiUsageLogs,
    TemplateQualityScores,
    BlockCatalogEntries,
    BlockVariants,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'fallback-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: getDatabaseConnectionString(),
      // Remote DB (Neon): require valid SSL cert.
      // Local dev: no SSL needed.
      ...(isRemoteDatabase() ? { ssl: { rejectUnauthorized: true } } : {}),
    },
    // Push schema only when explicitly requested to avoid expensive sync on every
    // local Docker request. Use `PAYLOAD_PUSH_SCHEMA=true` or the db push script
    // when you intentionally need a schema update.
    push: shouldPushSchema(),
  }),
  sharp,
  plugins: [
    ...(process.env.S3_BUCKET && process.env.S3_ENDPOINT
      ? [
          s3Storage({
            collections: {
              media: {
                disableLocalStorage: true,
                disablePayloadAccessControl: true,
                generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) => {
                  const s3Endpoint = process.env.S3_ENDPOINT || ''
                  const publicEndpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT || s3Endpoint
                  const bucket = process.env.S3_BUCKET || ''
                  
                  return `${publicEndpoint}/${bucket}/${prefix ? `${prefix}/` : ''}${filename}`
                }
              },
            },
            bucket: process.env.S3_BUCKET as string,
            config: {
              endpoint: process.env.S3_ENDPOINT,
              region: process.env.S3_REGION || 'us-east-1',
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
              },
              forcePathStyle: true, // Required for MinIO
            },
          }),
        ]
      : []),
    // Multi-tenant isolation handled via custom access control + middleware
    // Will add more plugins as needed (seo, etc.)
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
