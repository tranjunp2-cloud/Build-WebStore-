#!/usr/bin/env node
/**
 * CI Check: When a PR adds new fields to Payload collections,
 * ensure matching migrations exist in db-setup.js.
 *
 * How it works:
 * 1. Get git diff of collection files vs base branch (staging)
 * 2. Find NEW field definitions (added lines with `name: 'xxx'`)
 * 3. Check if db-setup.js MIGRATIONS array has matching ALTER TABLE
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

function main() {
  console.log(`[migration-check] Comparing against ${BASE_BRANCH}...`)

  const newFields = getNewFieldsFromDiff()

  if (newFields.length === 0) {
    console.log('[migration-check] ✅ No new collection fields detected')
    process.exit(0)
  }

  console.log(`[migration-check] Found ${newFields.length} new field(s) in PR:`)
  for (const f of newFields) {
    console.log(`   ${f.table}.${f.snake} (${f.field} in ${f.file})`)
  }

  const migrations = getMigrationColumns()
  const missing = newFields.filter(f => !migrations.has(`${f.table}.${f.snake}`))

  if (missing.length === 0) {
    console.log('[migration-check] ✅ All new fields have matching migrations')
    process.exit(0)
  }

  console.error(`\n❌ ${missing.length} new field(s) WITHOUT migrations:\n`)
  for (const f of missing) {
    console.error(`   ${f.table}.${f.snake} (added in ${f.file})`)
    console.error(`   → Add to scripts/db-setup.js MIGRATIONS:`)
    console.error(`     { name: '${f.table}.${f.snake}', sql: 'ALTER TABLE ${f.table} ADD COLUMN IF NOT EXISTS ${f.snake} varchar;' }\n`)
  }

  console.error('💡 Tip: Add the migration entries above to scripts/db-setup.js MIGRATIONS array.')
  console.error('   This ensures the column exists on staging/production before your code queries it.\n')
  process.exit(1)
}

main()
