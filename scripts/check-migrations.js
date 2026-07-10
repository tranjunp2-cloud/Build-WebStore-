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
 * VERSION COLUMN RULE (Pages.ts top-level fields):
 * When a new top-level field is added to the Pages collection (not inside blocks),
 * a matching `version_*` column must exist in `_pages_v` table:
 *   - pages.isVisible → _pages_v.version_is_visible
 *   - pages.deletedAt → _pages_v.version_deleted_at
 * Forgetting this causes Payload draft queries to crash with 42703 (column does not exist).
 *
 * BASELINE DRIFT (opt-in: --baseline flag):
 * The default check only catches fields ADDED in the current PR diff. Fields that
 * existed in the baseline commit WITHOUT a matching migration slip through forever.
 * Pass `--baseline` to scan every field in TRACKED_COLLECTIONS and WARN when no
 * ALTER TABLE / CREATE TABLE column covers it. Warnings only — never fails CI —
 * because Payload's historical pushDevSchema may have seeded columns that have
 * no corresponding migration. Dev uses this mode to audit; real missing columns
 * surface as INSERT 500s on staging. See plans/reports/drift-audit-*.md.
 *
 * Usage:
 *   node scripts/check-migrations.js [base-branch]     # diff check (CI default)
 *   node scripts/check-migrations.js --baseline        # additionally warn on baseline drift
 *
 * Exit 0 = ok (no new fields, or all have migrations)
 * Exit 1 = new fields found without migrations (diff check only; baseline never fails)
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const rawArgs = process.argv.slice(2)
const BASELINE_MODE = rawArgs.includes('--baseline')
const BASE_BRANCH = rawArgs.find((a) => !a.startsWith('--')) || 'origin/staging'
const DB_SETUP_PATH = path.join(__dirname, 'db-setup.js')

// Tables we track migrations for — ALL collections with DB tables
const TRACKED_COLLECTIONS = {
  'Tenants.ts': 'tenants',
  'Users.ts': 'users',
  'Sites.ts': 'sites',
  'Pages.ts': 'pages',
  'Media.ts': 'media',
  'Templates.ts': 'templates',
  'Subscriptions.ts': 'subscriptions',
  'Subscribers.ts': 'subscribers',
  'Products.ts': 'products',
  'Orders.ts': 'orders',
  'Analytics.ts': 'analytics',
  'SEOMetaJobs.ts': 'seo_meta_jobs',
  'Blogs.ts': 'blogs',
  'BlogCategories.ts': 'blog_categories',
  'Categories.ts': 'categories',
  'Notifications.ts': 'notifications',
  'Discounts.ts': 'discounts',
  'DiscountUsageHistory.ts': 'discount_usage_history',
}

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

/**
 * Scan the CURRENT full file (not just diff `+` lines) for field names nested
 * inside an `array`-typed ancestor anywhere in the file. Used as a safety-net
 * alongside the diff-only scope-stack in getNewFieldsFromDiff(): that stack
 * only sees ADDED lines, so if a PR touches only a field NESTED inside an
 * array (e.g. adds `validate:` to `opens`/`closes`) without touching the
 * array's own `name`/`type: 'array'` lines, the diff-only stack never learns
 * the field is array-nested and wrongly flags it as a new top-level column.
 * Reading the full file gives complete nesting context regardless of which
 * lines changed. Same algorithm as the diff-only stack, applied to all lines.
 */
function getArrayNestedFieldNames(source) {
  const skip = new Set()
  const lines = source.split('\n')
  const scopeStack = [] // { indent, type }
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(/^(\s*)name:\s*['"](\w+)['"]/)
    if (!nameMatch) continue
    const indent = nameMatch[1].length
    const fieldName = nameMatch[2]

    while (scopeStack.length && scopeStack[scopeStack.length - 1].indent >= indent) {
      scopeStack.pop()
    }

    if (scopeStack.some((s) => s.type === 'array')) {
      skip.add(fieldName)
    }

    let ownType = null
    const inlineTypeMatch = lines[i].match(/type:\s*['"](\w+)['"]/)
    if (inlineTypeMatch) {
      ownType = inlineTypeMatch[1]
    } else {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 8); j++) {
        if (j === i) continue
        const typeMatch = lines[j].match(/^(\s*)type:\s*['"](\w+)['"]/)
        if (typeMatch && typeMatch[1].length === indent) {
          ownType = typeMatch[2]
          break
        }
      }
    }

    if (ownType === 'group' || ownType === 'array') {
      scopeStack.push({ indent, type: ownType })
    }
  }
  return skip
}

function getNewFieldsFromDiff() {
  const newFields = []

  for (const [filename, tableName] of Object.entries(TRACKED_COLLECTIONS)) {
    const filePath = `src/collections/${filename}`

    try {
      // Pages.ts has a unique shape handled by checkNewPagesBlockFields.
      if (filename === 'Pages.ts') continue

      // Get full added-line diff to detect group fields (groups don't create DB columns).
      const fullDiff = execSync(
        `git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" || true`,
        { encoding: 'utf8' }
      ).trim()

      if (!fullDiff) continue

      // Identify fields to skip when extracting new top-level columns:
      // - Fields typed 'group'/'array' themselves (no direct column on this table).
      // - Fields nested inside an 'array' ancestor (array-row fields live in a
      //   separate {collection}_..._{field} table, never a column on this table).
      // Group sub-fields are NOT skipped — they map to prefixed columns on this
      // same table, matched via KNOWN_GROUP_PREFIXES in getMigrationColumns().
      const diffLines = fullDiff.split('\n')
      const skipFieldNames = new Set()
      const scopeStack = [] // { indent, type }
      for (let i = 0; i < diffLines.length; i++) {
        // Support both multi-line (`name:` starts the line) and compact
        // single-line (`{ name: 'x', type: 'y' },`) field definitions —
        // indent = leading whitespace after '+'; `name:` may appear anywhere
        // after that on the same added line.
        const wsMatch = diffLines[i].match(/^\+(\s*)/)
        if (!wsMatch) continue
        const nameMatch = diffLines[i].slice(1).match(/name:\s*['"](\w+)['"]/)
        if (!nameMatch) continue
        const indent = wsMatch[1].length
        const fieldName = nameMatch[1]

        // Pop scopes we've exited (same or shallower indent than this field).
        while (scopeStack.length && scopeStack[scopeStack.length - 1].indent >= indent) {
          scopeStack.pop()
        }

        // Nested inside an array ancestor → array-row field, different table.
        if (scopeStack.some((s) => s.type === 'array')) {
          skipFieldNames.add(fieldName)
        }

        // Determine this field's own type — same line first (compact form),
        // then fall back to nearby lines at the same indent (multi-line form).
        let ownType = null
        const inlineTypeMatch = diffLines[i].match(/type:\s*['"](\w+)['"]/)
        if (inlineTypeMatch) {
          ownType = inlineTypeMatch[1]
        } else {
          for (let j = Math.max(0, i - 2); j <= Math.min(diffLines.length - 1, i + 8); j++) {
            if (j === i) continue
            const typeMatch = diffLines[j].match(/^\+(\s*)type:\s*['"](\w+)['"]/)
            if (typeMatch && typeMatch[1].length === indent) {
              ownType = typeMatch[2]
              break
            }
          }
        }

        if (ownType === 'group' || ownType === 'array') {
          skipFieldNames.add(fieldName) // groups/arrays have no direct column themselves
          scopeStack.push({ indent, type: ownType })
        }
      }

      // Safety-net: the diff-only scope-stack above misses array-nesting when
      // a PR only touches a field INSIDE an array without touching the array's
      // own `name`/`type: 'array'` lines (those then never appear as `+` lines,
      // so the stack never learns the field is array-nested). Cross-check
      // against the full current file, which has complete nesting context
      // regardless of which lines changed.
      const currentFilePath = path.join(__dirname, '..', filePath)
      if (fs.existsSync(currentFilePath)) {
        const fullFileContent = fs.readFileSync(currentFilePath, 'utf8')
        for (const name of getArrayNestedFieldNames(fullFileContent)) {
          skipFieldNames.add(name)
        }
      }

      // Extract field names from added `name:` lines, skipping group/array
      // fields and any field nested inside an array.
      const nameDiff = diffLines.filter(l => l.includes('name:')).join('\n')
      const regex = /name:\s*['"](\w+)['"]/g
      let match
      while ((match = regex.exec(nameDiff)) !== null) {
        if (skipFieldNames.has(match[1])) continue
        newFields.push({
          field: match[1],
          snake: toSnakeCase(match[1]),
          table: tableName,
          file: filename,
        })
      }
    } catch (err) {
      console.error(`[migration-check] Warning: could not diff ${filePath}:`, err.message)
    }
  }

  // Also check: if a NEW collection file has timestamps: true,
  // the CREATE TABLE must include updated_at + created_at columns
  for (const [filename, tableName] of Object.entries(TRACKED_COLLECTIONS)) {
    const filePath = `src/collections/${filename}`
    try {
      const diff = execSync(
        `git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" | grep "timestamps" || true`,
        { encoding: 'utf8' }
      ).trim()
      if (diff && diff.includes('timestamps') && diff.includes('true')) {
        newFields.push({ field: 'updated_at', snake: 'updated_at', table: tableName, file: filename })
        newFields.push({ field: 'created_at', snake: 'created_at', table: tableName, file: filename })
      }
    } catch { /* ignore */ }
  }

  return newFields
}

// Known Payload group field prefixes — only strip these when matching migrations.
// When a column like `payment_config_merchant_qr_code_id` exists, also register
// the unprefixed form `merchant_qr_code_id` and (for uploads) `merchant_qr_code`.
const KNOWN_GROUP_PREFIXES = [
  'theme', 'seo', 'payments', 'badge', 'ai_generation_metadata',
  'payment_config', 'shipping_config', 'local_business',
  // F36 EasyParcel (GH-1333): Tenants.easyParcelIntegration group → prefixed columns
  'easy_parcel_integration',
]

function getMigrationColumns() {
  const content = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  const columns = new Set()

  // Match ALTER TABLE xxx ADD COLUMN IF NOT EXISTS yyy <type>
  // Capture the type word so we can scope _id-strip logic to integer FK columns only.
  const regex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)\s*(\w+)?/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    const table = match[1]
    const col = match[2]
    const colType = (match[3] || '').toLowerCase()
    columns.add(`${table}.${col}`)
    // Also register without known group prefix (e.g., payment_config_enable_cod → enable_cod).
    // For upload/relationship columns ending in _id, also register without the _id suffix
    // so diff-based checks (which use bare field names) can match them.
    for (const prefix of KNOWN_GROUP_PREFIXES) {
      if (col.startsWith(`${prefix}_`)) {
        const withoutPrefix = col.slice(prefix.length + 1)
        columns.add(`${table}.${withoutPrefix}`)
        if (withoutPrefix.endsWith('_id')) {
          columns.add(`${table}.${withoutPrefix.slice(0, -3)}`)
        }
        break
      }
    }
    // Standalone relationship/upload FK columns: also register bare name for diff-based checks.
    // Scoped to integer type only — varchar _id columns (e.g. stripe_account_id) are NOT FK aliases.
    if (col.endsWith('_id') && colType === 'integer') {
      columns.add(`${table}.${col.slice(0, -3)}`)
    }
  }

  return columns
}

function getMigrationTables() {
  const content = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  const tables = new Set()

  // Match CREATE TABLE IF NOT EXISTS "xxx" or xxx (supports hyphens in quoted names)
  const regex = /CREATE TABLE IF NOT EXISTS\s+"?([\w-]+)"?/gi
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
  } catch (err) {
    console.error(`[migration-check] Warning: could not diff ${filePath}:`, err.message)
  }

  return slugs
}

/**
 * Check 3: New top-level fields added to Pages collection need `_pages_v.version_*` migrations.
 *
 * When Payload CMS runs versioning/drafts, it queries `_pages_v` for every
 * column that exists in `pages`. If a new top-level field is added to the
 * Pages collection WITHOUT a corresponding `_pages_v.version_*` column,
 * the editor shows "0 blocks" and logs 42703 (column does not exist).
 *
 * This check detects new fields at the Pages collection level (12-space indent
 * in Pages.ts) and verifies `ALTER TABLE _pages_v ADD COLUMN version_* ...`
 * exists in db-setup.js.
 *
 * Skips:
 * - Fields Payload auto-manages: title, slug, site, isHomepage, layout, seo, timestamps
 * - Field types handled differently by Payload: group (flattened columns),
 *   array (separate table), blocks (separate table), relationship/upload (FK column)
 *   — these do NOT create a simple version_* column in _pages_v.
 */
const PAGES_AUTO_COLUMNS = new Set([
  'title', 'slug', 'site', 'isHomepage', 'layout',
  'seo', 'publishedAt', 'updatedAt', 'createdAt',
])

// Field types that do NOT produce a simple version_* column in _pages_v.
// group → Payload flattens sub-fields directly (version_group_field)
// array/blocks → separate _pages_v_{field} or _pages_v_blocks_{slug} tables
// relationship/upload → version_{field}_id FK column (Payload auto-manages)
const SKIP_FIELD_TYPES = new Set(['group', 'array', 'blocks', 'relationship', 'upload'])

function checkPagesVersionColumns() {
  const filePath = 'src/collections/Pages.ts'
  const missing = []

  let diff
  try {
    diff = execSync(
      `git diff ${BASE_BRANCH} -- ${filePath}`,
      { encoding: 'utf8' }
    ).trim()
  } catch (err) {
    console.error(`[migration-check] Warning: could not diff ${filePath}:`, err.message)
    return missing
  }

  if (!diff) return missing

  // Collection-level fields in Pages.ts have exactly 12 spaces of indentation.
  // Block-level fields have 16+ spaces. This distinguishes the two.
  // Pattern: +            name: 'fieldName'  (12 spaces)
  // Collect all collection-level field matches first so we know each field's
  // exact text boundary (from its name: to the next name: at the same indent).
  const collectionFieldRegex = /^\+            name:\s*['"]([a-zA-Z0-9_]+)['"]/gm
  const fieldMatches = []
  let m
  while ((m = collectionFieldRegex.exec(diff)) !== null) {
    fieldMatches.push({ name: m[1], index: m.index })
  }

  const columns = getMigrationColumns()
  const seen = new Set()

  for (let i = 0; i < fieldMatches.length; i++) {
    const { name: fieldName, index: startIdx } = fieldMatches[i]
    const endIdx = i + 1 < fieldMatches.length ? fieldMatches[i + 1].index : diff.length
    const fieldBlock = diff.slice(startIdx, endIdx)

    if (seen.has(fieldName)) continue
    seen.add(fieldName)

    // Skip fields that Payload auto-manages in _pages_v or handles specially
    if (PAGES_AUTO_COLUMNS.has(fieldName)) continue

    // Skip field types that do not produce a simple version_* column.
    // Parse type: from the field's own block (between this name: and the next one),
    // so we never accidentally read a sibling field's type.
    const typeMatch = fieldBlock.match(/type:\s*['"]([a-zA-Z]+)['"]/)
    if (typeMatch && SKIP_FIELD_TYPES.has(typeMatch[1])) continue

    const snake = toSnakeCase(fieldName)
    const versionCol = `version_${snake}`
    if (!columns.has(`_pages_v.${versionCol}`)) {
      missing.push({ field: fieldName, snake, versionCol })
    }
  }

  return missing
}

/**
 * Check 4 — new fields added inside an existing Pages.ts block definition
 * (e.g. `variant` added to ContactBlock) need a matching
 * `pages_blocks_{slug}.{field}` migration in db-setup.js. The generic
 * tracked-collection field extractor cannot tell the difference between
 * a top-level Pages field and a nested block field, so Pages.ts is
 * handled explicitly here: we walk the source file to map line numbers
 * to the enclosing `const XxxBlock = { slug: 'xxx', ... }` definition,
 * then check the current diff's added `name: 'field'` lines against
 * those ranges.
 */
function checkNewPagesBlockFields() {
  const filePath = 'src/collections/Pages.ts'
  const missing = []

  let diff
  try {
    diff = execSync(
      `git diff ${BASE_BRANCH} -- ${filePath}`,
      { encoding: 'utf8' }
    ).trim()
  } catch (err) {
    console.error(`[migration-check] Warning: could not diff ${filePath}:`, err.message)
    return missing
  }
  if (!diff) return missing

  // Parse the CURRENT file content to find block boundaries.
  const source = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8')
  const lines = source.split('\n')

  // Locate each `const XxxBlock = {` declaration, then find the slug
  // literal that immediately follows inside that definition. Track the
  // line range from the const declaration to the matching closing `}`.
  const blockRanges = [] // { slug, startLine, endLine }
  for (let i = 0; i < lines.length; i++) {
    const declMatch = lines[i].match(/^const\s+\w+Block\s*=\s*\{/)
    if (!declMatch) continue
    // Find the matching closing brace at column 0.
    let endLine = lines.length - 1
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === '}' || lines[j].startsWith('} ')) {
        endLine = j
        break
      }
    }
    // Find the slug literal within this block definition.
    let slug = null
    for (let k = i + 1; k <= endLine; k++) {
      const slugMatch = lines[k].match(/slug:\s*['"]([a-zA-Z0-9_-]+)['"]/)
      if (slugMatch) {
        slug = slugMatch[1]
        break
      }
    }
    if (slug) blockRanges.push({ slug, startLine: i + 1, endLine: endLine + 1 })
  }

  // Walk the diff and, for each added `name: 'field'`, find the hunk
  // anchor (`@@ -a,b +c,d @@`) so we can map the added line to a line
  // number in the current file; then resolve which block owns it.
  const columns = getMigrationColumns()
  const diffLines = diff.split('\n')
  let currentPlusLine = 0
  for (const line of diffLines) {
    const hunk = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)/)
    if (hunk) {
      currentPlusLine = parseInt(hunk[1], 10)
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedLineNumber = currentPlusLine
      currentPlusLine++
      const nameMatch = line.match(/name:\s*['"](\w+)['"]/)
      if (!nameMatch) continue
      const fieldName = nameMatch[1]
      // Find the enclosing block range.
      const owner = blockRanges.find(
        (b) => addedLineNumber >= b.startLine && addedLineNumber <= b.endLine,
      )
      if (!owner) continue // outside any block definition — collection-level fields handled by checkPagesVersionColumns
      // Skip Payload-managed block auto-fields.
      if (['id', 'blockType', 'blockName'].includes(fieldName)) continue
      const snake = toSnakeCase(fieldName)
      const snakeSlug = owner.slug.replace(/-/g, '_')
      const liveTable = `pages_blocks_${snakeSlug}`
      const versionTable = `_pages_v_blocks_${snakeSlug}`
      if (!columns.has(`${liveTable}.${snake}`)) {
        missing.push({ blockSlug: owner.slug, field: fieldName, snake, table: liveTable })
      }
      if (!columns.has(`${versionTable}.${snake}`)) {
        missing.push({ blockSlug: owner.slug, field: fieldName, snake, table: versionTable })
      }
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      currentPlusLine++
    }
  }

  // Dedup — one field may show up in multiple diff hunks.
  const seen = new Set()
  return missing.filter((m) => {
    const key = `${m.table}.${m.snake}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function checkNewBlocks() {
  const newSlugs = getNewBlockSlugsFromDiff()
  if (newSlugs.length === 0) return []

  const tables = getMigrationTables()
  const missing = []

  for (const slug of newSlugs) {
    // Payload Drizzle converts kebab-case slugs to snake_case table names
    const snakeSlug = slug.replace(/-/g, '_')
    const liveTable = `pages_blocks_${snakeSlug}`
    const versionTable = `_pages_v_blocks_${snakeSlug}`

    if (!tables.has(liveTable)) {
      missing.push({ slug, table: liveTable, type: 'live' })
    }
    if (!tables.has(versionTable)) {
      missing.push({ slug, table: versionTable, type: 'version' })
    }
  }

  return missing
}

/**
 * Baseline drift check — scan every field in every tracked collection,
 * classify by Payload Drizzle convention, then warn if no column is covered
 * by an ALTER TABLE migration OR a CREATE TABLE body.
 *
 * Heuristics (because regex, not a TS AST):
 * - Fields are detected by `name: 'xxx'` lines. The following `type:` at the
 *   same indentation is the field's type.
 * - Groups push a prefix onto a stack keyed by indent; sub-fields deeper than
 *   that indent inherit `{group}_` in their expected column name.
 * - Skipped: array / blocks / select hasMany (separate tables — other checks
 *   handle those), richText / json / code / point / ui / tabs / row / collapsible
 *   (either Drizzle-special or presentational).
 * - Relationships and uploads: expected column is `{field}_id`.
 *
 * Known false-positive sources:
 * - Columns that Payload's historical `pushDevSchema` created on staging but
 *   never got a matching ALTER TABLE in db-setup.js. These appear as warnings
 *   even though the live DB has the column. Dev confirms via psql when in doubt.
 */
const SCALAR_FIELD_TYPES = new Set([
  'text', 'textarea', 'email', 'code', 'number', 'date', 'checkbox',
  'select', 'richText', 'json',
])
const SKIP_TYPES = new Set([
  'array', 'blocks', 'ui', 'tabs', 'row', 'collapsible', 'group', 'point',
])
const PAYLOAD_AUTO_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', '_status', '_verified', '_verificationToken',
])

function extractCollectionFields(source) {
  const out = []
  const lines = source.split('\n')
  // Stack of active groups: [{ name, indent }]. We pop when we see a field at
  // indent <= the group's indent (i.e. back at group's own level or above).
  const groupStack = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nameMatch = line.match(/^(\s*)name:\s*['"]([\w]+)['"]/)
    if (!nameMatch) continue
    const indent = nameMatch[1].length
    const fieldName = nameMatch[2]

    // Skip `name:` that sits inside an admin block, options array, validate fn,
    // etc. by requiring a sibling `type:` at the same indent within a few lines.
    let type = null
    for (let j = i - 2; j <= i + 8; j++) {
      if (j < 0 || j >= lines.length || j === i) continue
      const tMatch = lines[j].match(/^(\s*)type:\s*['"]([\w]+)['"]/)
      if (tMatch && tMatch[1].length === indent) {
        type = tMatch[2]
        break
      }
    }
    if (!type) continue

    // Close groups whose indent is >= this field's indent (we've exited them).
    while (groupStack.length && groupStack[groupStack.length - 1].indent >= indent) {
      groupStack.pop()
    }

    const prefix = groupStack.map((g) => toSnakeCase(g.name)).join('_')
    out.push({ name: fieldName, type, prefix })

    if (type === 'group') {
      groupStack.push({ name: fieldName, indent })
    }
  }

  return out
}

function isColumnCovered(fullDbSetupText, migrationColumns, table, column) {
  if (migrationColumns.has(`${table}.${column}`)) return true
  // Heuristic: grep the column name inside a `CREATE TABLE IF NOT EXISTS <table>`
  // body. Uses [\s\S]*? to search across lines up to the matching `;`.
  const re = new RegExp(
    `CREATE TABLE IF NOT EXISTS\\s+"?${table}"?\\s*\\([\\s\\S]*?\\b${column}\\b[\\s\\S]*?\\);`,
    'i',
  )
  return re.test(fullDbSetupText)
}

function checkBaselineDrift() {
  const warnings = []
  const fullText = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  const migrationColumns = getMigrationColumns()
  const migrationTables = getMigrationTables()

  for (const [filename, tableName] of Object.entries(TRACKED_COLLECTIONS)) {
    if (filename === 'Pages.ts') continue // complex, handled by checkNewPagesBlockFields
    const filePath = path.join(__dirname, '..', 'src', 'collections', filename)
    if (!fs.existsSync(filePath)) continue

    const source = fs.readFileSync(filePath, 'utf8')
    const fields = extractCollectionFields(source)

    for (const field of fields) {
      if (PAYLOAD_AUTO_FIELDS.has(field.name)) continue
      if (SKIP_TYPES.has(field.type) && field.type !== 'group') continue

      // Arrays / select hasMany → expect separate table (not column). We only
      // flag when the expected table is missing. For KISS, defer array table
      // auditing — existing checkNewBlocks handles block tables; array tables
      // rarely drift. Skip for now.
      if (field.type === 'array') continue

      // Groups themselves don't have a column; their sub-fields do.
      if (field.type === 'group') continue

      const snake = toSnakeCase(field.name)
      const prefixedSnake = field.prefix ? `${field.prefix}_${snake}` : snake

      // Build candidate column names by type.
      const candidates = []
      if (['relationship', 'upload'].includes(field.type)) {
        candidates.push(`${prefixedSnake}_id`)
      } else if (SCALAR_FIELD_TYPES.has(field.type)) {
        candidates.push(prefixedSnake)
      } else {
        // Unknown/unsupported type — skip silently.
        continue
      }

      const covered = candidates.some((c) =>
        isColumnCovered(fullText, migrationColumns, tableName, c),
      )
      if (covered) continue

      warnings.push({
        collection: filename,
        table: tableName,
        field: field.name,
        group: field.prefix || null,
        type: field.type,
        expectedColumn: `${tableName}.${candidates[0]}`,
      })
    }
  }

  return warnings
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

  // ── Check 2: New Pages.ts top-level fields need _pages_v version columns ──
  const missingVersionCols = checkPagesVersionColumns()
  if (missingVersionCols.length > 0) {
    hasErrors = true
    console.error(`\n❌ New Pages collection field(s) detected without _pages_v version column migrations:\n`)
    for (const v of missingVersionCols) {
      console.error(`   Missing: _pages_v.${v.versionCol}  (from field "${v.field}")`)
      console.error(`   → Add to scripts/db-setup.js MIGRATIONS:`)
      console.error(`     { name: '_pages_v.${v.versionCol}',`)
      console.error(`       sql: \`ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS ${v.versionCol} varchar;\` },`)
      console.error()
    }
    console.error('💡 RULE: Every new top-level Pages field needs a _pages_v version column.')
    console.error('   Without it, Payload draft queries (editor) will crash with 42703.')
    console.error('   Adjust the column type (boolean/timestamptz/jsonb/integer) as needed.\n')
  }

  // ── Check 3: New fields in tracked collections ───────────────────────
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
  } else if (missingBlockTables.length === 0 && missingVersionCols.length === 0) {
    console.log('[migration-check] ✅ No new collection fields or block types detected')
  }

  // ── Check 4 (opt-in): Baseline drift audit ───────────────────────────
  // Finds fields that have existed in collections for a long time but were
  // NEVER given a migration. These slip past the diff-only checks because
  // they are not "new in the PR". Always WARN, never fail — many warnings
  // are false positives from Payload's historical pushDevSchema seeding.
  if (BASELINE_MODE) {
    console.log('\n[migration-check] Running baseline drift audit (opt-in)...')
    const drifts = checkBaselineDrift()
    if (drifts.length === 0) {
      console.log('[migration-check] ✅ No baseline drift detected')
    } else {
      console.warn(`\n⚠️  ${drifts.length} baseline drift warning(s) — fields declared in collections but no ALTER TABLE or CREATE TABLE column found:\n`)
      // Group by collection for readability.
      const byCollection = drifts.reduce((acc, d) => {
        ;(acc[d.collection] = acc[d.collection] || []).push(d)
        return acc
      }, {})
      for (const [collection, items] of Object.entries(byCollection)) {
        console.warn(`   ${collection} (${items.length}):`)
        for (const d of items) {
          const groupStr = d.group ? ` [group: ${d.group}]` : ''
          console.warn(`     - ${d.expectedColumn}  (field "${d.field}", type "${d.type}"${groupStr})`)
        }
      }
      console.warn('\n💡 Review each warning manually:')
      console.warn('   1. Query staging DB: psql $DATABASE_URI -c "\\d <table>" to check if column exists')
      console.warn('   2. If column EXISTS on staging (Payload pushDevSchema legacy) → false positive, safe to ignore')
      console.warn('   3. If column MISSING → add ALTER TABLE ADD COLUMN IF NOT EXISTS migration to db-setup.js')
      console.warn('   (Never fails CI — this is an audit tool, not a gate.)\n')
    }
  }

  process.exit(hasErrors ? 1 : 0)
}

main()
