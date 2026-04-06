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
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { Analytics } from './collections/Analytics'
import { SEOMetaJobs } from './collections/SEOMetaJobs'
import { Blogs } from './collections/Blogs'
import { BlogCategories } from './collections/BlogCategories'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { Categories } from './collections/Categories'
import { Notifications } from './collections/Notifications'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const require = createRequire(import.meta.url)

/** Trả về connection string (bỏ sslmode để tránh parse ghi đè pool.ssl). */
function getDatabaseConnectionString(): string {
  const raw = process.env.DATABASE_URI || 'postgresql://localhost/primeweb'
  const withoutSslmode = raw.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '')
  return withoutSslmode || raw
}

/** Có phải DB từ xa (cần SSL, có thể self-signed) không. */
function isRemoteDatabase(): boolean {
  const raw = process.env.DATABASE_URI || ''
  return (
    raw.length > 0 &&
    !raw.includes('localhost') &&
    !raw.includes('127.0.0.1') &&
    !raw.includes('postgres:')
  )
}

/** Schema push is expensive in dev Docker and can block auth/API requests.
 * Enable it explicitly only when you intend to sync schema changes.
 */
function shouldPushSchema(): boolean {
  return process.env.PAYLOAD_PUSH_SCHEMA === 'true'
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
    Products,
    Orders,
    Analytics,
    SEOMetaJobs,
    Blogs,
    BlogCategories,
    Categories,
    Notifications,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'fallback-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: getDatabaseConnectionString(),
      // DB từ xa (DO managed): ép chấp nhận cert để tránh SELF_SIGNED_CERT_IN_CHAIN.
      // Truyền rõ ở đây vì parse(connectionString) có thể ghi đè nếu URL còn sslmode.
      ...(isRemoteDatabase() ? { ssl: { rejectUnauthorized: false } } : {}),
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
                  
                  // Handle DigitalOcean Spaces (Virtual Host style) vs MinIO (Path style)
                  if (publicEndpoint.includes('digitaloceanspaces')) {
                    const host = publicEndpoint.replace('https://', '').replace('http://', '')
                    return `https://${bucket}.${host}/${prefix ? `${prefix}/` : ''}${filename}`
                  }
                  
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
