/**
 * QC test environment reset script.
 *
 * Wipes tenant-scoped data from the QC Neon database so the QC team can
 * run a fresh JMeter / functional test batch without stale state. Keeps
 * the schema intact — only deletes documents.
 *
 * Delete order respects foreign-key dependencies: order_items → orders →
 * products → pages/templates → sites → subscriptions → tenants → users.
 * Auth-independent collections (analytics, logs) wiped last.
 *
 * Guarded by `assertQcEnv()` — refuses to run against staging / prod.
 *
 * Usage:
 *   set -a && . .env.qc-test && set +a
 *   npm run db:reset-qc
 *   npm run db:seed-qc     # optional re-seed after reset
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'
import { assertQcEnv } from './qc-guard'
import { wipeQcCollection } from './qc-reset-helpers'

// Order matters: leaf collections first, root last. Anything not in this
// list is intentionally preserved (block catalog, template definitions,
// email templates — treat as schema-adjacent seed data).
//
// Slug values MUST match the `slug:` field of each collection in
// `src/collections/*.ts` verbatim. Payload uses these slugs for its
// Drizzle table names. Notable naming inconsistency in the schema:
// most slugs are kebab-case, but a few use snake_case
// (`blog_categories`, `discount_usage_history`). Do not "normalize".
//
// Template child collections (versions/issues/quality-scores) FK the
// parent `templates` row → they must be deleted BEFORE `templates`.
const COLLECTIONS_TO_WIPE = [
  'orders',
  'discount_usage_history',
  'discounts',
  'contact-submissions',
  'customers',
  'blogs',
  'blog_categories',
  'products',
  'pages',
  'template-versions',
  'template-issues',
  'template-quality-scores',
  'templates',
  'sites',
  'subscribers',
  'plan-subscription-usages',
  'plan-subscriptions',
  'subscriptions',
  'notifications',
  'push-subscriptions',
  'analytics',
  'ai-usage-logs',
  'ai-generation-records',
  'sso-step-events',
  'seo-meta-jobs',
  'media',
  'tenants',
  'users',
] as const

async function main(): Promise<void> {
  assertQcEnv()
  const t0 = Date.now()
  const payload = await getPayload({ config })

  console.log('🧹 Resetting QC test data...')
  let grandTotal = 0
  const failedCollections: string[] = []
  for (const slug of COLLECTIONS_TO_WIPE) {
    const t = Date.now()
    try {
      const count = await wipeQcCollection(payload, slug)
      grandTotal += count
      const elapsed = ((Date.now() - t) / 1000).toFixed(1)
      console.log(`  ✓ ${slug}: ${count} docs (${elapsed}s)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : 'unknown'
      console.warn(`  ! ${slug}: skipped (${msg})`)
      failedCollections.push(`${slug}: ${msg}`)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  if (failedCollections.length > 0) {
    throw new Error(
      `QC reset incomplete for ${failedCollections.length} collection(s): ${failedCollections.slice(0, 5).join('; ')}`,
    )
  }
  console.log(`✅ Reset done in ${elapsed}s. Wiped ${grandTotal} docs across ${COLLECTIONS_TO_WIPE.length} collections.`)
  console.log('   Next: `npm run db:seed-qc` to re-populate dummy fixtures.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Reset failed:', err)
  process.exit(1)
})
