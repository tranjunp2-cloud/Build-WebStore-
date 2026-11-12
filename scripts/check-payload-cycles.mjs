#!/usr/bin/env node
/**
 * CI Check: no static import chain leads from src/payload.config.ts back to itself.
 *
 * A collection (or anything it imports) that statically imports `@payload-config` closes a cycle through the
 * config. Dev and tests do not mind, but production builds evaluate the config half-initialised and every server
 * action on /dashboard, /products, /blog throws after deploy (audit C5, 2026-10-22). Load the config lazily inside
 * the function that needs it (`const { default: config } = await import('@payload-config')`) instead.
 *
 * Ignored on purpose: type-only imports (`import type`, `{ type A, type B }`) and dynamic `import()` — neither runs
 * at module evaluation. Bare package imports are not followed.
 *
 * Usage: node scripts/check-payload-cycles.mjs [repo-root]
 * Exit 0 = no cycle | Exit 1 = cycle(s) found (each printed as a chain)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js', '.mjs']
// static `import … from 'x'`, `export … from 'x'`, side-effect `import 'x'` (not `import type`, not `import(`)
const IMPORT_RE = /^\s*(import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm

/** Only type names inside the braces (`{ type A, type B }`): erased at compile time. */
function isTypeOnlyClause(clause) {
    const trimmed = clause.trim()
    if (!/^\{[^}]*\}$/.test(trimmed)) return false
    const names = trimmed.replace(/[{}\s]/g, ' ').split(',').map((name) => name.trim()).filter(Boolean)
    return names.length > 0 && names.every((name) => name.startsWith('type '))
}

function createResolver(src, config) {
    return function resolve(from, spec) {
        let base
        if (spec === '@payload-config') return config
        if (spec.startsWith('@/')) base = path.join(src, spec.slice(2))
        else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
        else return null
        if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
        for (const extension of EXTENSIONS) if (fs.existsSync(base + extension)) return base + extension
        return null
    }
}

/**
 * Every import chain from a module the config imports back to the config (one shortest chain per such module).
 * Paths in the result are relative to `<root>/src`.
 */
export function findPayloadCycles(root) {
    const src = path.join(root, 'src')
    const config = path.join(src, 'payload.config.ts')
    if (!fs.existsSync(config)) throw new Error(`No src/payload.config.ts under ${root}`)
    const resolve = createResolver(src, config)
    const cache = new Map()

    const deps = (file) => {
        if (cache.has(file)) return cache.get(file)
        const source = fs.readFileSync(file, 'utf8')
        const out = []
        IMPORT_RE.lastIndex = 0
        let match
        while ((match = IMPORT_RE.exec(source))) {
            if (isTypeOnlyClause(match[2] || '')) continue
            const target = resolve(file, match[3] || match[4])
            if (target) out.push(target)
        }
        cache.set(file, out)
        return out
    }

    // breadth-first: the shortest chain from `start` to `target`, or null
    const chainTo = (start, target) => {
        const previous = new Map([[start, null]])
        const queue = [start]
        while (queue.length) {
            const file = queue.shift()
            for (const dep of deps(file)) {
                if (dep === target) {
                    const chain = [dep]
                    for (let at = file; at; at = previous.get(at)) chain.push(at)
                    return chain.reverse()
                }
                if (!previous.has(dep)) {
                    previous.set(dep, file)
                    queue.push(dep)
                }
            }
        }
        return null
    }

    const cycles = []
    for (const dep of new Set(deps(config))) {
        const chain = chainTo(dep, config)
        if (chain) cycles.push([config, ...chain].map((file) => path.relative(src, file)))
    }
    return cycles
}

function main() {
    const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
    const cycles = findPayloadCycles(root)
    if (cycles.length === 0) {
        console.log('[payload-cycles] ✅ No import cycle through src/payload.config.ts')
        return
    }
    console.error(`[payload-cycles] ❌ ${cycles.length} import cycle(s) through src/payload.config.ts:\n`)
    for (const cycle of cycles) console.error(`  ${cycle.join(' -> ')}`)
    console.error(
        "\nFix: load the config lazily where it is used — `const { default: config } = await import('@payload-config')` —" +
            ' or import only types (`import type`).',
    )
    process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
