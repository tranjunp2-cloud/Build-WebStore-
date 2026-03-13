#!/usr/bin/env node
/**
 * Generate Knowledge Base for PrimeBot
 *
 * This script scans the codebase and generates a structured knowledge file
 * that PrimeBot uses to answer questions about the project.
 *
 * Run manually: node scripts/generate-knowledge.js
 * Or via CI: Triggered on push to main/staging
 *
 * Output: Prints a summary of what was analyzed (the knowledge is embedded
 * in knowledge-context.ts as static content for now).
 *
 * Future: Could output to a JSON/MD file that gets committed back or
 * stored in a database for dynamic loading.
 */
const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')

// ─── File Tree Scanner ───────────────────────────────────────────────────

function scanDirectory(dir, prefix = '', depth = 0, maxDepth = 4) {
    if (depth > maxDepth) return []
    const entries = []

    try {
        const items = fs.readdirSync(dir, { withFileTypes: true })
            .filter(item => !item.name.startsWith('.') && item.name !== 'node_modules')
            .sort((a, b) => {
                // Directories first
                if (a.isDirectory() && !b.isDirectory()) return -1
                if (!a.isDirectory() && b.isDirectory()) return 1
                return a.name.localeCompare(b.name)
            })

        for (const item of items) {
            const fullPath = path.join(dir, item.name)
            const relativePath = path.relative(SRC_DIR, fullPath)

            if (item.isDirectory()) {
                entries.push({ type: 'dir', path: relativePath, name: item.name })
                entries.push(...scanDirectory(fullPath, prefix + '  ', depth + 1, maxDepth))
            } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
                entries.push({ type: 'file', path: relativePath, name: item.name })
            }
        }
    } catch {
        // Skip unreadable directories
    }

    return entries
}

// ─── Collection Analyzer ─────────────────────────────────────────────────

function analyzeCollections() {
    const collectionsDir = path.join(SRC_DIR, 'collections')
    if (!fs.existsSync(collectionsDir)) return []

    const collections = []
    const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.ts'))

    for (const file of files) {
        const content = fs.readFileSync(path.join(collectionsDir, file), 'utf8')
        const name = file.replace('.ts', '')

        // Extract slug
        const slugMatch = content.match(/slug:\s*['"]([^'"]+)['"]/)
        const slug = slugMatch ? slugMatch[1] : name.toLowerCase()

        // Extract field names
        const fieldMatches = content.matchAll(/name:\s*['"]([^'"]+)['"]/g)
        const fields = [...fieldMatches].map(m => m[1]).filter(f => f !== slug)

        collections.push({ name, slug, fields: fields.slice(0, 10) })
    }

    return collections
}

// ─── Block Analyzer ──────────────────────────────────────────────────────

function analyzeBlocks() {
    const blocksDir = path.join(SRC_DIR, 'blocks')
    if (!fs.existsSync(blocksDir)) return []

    const blocks = []
    const dirs = fs.readdirSync(blocksDir, { withFileTypes: true })
        .filter(d => d.isDirectory())

    for (const dir of dirs) {
        const configPath = path.join(blocksDir, dir.name, 'config.ts')
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8')

            // Extract variants
            const variantMatches = content.matchAll(/variant['"]\s*:\s*['"]([^'"]+)['"]/g)
            const variants = [...variantMatches].map(m => m[1])

            blocks.push({ name: dir.name, variants })
        }
    }

    return blocks
}

// ─── API Routes Analyzer ─────────────────────────────────────────────────

function analyzeAPIRoutes() {
    const apiDir = path.join(SRC_DIR, 'app', 'api')
    if (!fs.existsSync(apiDir)) return []

    const routes = []

    function walk(dir, routePath = '/api') {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
            const full = path.join(dir, item.name)
            if (item.isDirectory()) {
                walk(full, `${routePath}/${item.name}`)
            } else if (item.name === 'route.ts') {
                const content = fs.readFileSync(full, 'utf8')
                const methods = []
                if (content.includes('GET')) methods.push('GET')
                if (content.includes('POST')) methods.push('POST')
                if (content.includes('PATCH')) methods.push('PATCH')
                if (content.includes('DELETE')) methods.push('DELETE')
                routes.push({ path: routePath, methods })
            }
        }
    }

    walk(apiDir)
    return routes
}

// ─── Store Analyzer ──────────────────────────────────────────────────────

function analyzeStores() {
    const storeDir = path.join(SRC_DIR, 'store')
    if (!fs.existsSync(storeDir)) return []

    const stores = []
    const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.ts'))

    for (const file of files) {
        const content = fs.readFileSync(path.join(storeDir, file), 'utf8')
        const name = file.replace('.ts', '')

        // Extract state interface fields
        const stateMatches = content.matchAll(/(\w+)\s*:/g)
        const fields = [...stateMatches].map(m => m[1]).slice(0, 8)

        stores.push({ name, fields })
    }

    return stores
}

// ─── Main ────────────────────────────────────────────────────────────────

function main() {
    console.log('🧠 PrimeBot Knowledge Generator')
    console.log('================================\n')

    // 1. File tree
    const tree = scanDirectory(SRC_DIR)
    const fileCount = tree.filter(e => e.type === 'file').length
    const dirCount = tree.filter(e => e.type === 'dir').length
    console.log(`📁 Source files: ${fileCount} files in ${dirCount} directories`)

    // 2. Collections
    const collections = analyzeCollections()
    console.log(`\n📊 Collections (${collections.length}):`)
    for (const col of collections) {
        console.log(`   - ${col.name} (slug: ${col.slug}) — ${col.fields.length} fields`)
    }

    // 3. Blocks
    const blocks = analyzeBlocks()
    console.log(`\n🧩 Blocks (${blocks.length}):`)
    for (const block of blocks) {
        console.log(`   - ${block.name}${block.variants.length ? ` (${block.variants.length} variants)` : ''}`)
    }

    // 4. API Routes
    const routes = analyzeAPIRoutes()
    console.log(`\n🔗 API Routes (${routes.length}):`)
    for (const route of routes) {
        console.log(`   - [${route.methods.join(', ')}] ${route.path}`)
    }

    // 5. Stores
    const stores = analyzeStores()
    console.log(`\n🗄️ Stores (${stores.length}):`)
    for (const store of stores) {
        console.log(`   - ${store.name}`)
    }

    console.log('\n================================')
    console.log('✅ Knowledge analysis complete.')
    console.log('📝 Static knowledge is embedded in src/lib/lark/knowledge-context.ts')
    console.log('💡 Update knowledge-context.ts when architecture changes significantly.')

    // Output summary as JSON (can be used by CI to detect drift)
    const summary = {
        generatedAt: new Date().toISOString(),
        fileCount,
        dirCount,
        collections: collections.map(c => c.name),
        blocks: blocks.map(b => b.name),
        apiRoutes: routes.map(r => r.path),
        stores: stores.map(s => s.name),
    }

    const outputPath = path.join(__dirname, '..', '.knowledge-summary.json')
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))
    console.log(`\n📄 Summary written to .knowledge-summary.json`)
}

main()
