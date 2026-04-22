#!/usr/bin/env node
/**
 * Local dev migration runner. Runs once before `npm run dev` via predev hook.
 * Idempotent — safe to run repeatedly (ALTER IF NOT EXISTS, CREATE IF NOT EXISTS).
 * Skips silently if .env.local missing or DATABASE_URI unset (fresh clone, no DB access).
 *
 * Must NOT block `npm run dev` — called via:
 *   "predev": "node scripts/db-migrate-dev.js || echo '[predev] skipped on error'"
 */
const fs = require('fs')
const path = require('path')

// ── Load DATABASE_URI from .env.local (no dotenv dep) ────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  console.log('[db-migrate-dev] .env.local missing — skipping (set DATABASE_URI to enable)')
  process.exit(0)
}

const envContent = fs.readFileSync(envPath, 'utf8')
const uriMatch = envContent.match(/^DATABASE_URI="?([^"\n]+)"?/m)
if (!uriMatch) {
  console.log('[db-migrate-dev] DATABASE_URI not found in .env.local — skipping')
  process.exit(0)
}
process.env.DATABASE_URI = uriMatch[1]

// ── Import MIGRATIONS from main db-setup.js ───────────────────────────────────
let MIGRATIONS
try {
  const dbSetup = require('./db-setup.js')
  MIGRATIONS = dbSetup.MIGRATIONS
} catch (e) {
  console.error('[db-migrate-dev] Failed to load db-setup.js:', e.message)
  process.exit(0)
}

if (!Array.isArray(MIGRATIONS) || MIGRATIONS.length === 0) {
  console.log('[db-migrate-dev] No MIGRATIONS exported from db-setup.js — skipping')
  process.exit(0)
}

// ── Build pg Pool (reuse SSL logic from db-setup.js) ─────────────────────────
const { Pool } = require('pg')
const connStr = process.env.DATABASE_URI

const sslmodeMatch = connStr.match(/[?&]sslmode=([^&]+)/)
const sslmode = sslmodeMatch ? sslmodeMatch[1].toLowerCase() : null
const hostMatch = connStr.match(/@([^:/?]+)/)
const host = hostMatch ? hostMatch[1].toLowerCase() : ''
const isLocal =
  host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'host.docker.internal'
const useSsl = sslmode === 'disable' ? false : isLocal ? false : { rejectUnauthorized: false }

const cleanConn = connStr
  .replace(/[?&]sslmode=[^&]+/g, '')
  .replace(/\?&/, '?')
  .replace(/\?$/, '')

const pool = new Pool({
  connectionString: cleanConn,
  ssl: useSsl,
  connectionTimeoutMillis: 8000,
})

// ── Run migrations ────────────────────────────────────────────────────────────
;(async () => {
  const start = Date.now()
  let applied = 0
  let errors = 0

  try {
    for (const m of MIGRATIONS) {
      try {
        await pool.query(m.sql)
        applied++
      } catch (e) {
        errors++
        console.error(`[db-migrate-dev] ✗ ${m.name}: ${e.message}`)
      }
    }
    const elapsed = Date.now() - start
    if (errors > 0) {
      console.log(
        `[db-migrate-dev] ✓ ran ${applied}/${MIGRATIONS.length} migrations in ${elapsed}ms` +
          ` (${errors} skipped with errors — see above)`,
      )
    } else {
      console.log(
        `[db-migrate-dev] ✓ ran ${applied}/${MIGRATIONS.length} migrations in ${elapsed}ms`,
      )
    }
  } catch (e) {
    console.error('[db-migrate-dev] fatal:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
