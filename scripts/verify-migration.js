#!/usr/bin/env node
/**
 * Verify Neon migration — Phase 1 steps 1.4-1.5
 * Checks: row counts, sequences, FK integrity, Payload internals, Vietnamese text
 *
 * Usage:
 *   DATABASE_URI="postgresql://...@ep-xxx.neon.tech/primeweb?sslmode=require" \
 *     node scripts/verify-migration.js
 *
 * Optional — compare with DO source:
 *   DATABASE_URI="neon-url" SOURCE_DB="do-url" node scripts/verify-migration.js
 */
const { Pool } = require('pg')

const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
const sourceStr = process.env.SOURCE_DB
if (!connStr) {
  console.error('❌ Set DATABASE_URI or DATABASE_URL (Neon target)')
  process.exit(1)
}

function makePool(str) {
  const clean = str
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '')
  return new Pool({
    connectionString: clean,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })
}

let failures = 0
let warnings = 0

function pass(msg) { console.log(`  ✅ ${msg}`) }
function fail(msg) { console.log(`  ❌ ${msg}`); failures++ }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++ }

async function getAllTables(pool) {
  const res = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  return res.rows.map(r => r.table_name)
}

async function getRowCount(pool, table) {
  const res = await pool.query(`SELECT count(*)::int AS c FROM "${table}"`)
  return res.rows[0].c
}

async function checkSequences(pool) {
  const seqs = await pool.query(`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  `)
  const issues = []
  for (const { sequencename } of seqs.rows) {
    const tableName = sequencename.replace(/_id_seq$/, '')
    try {
      const maxRes = await pool.query(`SELECT COALESCE(max(id), 0)::bigint AS m FROM "${tableName}"`)
      const seqRes = await pool.query(`SELECT last_value::bigint AS v FROM "${sequencename}"`)
      const maxId = maxRes.rows[0].m
      const seqVal = seqRes.rows[0].v
      if (maxId > seqVal) {
        issues.push({ table: tableName, maxId, seqVal })
      }
    } catch {
      // table might not have id column or might not exist — skip
    }
  }
  return issues
}

async function checkForeignKeys(pool) {
  const fks = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    LIMIT 50
  `)
  const orphans = []
  for (const fk of fks.rows) {
    try {
      const res = await pool.query(`
        SELECT count(*)::int AS c FROM "${fk.table_name}" t
        WHERE t."${fk.column_name}" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "${fk.foreign_table}" f
            WHERE f."${fk.foreign_column}" = t."${fk.column_name}"
          )
      `)
      if (res.rows[0].c > 0) {
        orphans.push({ ...fk, count: res.rows[0].c })
      }
    } catch {
      // skip if table structure doesn't match
    }
  }
  return orphans
}

async function checkPayloadTables(pool, tables) {
  const required = [
    'payload_locked_documents',
    'payload_locked_documents_rels',
    'payload_preferences',
    'payload_preferences_rels',
    'payload_migrations',
  ]
  const missing = required.filter(t => !tables.includes(t))
  return missing
}

async function checkVietnameseText(pool) {
  try {
    const res = await pool.query(`
      SELECT count(*)::int AS c FROM users
      WHERE name ~ '[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]'
    `)
    return res.rows[0].c
  } catch {
    return -1
  }
}

async function main() {
  const neon = makePool(connStr)
  const source = sourceStr ? makePool(sourceStr) : null

  console.log('🔍 Verifying Neon migration...')
  console.log(`   Target: ${connStr.replace(/\/\/.*@/, '//***@')}`)
  if (source) console.log(`   Source: ${sourceStr.replace(/\/\/.*@/, '//***@')}`)
  console.log('')

  // 1. Tables
  console.log('── 1. Tables ──')
  const tables = await getAllTables(neon)
  console.log(`  Found ${tables.length} tables`)
  if (tables.length === 0) { fail('No tables found!'); process.exit(1) }

  if (source) {
    const srcTables = await getAllTables(source)
    const missing = srcTables.filter(t => !tables.includes(t))
    if (missing.length > 0) {
      fail(`Missing tables: ${missing.join(', ')}`)
    } else {
      pass(`All ${srcTables.length} source tables present`)
    }
  } else {
    pass(`${tables.length} tables found`)
  }

  // 2. Row counts
  console.log('\n── 2. Row Counts ──')
  const keyTables = ['users', 'sites', 'pages', 'products', 'orders', 'media', 'tenants']
  for (const t of keyTables) {
    if (!tables.includes(t)) { warn(`Table '${t}' not found — skipped`); continue }
    const count = await getRowCount(neon, t)
    if (source) {
      try {
        const srcCount = await getRowCount(source, t)
        if (count === srcCount) {
          pass(`${t}: ${count} rows (match ✓)`)
        } else {
          fail(`${t}: Neon=${count}, Source=${srcCount} (MISMATCH)`)
        }
      } catch {
        warn(`${t}: ${count} rows (source compare failed)`)
      }
    } else {
      console.log(`  📊 ${t}: ${count} rows`)
    }
  }

  // 3. Sequences
  console.log('\n── 3. Sequences ──')
  const seqIssues = await checkSequences(neon)
  if (seqIssues.length === 0) {
    pass('All sequences in sync')
  } else {
    for (const s of seqIssues) {
      fail(`${s.table}: max(id)=${s.maxId} > sequence=${s.seqVal}`)
      console.log(`     FIX: SELECT setval('${s.table}_id_seq', ${s.maxId});`)
    }
  }

  // 4. Foreign keys
  console.log('\n── 4. Foreign Key Integrity ──')
  const orphans = await checkForeignKeys(neon)
  if (orphans.length === 0) {
    pass('No orphan records found')
  } else {
    for (const o of orphans) {
      warn(`${o.table_name}.${o.column_name} → ${o.foreign_table}: ${o.count} orphans`)
    }
  }

  // 5. Payload internals
  console.log('\n── 5. Payload Internal Tables ──')
  const missingPayload = await checkPayloadTables(neon, tables)
  if (missingPayload.length === 0) {
    pass('All Payload internal tables present')
  } else {
    fail(`Missing Payload tables: ${missingPayload.join(', ')}`)
  }

  // 6. Vietnamese text encoding
  console.log('\n── 6. Vietnamese Text Encoding ──')
  const vnCount = await checkVietnameseText(neon)
  if (vnCount > 0) {
    pass(`Vietnamese diacritics preserved (${vnCount} users with VN names)`)
  } else if (vnCount === 0) {
    warn('No Vietnamese text found — may be OK if no VN user data')
  } else {
    warn('Could not check Vietnamese text (users table missing name column)')
  }

  // 7. Storage size
  console.log('\n── 7. Database Size ──')
  try {
    const sizeRes = await neon.query(`SELECT pg_database_size(current_database()) AS s`)
    const sizeMB = (parseInt(sizeRes.rows[0].s, 10) / 1024 / 1024).toFixed(1)
    if (parseFloat(sizeMB) > 400) {
      warn(`Database size: ${sizeMB}MB — approaching 512MB free tier limit`)
    } else {
      pass(`Database size: ${sizeMB}MB (free tier limit: 512MB)`)
    }
  } catch {
    warn('Could not check database size')
  }

  // Summary
  console.log('\n══════════════════════════════')
  if (failures === 0 && warnings === 0) {
    console.log('✅ Migration verified — ALL CHECKS PASSED')
  } else if (failures === 0) {
    console.log(`⚠️  Migration OK with ${warnings} warning(s) — review above`)
  } else {
    console.log(`❌ Migration has ${failures} failure(s), ${warnings} warning(s) — FIX REQUIRED`)
  }
  console.log('══════════════════════════════')

  await neon.end()
  if (source) await source.end()
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
