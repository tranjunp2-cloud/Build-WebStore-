// @vitest-environment node
/**
 * TC-SCHEMA-001: Payload collection DB schema drift detector.
 *
 * Queries information_schema.columns for each collection table to verify
 * all expected columns exist. Any missing column means db-setup.js MIGRATIONS
 * is missing an ALTER TABLE — surfaces as CI failure before merge.
 *
 * Uses raw pg queries (not getPayload) to avoid vitest mock conflicts with
 * the global @payload-config mock in setup.ts.
 *
 * Skipped automatically when DATABASE_URI is not set:
 *   - CI without DB access → skip (not fail)
 *   - Fresh local clone without .env.local → skip
 *
 * To run locally:
 *   npx vitest run src/__tests__/integration/payload-collection-schema.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

// ── Load .env.local (Vitest module transform runs top-level before imports
//    when using @vitest-environment node — this sets process.env before Pool is used) ──
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2]
    }
  }
}

const RUN_TEST = !!process.env.DATABASE_URI

// ── Collection → expected columns map ────────────────────────────────────────
// Tracks custom columns added via MIGRATIONS in db-setup.js.
// When a new field is added to a Payload collection, add the DB column name
// here + add the migration to db-setup.js. This test catches the gap on the
// next local run before it reaches staging.
//
// Only non-default columns listed (Payload always creates id, created_at, etc.)
// Column names follow Payload's camelCase→snake_case mapping (e.g. displayName→display_name).
const COLLECTION_COLUMN_CHECKS: Record<string, string[]> = {
  // Phase G.1: BlockVariants — enabled + displayName added 2026-04-21
  block_variants: ['enabled', 'display_name'],
  // Tenants: Stripe Connect + business info
  tenants: ['stripe_account_id', 'stripe_onboarding_complete', 'whatsapp_number', 'ssm_number'],
  // Users: tenant membership sub-table
  users_tenants: ['tenant_id', 'status', 'role'],
  // Sites: site_type + locale fields
  sites: ['site_type', 'locale'],
  // Orders: EasyParcel collection method selected at label creation
  orders: ['collection_method'],
}

describe.skipIf(!RUN_TEST)('Payload collection schema drift [TC-SCHEMA-001]', () => {
  let pool: Pool

  beforeAll(async () => {
    const connStr = process.env.DATABASE_URI as string

    // Mirror SSL logic from db-setup.js
    const sslmodeMatch = connStr.match(/[?&]sslmode=([^&]+)/)
    const sslmode = sslmodeMatch ? sslmodeMatch[1].toLowerCase() : null
    const hostMatch = connStr.match(/@([^:/?]+)/)
    const host = hostMatch ? hostMatch[1].toLowerCase() : ''
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === 'host.docker.internal'
    const useSsl = sslmode === 'disable' ? false : isLocal ? false : { rejectUnauthorized: false }

    const cleanConn = connStr
      .replace(/[?&]sslmode=[^&]+/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '')

    pool = new Pool({ connectionString: cleanConn, ssl: useSsl, max: 3 })
  }, 15_000)

  afterAll(async () => {
    await pool?.end()
  })

  it('connects to the database', async () => {
    const result = await pool.query('SELECT 1 AS ok')
    expect(result.rows[0].ok).toBe(1)
  })

  it('all tracked tables exist in the database', async () => {
    const tables = Object.keys(COLLECTION_COLUMN_CHECKS)
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1)`,
      [tables],
    )
    const found = result.rows.map((r) => r.table_name)
    const missing = tables.filter((t) => !found.includes(t))

    if (missing.length > 0) {
      throw new Error(
        `Tables missing from DB (need CREATE TABLE in MIGRATIONS):\n` +
          missing.map((t) => `  - ${t}`).join('\n') +
          `\n\nFix: add CREATE TABLE IF NOT EXISTS to scripts/db-setup.js MIGRATIONS, then:\n` +
          `  node scripts/db-migrate-dev.js`,
      )
    }

    expect(missing).toHaveLength(0)
  }, 15_000)

  it('all tracked columns exist in their tables', async () => {
    const allChecks = Object.entries(COLLECTION_COLUMN_CHECKS).flatMap(([table, cols]) =>
      cols.map((col) => ({ table, col })),
    )

    const result = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) = ANY(
           SELECT unnest($1::text[]), unnest($2::text[])
         )`,
      [allChecks.map((c) => c.table), allChecks.map((c) => c.col)],
    )

    const found = new Set(result.rows.map((r) => `${r.table_name}.${r.column_name}`))
    const missing = allChecks.filter((c) => !found.has(`${c.table}.${c.col}`))

    if (missing.length > 0) {
      throw new Error(
        `Schema drift: ${missing.length} column(s) missing from DB:\n` +
          missing.map((c) => `  - ${c.table}.${c.col}`).join('\n') +
          `\n\nFix: add ALTER TABLE ${missing[0].table} ADD COLUMN IF NOT EXISTS ${missing[0].col} ...` +
          ` to scripts/db-setup.js MIGRATIONS array, then:\n` +
          `  node scripts/db-migrate-dev.js`,
      )
    }

    expect(missing).toHaveLength(0)
  }, 15_000)
})
