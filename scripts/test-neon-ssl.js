#!/usr/bin/env node
/**
 * Test Neon SSL connection — Phase 1 step 1.6
 *
 * Usage:
 *   DATABASE_URI="postgresql://user:pass@ep-xxx.neon.tech/primeweb?sslmode=require" \
 *     node scripts/test-neon-ssl.js
 */
const { Pool } = require('pg')

const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
if (!connStr) {
  console.error('❌ Set DATABASE_URI or DATABASE_URL env var')
  process.exit(1)
}

const cleanStr = connStr
  .replace(/[?&]sslmode=[^&]+/g, '')
  .replace(/\?&/, '?')
  .replace(/\?$/, '')

async function testConnection(label, sslConfig) {
  const pool = new Pool({
    connectionString: cleanStr,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
  })

  const start = Date.now()
  try {
    const res = await pool.query('SELECT version()')
    const latency = Date.now() - start
    console.log(`✅ ${label}: OK (${latency}ms)`)
    console.log(`   PostgreSQL: ${res.rows[0].version.split(',')[0]}`)
    return { ok: true, latency }
  } catch (err) {
    console.log(`❌ ${label}: FAIL — ${err.message}`)
    return { ok: false, error: err.message }
  } finally {
    await pool.end()
  }
}

async function main() {
  console.log('🔌 Testing Neon connection...')
  console.log(`   Host: ${cleanStr.replace(/\/\/.*@/, '//***@')}`)
  console.log('')

  // Test 1: SSL relaxed (current behavior)
  const relaxed = await testConnection(
    'SSL relaxed (rejectUnauthorized: false)',
    { rejectUnauthorized: false }
  )

  // Test 2: SSL strict (target behavior)
  const strict = await testConnection(
    'SSL strict (rejectUnauthorized: true)',
    { rejectUnauthorized: true }
  )

  // Test 3: SSL require (sslmode=require equivalent)
  const require_ = await testConnection(
    'SSL require (ssl: true)',
    true
  )

  console.log('')
  console.log('── Summary ──')
  if (strict.ok) {
    console.log('✅ Neon supports strict SSL → safe to set rejectUnauthorized: true')
    console.log('   → Update payload.config.ts: ssl: { rejectUnauthorized: true }')
  } else if (relaxed.ok) {
    console.log('⚠️  Strict SSL failed — keep rejectUnauthorized: false for now')
    console.log('   → Log issue, investigate Neon SSL cert chain')
  } else {
    console.log('❌ Connection failed entirely — check connection string + network')
  }

  if (relaxed.ok && relaxed.latency > 100) {
    console.log(`⚠️  Latency ${relaxed.latency}ms > 100ms target`)
  }

  process.exit(relaxed.ok ? 0 : 1)
}

main()
