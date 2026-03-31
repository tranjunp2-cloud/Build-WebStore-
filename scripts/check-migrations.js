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
      
      const lines = diff.split('\n')
      const newFields = []
      let lastMatch = null
      
      for (const line of lines) {
         const nameMatch = /name:\s*['"](\w+)['"]/.exec(line)
         if (nameMatch) {
             lastMatch = { name: nameMatch[1], type: 'unknown', isArray: false, isGroup: false }
             newFields.push(lastMatch)
         }
         const typeMatch = /type:\s*['"](\w+)['"]/.exec(line)
         if (typeMatch && lastMatch) {
             lastMatch.type = typeMatch[1]
             lastMatch.isArray = typeMatch[1] === 'array'
             lastMatch.isGroup = typeMatch[1] === 'group'
         }
      }

      for (const fieldObj of newFields) {
        const { name: field, isArray: hasArray, isGroup: hasGroup } = fieldObj
        const snakeField = toSnakeCase(field)

        if (hasArray) {
           const arrayTableName = `${tableName}_${snakeField}`
           // Allow nested block tables (e.g. pages_blocks_social_widget_links)
           const hasArrayTable = Array.from(createTables).some(t => t === arrayTableName || (t.startsWith(`${tableName}_`) && t.endsWith(`_${snakeField}`)))
           if (!hasArrayTable) {
              console.error(`❌ ERROR: Missing CREATE TABLE IF NOT EXISTS "${arrayTableName}" (or similar) for array field '${field}' inside ${file}`)
              hasErrors = true
           }
        }
        
        if (hasGroup) {
           const hasGroupTable = Array.from(alterColumns).some(col => col.startsWith(`${tableName}.`) && col.includes(`${snakeField}_`))
           if (!hasGroupTable) {
              console.error(`❌ ERROR: Check group field '${field}'. Requires ALTER TABLE ADD COLUMN ... ${snakeField}_{subfield}`)
              hasErrors = true
           }
        }
        
        // Basic check for simple fields
        if (!hasArray && !hasGroup) {
           // Allow nested columns e.g. pages_layout.social_widget_variant
           const hasAlter = Array.from(alterColumns).some(col => 
               col === `${tableName}.${snakeField}` || 
               (col.startsWith(`${tableName}_`) && col.endsWith(`.${snakeField}`)) || 
               (col.startsWith(`${tableName}.`) && col.endsWith(`_${snakeField}`)) ||
               (col.startsWith(`${tableName}_`) && col.endsWith(`_${snakeField}`))
           )
           const inNewTable = Array.from(createTables).some(t => {
               const regex = new RegExp(`CREATE TABLE IF NOT EXISTS ["']?${t}["']?[^;]+${snakeField}\\s+(varchar|boolean|integer|timestamp|json)`, 'i')
               return regex.test(setupContent)
           })
           
           if (!hasAlter && !createTables.has(tableName) && !inNewTable) {
              console.error(`❌ ERROR: Possible missing ALTER TABLE for field '${field}' (${tableName}.${snakeField} or nested)`)
              hasErrors = true
           }
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
