#!/usr/bin/env node
/**
 * CI Check: Validate DB migrations match Payload collection schemas.
 *
 * What it checks:
 * 1. New fields in tracked collections have matching ALTER TABLE migrations
 * 2. Array fields have correct CREATE TABLE with Payload naming convention
 * 3. Column types match Payload Drizzle expectations (varchar UUID, not serial)
 *
 * Payload CMS 3.x Naming Convention:
 *   - type: 'array'        → table: {collection}_{field}
 *                             columns: id VARCHAR, _order INT, _parent_id INT, _uuid VARCHAR
 *   - type: 'select'+hasMany → table: {collection}_{field}
 *                             columns: id SERIAL, order INT, parent_id INT, value VARCHAR/ENUM
 *   - type: 'group'        → same table, prefix: {group}_{field}
 *   - type: 'relationship'  → same table, column: {field}_id INT
 *
 * Usage: node scripts/check-migrations.js [base-branch]
 * Exit 0 = ok | Exit 1 = validation failed
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_BRANCH = process.argv[2] || 'origin/staging'
const DB_SETUP_PATH = path.join(__dirname, 'db-setup.js')
const COLLECTIONS_DIR = path.join(__dirname, '..', 'src', 'collections')

// ─── Payload naming convention rules ───────────────────────────────────
const PAYLOAD_CONVENTIONS = {
  array: {
    // Array fields create separate table: {collection}_{field}
    // Columns: id varchar (UUID), _order int, _parent_id int, _uuid varchar
    requiredColumns: {
      id: { type: 'varchar', note: 'UUID — NOT serial' },
      _order: { type: 'integer', note: 'with underscore prefix' },
      _parent_id: { type: 'integer', note: 'with underscore prefix' },
      _uuid: { type: 'varchar', note: 'UUID for Payload internal' },
    },
  },
  selectHasMany: {
    // Select hasMany fields create separate table: {collection}_{field}
    // Columns: id serial, order int, parent_id int, value varchar/enum
    requiredColumns: {
      id: { type: 'serial|integer', note: 'serial autoincrement' },
      order: { type: 'integer', note: 'NO underscore prefix' },
      parent_id: { type: 'integer', note: 'NO underscore prefix' },
      value: { type: 'varchar', note: 'enum or varchar' },
    },
  },
}

// Tables we track migrations for (simple field additions)
const TRACKED_COLLECTIONS = {
  'Tenants.ts': 'tenants',
  'Sites.ts': 'sites',
  'Products.ts': 'products',
  'Orders.ts': 'orders',
  'Users.ts': 'users',
}

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

// ─── Parse collection files for array/select fields ───────────────────
function parseCollectionFields(filename) {
  const filePath = path.join(COLLECTIONS_DIR, filename)
  if (!fs.existsSync(filePath)) return { arrays: [], selectHasMany: [], groups: [] }

  const content = fs.readFileSync(filePath, 'utf8')
  const slug = Object.entries(TRACKED_COLLECTIONS).find(([f]) => f === filename)?.[1]
  if (!slug) return { arrays: [], selectHasMany: [], groups: [] }

  const arrays = []
  const selectHasMany = []
  const groups = []

  // Find array fields: type: 'array' preceded by name: 'xxx'
  const arrayRegex = /name:\s*['"](\w+)['"]\s*,\s*\n\s*type:\s*['"]array['"]/g
  let match
  while ((match = arrayRegex.exec(content)) !== null) {
    arrays.push({
      fieldName: match[1],
      tableName: `${slug}_${toSnakeCase(match[1])}`,
    })
  }

  // Find select hasMany fields (exclude fields already detected as array)
  const arrayFieldNames = new Set(arrays.map(a => a.fieldName))
  const selectRegex = /name:\s*['"](\w+)['"]\s*,[\s\S]*?type:\s*['"]select['"]\s*,[\s\S]*?hasMany:\s*true/g
  while ((match = selectRegex.exec(content)) !== null) {
    if (arrayFieldNames.has(match[1])) continue // Skip if already array
    selectHasMany.push({
      fieldName: match[1],
      tableName: `${slug}_${toSnakeCase(match[1])}`,
    })
  }

  // Find group fields
  const groupRegex = /name:\s*['"](\w+)['"]\s*,\s*\n\s*type:\s*['"]group['"]/g
  while ((match = groupRegex.exec(content)) !== null) {
    groups.push({ fieldName: match[1], prefix: toSnakeCase(match[1]) })
  }

  return { arrays, selectHasMany, groups }
}

// ─── Check migrations content ──────────────────────────────────────────
function getMigrationContent() {
  return fs.readFileSync(DB_SETUP_PATH, 'utf8')
}

function getMigrationColumns(content) {
  const columns = new Set()
  const regex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    columns.add(`${match[1]}.${match[2]}`)
  }
  return columns
}

function getCreateTables(content) {
  const tables = {}
  // Match CREATE TABLE IF NOT EXISTS xxx ( ... )
  const regex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    const tableName = match[1]
    const columnDefs = match[2]
    tables[tableName] = {
      raw: columnDefs,
      columns: {},
    }

    // Parse column definitions
    const colRegex = /["']?(\w+)["']?\s+(varchar|integer|serial|int|timestamptz|boolean|numeric|jsonb|text)/gi
    let colMatch
    while ((colMatch = colRegex.exec(columnDefs)) !== null) {
      tables[tableName].columns[colMatch[1]] = colMatch[2].toLowerCase()
    }
  }
  return tables
}

// ─── Validation ────────────────────────────────────────────────────────
function validateArrayTable(tableName, fieldInfo, createTables, errors) {
  if (!createTables[tableName]) {
    // Table not in manual migrations — Payload pushDevSchema handles it
    // Only warn, don't block (pushDevSchema creates most array tables automatically)
    return
  }

  const table = createTables[tableName]

  // Check id type — MUST be varchar (UUID), NOT serial
  if (table.columns.id === 'serial' || table.columns.id === 'integer') {
    errors.push({
      severity: '🔴 BLOCKER',
      message: `Table "${tableName}": id is "${table.columns.id}" but Payload uses VARCHAR (UUID)`,
      fix: `Change "id serial PRIMARY KEY" to "id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text"`,
    })
  }

  // Check _parent_id (with underscore)
  if (!table.columns._parent_id && table.columns.parent_id) {
    errors.push({
      severity: '🔴 BLOCKER',
      message: `Table "${tableName}": has "parent_id" but Payload array tables use "_parent_id" (with underscore)`,
      fix: `Rename "parent_id" to "_parent_id"`,
    })
  }

  // Check _order (with underscore)
  if (!table.columns._order && table.columns.order) {
    errors.push({
      severity: '🟡 WARNING',
      message: `Table "${tableName}": has "order" but Payload array tables use "_order" (with underscore)`,
      fix: `Rename "order" to "_order"`,
    })
  }

  // Check _uuid exists
  if (!table.columns._uuid) {
    errors.push({
      severity: '🟡 WARNING',
      message: `Table "${tableName}": missing "_uuid" column (required for Payload array tables)`,
      fix: `Add column: _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text`,
    })
  }
}

function validateSelectTable(tableName, fieldInfo, createTables, errors) {
  if (!createTables[tableName]) {
    // Select hasMany tables may be auto-created by Payload — warning only
    return
  }

  const table = createTables[tableName]

  // Check parent_id (NO underscore for select hasMany)
  if (table.columns._parent_id && !table.columns.parent_id) {
    errors.push({
      severity: '🔴 BLOCKER',
      message: `Table "${tableName}": has "_parent_id" but Payload select hasMany uses "parent_id" (NO underscore)`,
      fix: `Rename "_parent_id" to "parent_id"`,
    })
  }

  // Check order (NO underscore for select hasMany)
  if (table.columns._order && !table.columns.order) {
    errors.push({
      severity: '🟡 WARNING',
      message: `Table "${tableName}": has "_order" but Payload select hasMany uses "order" (NO underscore)`,
      fix: `Rename "_order" to "order"`,
    })
  }
}

// ─── Check new fields (existing logic) ─────────────────────────────────
function getNewFieldsFromDiff() {
  const newFields = []
  for (const [filename, tableName] of Object.entries(TRACKED_COLLECTIONS)) {
    const filePath = `src/collections/${filename}`
    try {
      const diff = execSync(
        `git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" | grep "name:" || true`,
        { encoding: 'utf8' }
      ).trim()
      if (!diff) continue
      const regex = /name:\s*['"](\w+)['"]/g
      let match
      while ((match = regex.exec(diff)) !== null) {
        newFields.push({ field: match[1], snake: toSnakeCase(match[1]), table: tableName, file: filename })
      }
    } catch { /* skip */ }
  }
  return newFields
}

// ─── Main ──────────────────────────────────────────────────────────────
function main() {
  console.log(`[migration-check] Comparing against ${BASE_BRANCH}...`)
  console.log('[migration-check] Validating Payload naming conventions...\n')

  const content = getMigrationContent()
  const migrationColumns = getMigrationColumns(content)
  const createTables = getCreateTables(content)
  const errors = []

  // ── Phase 1: Validate existing CREATE TABLEs match Payload conventions ──
  for (const [filename, slug] of Object.entries(TRACKED_COLLECTIONS)) {
    const { arrays, selectHasMany } = parseCollectionFields(filename)

    for (const arr of arrays) {
      validateArrayTable(arr.tableName, arr, createTables, errors)
    }

    for (const sel of selectHasMany) {
      validateSelectTable(sel.tableName, sel, createTables, errors)
    }
  }

  // ── Phase 2: Check new fields have migrations (existing logic) ──
  const newFields = getNewFieldsFromDiff()

  if (newFields.length > 0) {
    console.log(`[migration-check] Found ${newFields.length} new field(s) in PR:`)
    for (const f of newFields) {
      console.log(`   ${f.table}.${f.snake} (${f.field} in ${f.file})`)
    }

    const missing = newFields.filter(f => !migrationColumns.has(`${f.table}.${f.snake}`))
    for (const f of missing) {
      // Skip array/group fields — they have their own validation
      const { arrays, groups } = parseCollectionFields(f.file)
      const isArray = arrays.some(a => a.fieldName === f.field)
      const isGroup = groups.some(g => g.fieldName === f.field)
      if (isArray || isGroup) continue

      errors.push({
        severity: '🔴 BLOCKER',
        message: `New field "${f.table}.${f.snake}" (from ${f.file}) has no matching migration`,
        fix: `Add to db-setup.js: { name: '${f.table}.${f.snake}', sql: 'ALTER TABLE ${f.table} ADD COLUMN IF NOT EXISTS ${f.snake} varchar;' }`,
      })
    }
  }

  // ── Phase 3: Validate COLLECTION_SLUGS covers all collections ──
  const allCollectionFiles = fs.readdirSync(COLLECTIONS_DIR).filter(f => f.endsWith('.ts'))
  const collectionSlugs = []
  for (const file of allCollectionFiles) {
    const fileContent = fs.readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8')
    // Only match the collection-level slug (inside CollectionConfig export), not block slugs
    const collectionMatch = fileContent.match(/(?:CollectionConfig|Collection)\s*=\s*\{[\s\S]*?slug:\s*['"]([^'"]+)['"]/)
    if (collectionMatch) collectionSlugs.push({ slug: collectionMatch[1], file })
  }

  // Extract COLLECTION_SLUGS array from db-setup.js
  const slugArrayMatch = content.match(/COLLECTION_SLUGS\s*=\s*\[([\s\S]*?)\]/)
  if (slugArrayMatch) {
    const declaredSlugs = new Set(
      slugArrayMatch[1].match(/['"]([^'"]+)['"]/g)?.map(s => s.replace(/['"]/g, '').replace(/-/g, '_')) || []
    )

    for (const { slug, file } of collectionSlugs) {
      const normalizedSlug = slug.replace(/-/g, '_')
      if (!declaredSlugs.has(normalizedSlug)) {
        errors.push({
          severity: '🔴 BLOCKER',
          message: `Collection "${slug}" (${file}) is missing from COLLECTION_SLUGS in db-setup.js`,
          fix: `Add '${slug.replace(/-/g, '_')}' to the COLLECTION_SLUGS array in scripts/db-setup.js`,
        })
      }
    }
  }

  // ── Phase 4: Validate every collection has CREATE TABLE in db-setup.js ──
  // Payload pushDevSchema is unreliable in Docker standalone — manual CREATE TABLE required.
  // Payload-managed tables (users, media, pages, payload_*) are excluded — created by Payload init.
  const PAYLOAD_MANAGED_TABLES = new Set([
    'users', 'media', 'pages', 'tenants', 'sites', 'products', 'orders',
    'templates', 'analytics', 'subscriptions',
    // Payload system tables
    'payload_preferences', 'payload_migrations', 'payload_locked_documents',
  ])

  for (const { slug, file } of collectionSlugs) {
    const tableName = slug.replace(/-/g, '_')
    if (PAYLOAD_MANAGED_TABLES.has(tableName)) continue
    if (!createTables[tableName]) {
      errors.push({
        severity: '🔴 BLOCKER',
        message: `Collection "${slug}" (${file}) has no CREATE TABLE in db-setup.js — table won't exist on staging`,
        fix: `Add CREATE TABLE IF NOT EXISTS ${tableName} (...) to MIGRATIONS in scripts/db-setup.js`,
      })
    }
  }

  // Check array field tables exist for ALL collections
  // NOTE: Only checks top-level array fields. Nested arrays (e.g. variantConfigs.options)
  // and group-prefixed arrays (e.g. seo.trackedKeywords → sites_seo_tracked_keywords)
  // are verified by checking db-setup.js has CREATE TABLE for any table starting with {slug}_
  for (const file of allCollectionFiles) {
    const fileContent = fs.readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8')
    const collectionMatch = fileContent.match(/(?:CollectionConfig|Collection)\s*=\s*\{[\s\S]*?slug:\s*['"]([^'"]+)['"]/)
    if (!collectionMatch) continue
    const collSlug = collectionMatch[1].replace(/-/g, '_')

    // Skip Payload-managed collections (users, pages — complex array structures handled by Payload)
    if (['users', 'pages'].includes(collSlug)) continue

    // Find top-level array fields only (name directly followed by type on next line)
    const arrayRegex = /name:\s*['"](\w+)['"],\s*\n\s*type:\s*['"]array['"]/g
    let arrMatch
    while ((arrMatch = arrayRegex.exec(fileContent)) !== null) {
      const fieldName = arrMatch[1]
      const snakeName = toSnakeCase(fieldName)
      const possibleTableNames = [
        `${collSlug}_${snakeName}`,           // Direct: products_images
        `${collSlug}_${snakeName}s`,          // Pluralized: products_tag → products_tags (unlikely)
      ]

      // Also check if this is inside a group — look for group prefix in CREATE TABLEs
      // Check if table exists — also check nested patterns (e.g. products_variant_configs_options)
      const hasMatchingTable = possibleTableNames.some(t => createTables[t]) ||
        Object.keys(createTables).some(t => t.startsWith(`${collSlug}_`) && t.includes(snakeName)) ||
        Object.keys(createTables).some(t => t.endsWith(`_${snakeName}`) && t.startsWith(`${collSlug}_`))

      if (!hasMatchingTable) {
        errors.push({
          severity: '🔴 BLOCKER',
          message: `Array field "${collSlug}.${fieldName}" needs table but no matching CREATE TABLE found in db-setup.js`,
          fix: `Add CREATE TABLE IF NOT EXISTS ${collSlug}_${snakeName} (id varchar PK, _order int, _parent_id int, _uuid varchar, ...) to db-setup.js`,
        })
      }
    }
  }

  // ── Phase 5: Check for DROP TABLE (dangerous) ──
  const dropRegex = /DROP TABLE/gi
  if (dropRegex.test(content)) {
    const dropMatches = content.match(/DROP TABLE IF EXISTS\s+(\w+)/gi) || []
    for (const d of dropMatches) {
      errors.push({
        severity: '🔴 BLOCKER',
        message: `DROP TABLE found in migrations: "${d}" — this will DELETE data on every deploy`,
        fix: `Replace with CREATE TABLE IF NOT EXISTS (idempotent, safe)`,
      })
    }
  }

  // ── Report ──
  const blockers = errors.filter(e => e.severity.includes('BLOCKER'))
  const warnings = errors.filter(e => e.severity.includes('WARNING'))

  if (errors.length === 0) {
    console.log('\n[migration-check] ✅ All migrations valid — Payload conventions OK')
    if (newFields.length === 0) {
      console.log('[migration-check] ✅ No new collection fields detected')
    }
    process.exit(0)
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):\n`)
    for (const w of warnings) {
      console.log(`  ${w.severity} ${w.message}`)
      console.log(`    Fix: ${w.fix}\n`)
    }
  }

  if (blockers.length > 0) {
    console.error(`\n❌ ${blockers.length} blocker(s) — PR will be blocked:\n`)
    for (const b of blockers) {
      console.error(`  ${b.severity} ${b.message}`)
      console.error(`    Fix: ${b.fix}\n`)
    }
    console.error('─── Payload Naming Convention Reference ───')
    console.error('Array fields:        id VARCHAR, _order INT, _parent_id INT, _uuid VARCHAR')
    console.error('Select hasMany:      id SERIAL, order INT, parent_id INT, value VARCHAR')
    console.error('Group fields:        {group}_{field} in same table')
    console.error('────────────────────────────────────────────\n')
    process.exit(1)
  }

  // Warnings only — pass but log
  console.log('\n[migration-check] ✅ Pass (with warnings)')
  process.exit(0)
}

main()
