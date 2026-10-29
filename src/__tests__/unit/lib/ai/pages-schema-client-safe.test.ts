/**
 * #2103 — pages-schema.ts is bundled into the editor client (editor page → optimistic
 * template swap). Importing grounded-blocks from it pulled generation-facts-scope
 * (`node:async_hooks`) into the browser bundle and broke the editor build, which neither
 * tsc nor the unit suite noticed. This walks its static import graph instead.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../../../..')
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g

function resolveImport(from: string, spec: string): string | null {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
    if (!base) return null
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const file = base + ext
        if (existsSync(file) && statSync(file).isFile()) return file
    }
    return null
}

function serverOnlyImports(entry: string): string[] {
    const seen = new Set([entry])
    const queue = [entry]
    const hits: string[] = []
    while (queue.length > 0) {
        const file = queue.shift()!
        for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
            const spec = match[1] ?? match[2]!
            if (/^(node:|async_hooks$|fs$|pg$|payload$)/.test(spec)) hits.push(`${file.slice(SRC.length + 1)} → ${spec}`)
            const next = resolveImport(file, spec)
            if (next && !seen.has(next)) { seen.add(next); queue.push(next) }
        }
    }
    return hits
}

describe('pages-schema stays client-safe (#2103)', () => {
    it('[TC-AIAUD-212] its static import graph reaches no server-only module', () => {
        // Act
        const hits = serverOnlyImports(join(SRC, 'lib/ai/pages-schema.ts'))

        // Assert
        expect(hits).toEqual([])
    })
})
