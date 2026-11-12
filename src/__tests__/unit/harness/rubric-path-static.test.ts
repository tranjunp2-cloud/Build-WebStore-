/**
 * TC-PERF-189 — Rubric files resolve from a fixed folder (`scripts/test-harness/rubric/rubric-<version>.json`), so
 * Turbopack traces only those files into /api/admin/templates/bulk instead of the whole project (a map lookup made
 * it warn "Dynamic filesystem access causes tracing of the whole project"). Every version still loads; an unknown
 * version (the bulk route takes it from the request body) is refused instead of resolving a stray path.
 * Real: scorer-lib via the ai-quality shim, the rubric JSON files. The trace itself is checked by `next build`
 * (no warning; the bulk route's .nft.json lists the rubric files only).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RUBRIC_VERSION, loadRubric, rubricPath, type RubricVersion } from '@/lib/ai-quality/scorer'

const VERSIONS: RubricVersion[] = ['v1', 'v1.1', 'v1.2', 'v1.3']
const RUBRIC_DIR = path.join(process.cwd(), 'scripts/test-harness/rubric')

describe('rubric paths are statically scoped [TC-PERF-189]', () => {
    it('TC-PERF-189: every version resolves inside the rubric folder and loads', () => {
        for (const version of VERSIONS) {
            const file = rubricPath(version)
            expect(file).toBe(path.join(RUBRIC_DIR, `rubric-${version}.json`))
            expect(fs.existsSync(file)).toBe(true)
            expect(loadRubric(version).dimensions.length).toBeGreaterThan(0)
        }
        expect(rubricPath()).toBe(rubricPath(DEFAULT_RUBRIC_VERSION))
    })

    it('TC-PERF-189: an unknown version is refused (no path outside the known files)', () => {
        expect(() => rubricPath('../../../.env' as RubricVersion)).toThrow(/Unknown rubric version/)
        expect(() => loadRubric('v9' as RubricVersion)).toThrow(/Unknown rubric version/)
    })
})
