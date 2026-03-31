#!/usr/bin/env node
/**
 * CI Check: When a PR adds new fields or block types to Payload collections,
 * ensure matching migrations exist in db-setup.js.
 *
 * How it works:
 * 1. Get git diff of collection files vs base branch (staging)
 * 2. Find NEW field definitions (added lines with `name: 'xxx'`)
 * 3. Check if db-setup.js MIGRATIONS array has matching ALTER TABLE
 *
 * BLOCK RULE (Pages.ts):
 * When a new block slug is added to Pages.ts, BOTH tables must exist in migrations:
 *   - pages_blocks_{slug}      (live data table)
 *   - _pages_v_blocks_{slug}   (draft/versioning table — Payload editor uses this)
 * Forgetting _pages_v_blocks_* causes the editor to show "0 blocks" with
 * "relation does not exist" DB errors.
 *
 * Usage: node scripts/check-migrations.js [base-branch]
 * Default base branch: staging
 *
 * Exit 0 = ok (no new fields, or all have migrations)
 * Exit 1 = new fields found without migrations
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_BRANCH = process.argv[2] || 'origin/staging'
const DB_SETUP_PATH = path.join(__dirname, 'db-setup.js')

// Tables we track migrations for
const TRACKED_COLLECTIONS = {
  'Tenants.ts': 'tenants',
  'Sites.ts': 'sites',
  'Products.ts': 'products',
  'Orders.ts': 'orders',
}

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

function getNewFieldsFromDiff() {
  const newFields = []

  for (const [filename, tableName] of Object.entries(TRACKED_COLLECTIONS)) {
    const filePath = `src/collections/${filename}`

    try {
      // Get only ADDED lines in collection file
      const diff = execSync(
        `git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" | grep "name:" || true`,
        { encoding: 'utf8' }
      ).trim()

      if (!diff) continue

      // Extract field names from added lines
      const regex = /name:\s*['"](\w+)['"]/g
      let match
      while ((match = regex.exec(diff)) !== null) {
        newFields.push({
          field: match[1],
          snake: toSnakeCase(match[1]),
          table: tableName,
          file: filename,
        })
      }
    } catch {
      // File doesn't exist or no diff — skip
    }
  }

  return newFields
}

function getMigrationColumns() {
  const content = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  const columns = new Set()

  // Match ALTER TABLE xxx ADD COLUMN IF NOT EXISTS yyy
  const regex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    columns.add(`${match[1]}.${match[2]}`)
  }

  return columns
}

function getMigrationTables() {
  const content = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  const tables = new Set()

  // Match CREATE TABLE IF NOT EXISTS "xxx" or xxx
  const regex = /CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    tables.add(match[1])
  }

  return tables
}

function getNewBlockSlugsFromDiff() {
  const slugs = []
  const filePath = 'src/collections/Pages.ts'

  try {
    const diff = execSync(
      `git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" || true`,
      { encoding: 'utf8' }
    ).trim()

    if (!diff) return slugs

    // Detect new block slug definitions: +    slug: 'hero',
    const regex = /^\+.*slug:\s*['"]([a-zA-Z0-9_-]+)['"]/gm
    let match
    while ((match = regex.exec(diff)) !== null) {
      const slug = match[1]
      // Skip 'pages' (the collection slug itself, not a block)
      if (slug !== 'pages') {
        slugs.push(slug)
      }
    }
  } catch {
    // No diff or file missing
  }

  return slugs
}

function checkNewBlocks() {
  const newSlugs = getNewBlockSlugsFromDiff()
  if (newSlugs.length === 0) return []

  const tables = getMigrationTables()
  const missing = []

  for (const slug of newSlugs) {
    const liveTable = `pages_blocks_${slug}`
    const versionTable = `_pages_v_blocks_${slug}`

    if (!tables.has(liveTable)) {
      missing.push({ slug, table: liveTable, type: 'live' })
    }
    if (!tables.has(versionTable)) {
      missing.push({ slug, table: versionTable, type: 'version' })
    }
  }

  return missing
}

function main() {
  console.log(`[migration-check] Comparing against ${BASE_BRANCH}...`)

  let hasErrors = false

  // ── Check 1: New block types in Pages.ts ────────────────────────────
  const missingBlockTables = checkNewBlocks()
  if (missingBlockTables.length > 0) {
    hasErrors = true
    const slugsAffected = [...new Set(missingBlockTables.map(m => m.slug))]
    console.error(`\n❌ New block slug(s) detected in Pages.ts: ${slugsAffected.join(', ')}`)
    console.error('   Both tables MUST exist in db-setup.js MIGRATIONS:\n')
    for (const m of missingBlockTables) {
      console.error(`   Missing: "${m.table}"`)
      if (m.type === 'live') {
        console.error(`   → Add to db-setup.js:`)
        console.error(`     { name: '${m.table}.create_table', sql: \`CREATE TABLE IF NOT EXISTS "${m.table}" (`)
        console.error(`       id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,`)
        console.error(`       _order integer NOT NULL, _parent_id integer NOT NULL,`)
        console.error(`       _path varchar NOT NULL DEFAULT 'layout', _uuid varchar, block_name varchar,`)
        console.error(`       /* add block-specific columns here */`)
        console.error(`     );\` },`)
      } else {
        console.error(`   → Add to db-setup.js (MUST pair with pages_blocks_${m.slug}):`)
        console.error(`     { name: '${m.table}.create_table', sql: \`CREATE TABLE IF NOT EXISTS "${m.table}" (`)
        console.error(`       id serial PRIMARY KEY,`)
        console.error(`       _order integer NOT NULL, _parent_id integer NOT NULL,`)
        console.error(`       _path text NOT NULL, _uuid varchar, block_name varchar,`)
        console.error(`       /* same block-specific columns as pages_blocks_${m.slug} */`)
        console.error(`     );\` },`)
      }
      console.error()
    }
    console.error('💡 RULE: Every new Pages block needs BOTH tables:')
    console.error('   pages_blocks_{slug}    — live data (id varchar, _path varchar)')
    console.error('   _pages_v_blocks_{slug} — drafts/editor (id serial, _path text)\n')
  }

  // ── Check 2: New fields in tracked collections ───────────────────────
  const newFields = getNewFieldsFromDiff()

  if (newFields.length > 0) {
    console.log(`[migration-check] Found ${newFields.length} new field(s) in PR:`)
    for (const f of newFields) {
      console.log(`   ${f.table}.${f.snake} (${f.field} in ${f.file})`)
    }

    const migrations = getMigrationColumns()
    const missingFields = newFields.filter(f => !migrations.has(`${f.table}.${f.snake}`))

    if (missingFields.length > 0) {
      hasErrors = true
      console.error(`\n❌ ${missingFields.length} new field(s) WITHOUT migrations:\n`)
      for (const f of missingFields) {
        console.error(`   ${f.table}.${f.snake} (added in ${f.file})`)
        console.error(`   → Add to scripts/db-setup.js MIGRATIONS:`)
        console.error(`     { name: '${f.table}.${f.snake}', sql: 'ALTER TABLE ${f.table} ADD COLUMN IF NOT EXISTS ${f.snake} varchar;' }\n`)
      }
      console.error('💡 Tip: Add the migration entries above to scripts/db-setup.js MIGRATIONS array.')
      console.error('   This ensures the column exists on staging/production before your code queries it.\n')
    } else {
      console.log('[migration-check] ✅ All new fields have matching migrations')
    }
  } else if (missingBlockTables.length === 0) {
    console.log('[migration-check] ✅ No new collection fields or block types detected')
  }

  process.exit(hasErrors ? 1 : 0)
}

main()
