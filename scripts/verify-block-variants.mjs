#!/usr/bin/env node
/**
 * Block Variant Verification Script
 *
 * Checks that every variant defined in config.ts has a corresponding
 * branch in index.tsx (or variant file), and that CSS_VARS is imported.
 *
 * Usage: node scripts/verify-block-variants.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'

const BLOCKS_DIR = resolve('src/blocks')
const SKIP_DIRS = ['shared']

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractVariantsFromConfig(configContent) {
    // Match variants array: variants: ['a', 'b', 'c'] or variants: ["a", "b"]
    const match = configContent.match(/variants:\s*\[([^\]]+)\]/)
    if (!match) return []
    return match[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(Boolean)
}

function extractHandledVariants(indexContent) {
    const handled = new Set()

    // Pattern 1: variant === 'name' or variant === "name"
    const eqMatches = indexContent.matchAll(/variant\s*===?\s*['"]([^'"]+)['"]/g)
    for (const m of eqMatches) handled.add(m[1])

    // Pattern 2: case 'name': or case "name":
    const caseMatches = indexContent.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)
    for (const m of caseMatches) handled.add(m[1])

    // Pattern 3: VARIANT_MAP keys: 'name': Component or 'name': 'value'
    const mapMatches = indexContent.matchAll(/['"]([^'"]+)['"]\s*:\s*['"\w]/g)
    for (const m of mapMatches) handled.add(m[1])

    return handled
}

function checkCssVarsImport(content) {
    return /import\s*\{[^}]*CSS_VARS[^}]*\}\s*from/.test(content)
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const blocks = readdirSync(BLOCKS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && !SKIP_DIRS.includes(d.name))
        .map(d => d.name)
        .sort()

    let totalBlocks = 0
    let totalVariants = 0
    let totalHandled = 0
    let totalMissing = 0
    let cssVarsOk = 0
    let cssVarsMissing = 0
    const failures = []

    console.log('Block Variant Verification')
    console.log('=' .repeat(60))
    console.log('')

    for (const blockName of blocks) {
        const blockDir = join(BLOCKS_DIR, blockName)
        const configPath = join(blockDir, 'config.ts')
        const indexPath = join(blockDir, 'index.tsx')

        if (!existsSync(configPath) || !existsSync(indexPath)) continue

        const configContent = readFileSync(configPath, 'utf-8')
        const variants = extractVariantsFromConfig(configContent)

        if (variants.length === 0) continue

        totalBlocks++
        totalVariants += variants.length

        // Read index.tsx + any variant files
        let indexContent = readFileSync(indexPath, 'utf-8')

        // Also check variants/ directory if it exists
        const variantsDir = join(blockDir, 'variants')
        if (existsSync(variantsDir)) {
            const variantFiles = readdirSync(variantsDir).filter(f => f.endsWith('.tsx'))
            for (const vf of variantFiles) {
                indexContent += '\n' + readFileSync(join(variantsDir, vf), 'utf-8')
            }
        }

        const handled = extractHandledVariants(indexContent)
        const missing = variants.filter(v => !handled.has(v))

        // Check if it's a default variant that doesn't need explicit handling
        const defaultMatch = configContent.match(/defaultVariant:\s*['"]([^'"]+)['"]/)
        const defaultVariant = defaultMatch ? defaultMatch[1] : variants[0]
        const missingNonDefault = missing.filter(v => v !== defaultVariant)

        const handledCount = variants.length - missingNonDefault.length
        totalHandled += handledCount
        totalMissing += missingNonDefault.length

        // CSS_VARS check
        let hasCssVars = checkCssVarsImport(indexContent)
        if (hasCssVars) {
            cssVarsOk++
        } else {
            cssVarsMissing++
        }

        const variantStatus = missingNonDefault.length === 0 ? '✓' : '✗'
        const cssStatus = hasCssVars ? '✓' : '✗'
        const pad = blockName.padEnd(22)
        const variantInfo = `${handledCount}/${variants.length} variants handled`.padEnd(24)

        if (missingNonDefault.length > 0) {
            console.log(`  ${variantStatus}  ${pad} ${variantInfo}  CSS_VARS ${cssStatus}  ← MISSING: ${missingNonDefault.join(', ')}`)
            failures.push({ block: blockName, missing: missingNonDefault })
        } else {
            console.log(`  ${variantStatus}  ${pad} ${variantInfo}  CSS_VARS ${cssStatus}`)
        }
    }

    console.log('')
    console.log('─'.repeat(60))
    console.log('')
    console.log(`  Blocks:   ${totalBlocks}`)
    console.log(`  Variants: ${totalHandled}/${totalVariants} handled`)
    console.log(`  CSS_VARS: ${cssVarsOk}/${totalBlocks} imported`)
    console.log(`  Missing:  ${totalMissing} variant(s)`)
    console.log('')

    if (failures.length > 0) {
        console.log('  FAILED — Dead variants detected:')
        for (const f of failures) {
            console.log(`    • ${f.block}: ${f.missing.join(', ')}`)
        }
        console.log('')
        process.exit(1)
    } else {
        console.log('  PASSED — All variants have handlers ✓')
        console.log('')
        process.exit(0)
    }
}

main()
