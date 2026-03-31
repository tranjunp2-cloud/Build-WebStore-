#!/usr/bin/env node
/**
 * CI Check: Ensure Payload CMS schema changes have matching SQL migrations.
 * Implements P0 rules for Database Schema Changes according to AGENTS.md.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_BRANCH = process.argv[2] || 'origin/staging'
const DB_SETUP_PATH = path.join(__dirname, 'db-setup.js')

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

function main() {
  console.log(`[migration-check] Comparing against ${BASE_BRANCH}...`)
  
  const setupContent = fs.readFileSync(DB_SETUP_PATH, 'utf8')
  let hasErrors = false

  // 1. NEVER use DROP TABLE
  if (/DROP\s+TABLE/i.test(setupContent)) {
    console.error('❌ ERROR: DROP TABLE found in db-setup.js. NEVER use DROP TABLE in migrations.')
    hasErrors = true
  }

  // Parse db-setup.js to collect existing migrations
  const alterColumns = new Set()
  const createTables = new Set()

  const alterRegex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/gi
  let match
  while ((match = alterRegex.exec(setupContent)) !== null) {
    alterColumns.add(`${match[1]}.${match[2]}`)
  }

  const createRegex = /CREATE TABLE IF NOT EXISTS\s+["']?(\w+)["']?/gi
  while ((match = createRegex.exec(setupContent)) !== null) {
    createTables.add(match[1])
  }

  // Parse COLLECTION_SLUGS
  const slugRegex = /const COLLECTION_SLUGS = \[([\s\S]*?)\]/
  const slugMatch = slugRegex.exec(setupContent)
  let existingSlugs = []
  if (slugMatch) {
     existingSlugs = slugMatch[1].match(/['"]([\w-]+)['"]/g)?.map(s => s.replace(/['"]/g, '')) || []
  }

  // Check all collections dynamically
  const collectionsDir = path.join(__dirname, '../src/collections')
  const files = fs.existsSync(collectionsDir) ? fs.readdirSync(collectionsDir).filter(f => f.endsWith('.ts')) : []
  
  for (const file of files) {
    const filePath = `src/collections/${file}`
    const tableName = toSnakeCase(file.replace('.ts', ''))
    
    // Check for NEW collection missing in COLLECTION_SLUGS
    try {
      execSync(`git ls-tree -r ${BASE_BRANCH} ${filePath}`, { stdio: 'pipe' })
    } catch {
      if (!existingSlugs.includes(tableName)) {
        console.error(`❌ ERROR: New collection '${tableName}' missing from COLLECTION_SLUGS in db-setup.js`)
        hasErrors = true
      }
    }
    
    // Parse diff for fields
    try {
      const diff = execSync(`git diff ${BASE_BRANCH} -- ${filePath} | grep "^+" || true`, { encoding: 'utf8' }).trim()
      if (!diff) continue
      
      const newFields = [...diff.matchAll(/name:\s*['"](\w+)['"]/g)].map(m => m[1])
      const hasArray = diff.includes(`type: 'array'`) || diff.includes('type: "array"')
      const hasGroup = diff.includes(`type: 'group'`) || diff.includes('type: "group"')

      for (const field of newFields) {
        const snakeField = toSnakeCase(field)

        if (hasArray) {
           const arrayTableName = `${tableName}_${snakeField}`
           if (!createTables.has(arrayTableName)) {
              console.error(`❌ ERROR: Missing CREATE TABLE IF NOT EXISTS "${arrayTableName}" for array field '${field}' inside ${file}`)
              hasErrors = true
           }
        }
        
        if (hasGroup) {
           // Cannot easily guess group subfields through diff, ensure at least one ALTER is present
           const groupRegex = new RegExp(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${snakeField}_`, 'i')
           if (!groupRegex.test(setupContent)) {
              console.warn(`⚠️  WARNING: Check group field '${field}'. Requires ALTER TABLE ADD COLUMN ... ${snakeField}_{subfield}`)
           }
        }
        
        // Basic check for simple fields
        if (!alterColumns.has(`${tableName}.${snakeField}`) && !hasArray && !hasGroup && !createTables.has(tableName)) {
          console.warn(`⚠️  WARNING: Possible missing ALTER TABLE for field '${field}' (${tableName}.${snakeField})`)
        }
      }
      
    } catch (e) {
      // Ignored
    }
  }

  if (hasErrors) {
    console.error('\n[migration-check] ❌ Migration validation failed according to AGENTS.md rules. Please fix db-setup.js.\n')
    process.exit(1)
  }
  
  console.log('[migration-check] ✅ All schema changes look compliant.')
  process.exit(0)
}

main()
