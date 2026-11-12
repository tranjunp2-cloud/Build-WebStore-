import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { MEDIA_OBJECT_ACL, s3PublicUrl } from './lib/media/s3-public-url'
import { privateMediaAclPlugin } from './lib/media/private-media-acl'
import { payloadPoolLimits } from './lib/db/pool-options'
import { readReplicaOptions, withoutSslmode } from './lib/payload/read-replicas'

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
import { AiShopLimits } from './collections/AiShopLimits'
import { AiCapAlerts } from './collections/AiCapAlerts'
import { TemplateQualityScores } from './collections/TemplateQualityScores'
import { BlockCatalogEntries } from './collections/BlockCatalogEntries'
import { BlockVariants } from './collections/BlockVariants'
import { AiGenerationRecords } from './collections/AiGenerationRecords'
import { GenerationRecoveryJobs } from './collections/GenerationRecoveryJobs'
import { TemplateIssues } from './collections/TemplateIssues'
import { ContentPacks } from './collections/ContentPacks'
import { TemplateVersions } from './collections/TemplateVersions'
import { Customers } from './collections/Customers'
import { EmailTemplateSettings } from './collections/EmailTemplateSettings'
import { PlanSubscriptions } from './collections/PlanSubscriptions'
import { PlanSubscriptionUsages } from './collections/PlanSubscriptionUsages'
import { PlanFeatures } from './collections/PlanFeatures'
import { Discounts } from './collections/Discounts'
import { DiscountUsageHistory } from './collections/DiscountUsageHistory'
import { SsoStepEvents } from './collections/SsoStepEvents'
import { QaTestRuns } from './collections/QaTestRuns'
import { QaTestResults } from './collections/QaTestResults'
import { QaChangeSnapshots } from './collections/QaChangeSnapshots'
import { QaSmokeDispatches } from './collections/QaSmokeDispatches'
import { QaFixtureLeases } from './collections/QaFixtureLeases'
import { QaGithubIssues } from './collections/QaGithubIssues'
import { QaGithubIssueMappingEvents } from './collections/QaGithubIssueMappingEvents'
import { QaFindings } from './collections/QaFindings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const require = createRequire(import.meta.url)

/** Trả về connection string (bỏ sslmode để tránh parse ghi đè pool.ssl). */
function getDatabaseConnectionString(): string {
  const raw = process.env.DATABASE_URI || process.env.DATABASE_URL || 'postgresql://localhost/primeweb'
  // `?sslmode=require&x=y` must stay a valid URL (`?x=y`), not `…/db&x=y`
  return withoutSslmode(raw) || raw
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
        defaultFromName: process.env.MAIL_FROM_NAME || 'Web Store',
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
        defaultFromName: 'Web Store',
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
    AiShopLimits,
    AiCapAlerts,
    TemplateQualityScores,
    BlockCatalogEntries,
    BlockVariants,
    AiGenerationRecords,
    GenerationRecoveryJobs,
    TemplateIssues,
    ContentPacks,
    TemplateVersions,
    Customers,
    EmailTemplateSettings,
    PlanSubscriptions,
    PlanSubscriptionUsages,
    PlanFeatures,
    Discounts,
    DiscountUsageHistory,
    SsoStepEvents,
    QaTestRuns,
    QaTestResults,
    QaChangeSnapshots,
    QaSmokeDispatches,
    QaFixtureLeases,
    QaGithubIssues,
    QaGithubIssueMappingEvents,
    QaFindings,
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
      // max: DATABASE_POOL_MAX (default 25, the 2026-07-06 QC beta value; 10 on the Neon -pooler host),
      // plus a connect timeout so a full pool fails fast instead of hanging until maxDuration.
      // Plan: plans/261022-ai-security-reliability-600-users (C4).
      ...payloadPoolLimits({
        max: process.env.DATABASE_POOL_MAX,
        connectTimeoutMs: process.env.DATABASE_POOL_CONNECT_TIMEOUT_MS,
      }),
    },
    // Push schema only when explicitly requested to avoid expensive sync on every
    // local Docker request. Use `PAYLOAD_PUSH_SCHEMA=true` or the db push script
    // when you intentionally need a schema update.
    push: shouldPushSchema(),
    // Reads on Neon read replica(s) when DATABASE_URI_READ_REPLICA is set (comma list, -pooler hosts); each replica
    // pool reuses the pool options above. Unset = all reads on the primary. src/lib/payload/read-replicas.ts
    ...readReplicaOptions(process.env.DATABASE_URI_READ_REPLICA, getDatabaseConnectionString()),
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
                generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
                  s3PublicUrl(filename, prefix)
              },
            },
            bucket: process.env.S3_BUCKET as string,
            acl: MEDIA_OBJECT_ACL,
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
          // After s3Storage: its single static acl writes every object public-read; private rows (payment
          // receipts) get their stored objects set to `private` right after the upload (TC-PERF-146).
          privateMediaAclPlugin(),
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
      fileSize: 200 * 1024 * 1024, // 200MB — video uploads
    },
  },
})
