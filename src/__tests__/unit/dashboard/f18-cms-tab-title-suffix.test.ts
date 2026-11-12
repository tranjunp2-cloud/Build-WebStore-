import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

// GH-2213: the root layout already appends " | Web Store" via its title template,
// so a CMS page that hardcodes the suffix renders "Discounts | Web Store | Web Store".

const APP_DIR = join(process.cwd(), 'src', 'app')
const ROOT_LAYOUT = join(APP_DIR, 'layout.tsx')

// Storefront and Studio have their own branding; the marketing home page sets an
// absolute title; API routes have no metadata.
const SKIPPED_TOP_LEVEL = new Set(['sites', 'studio', 'api', '(frontend)'])
const METADATA_FILE = /^(page|layout)\.tsx?$/
// Line-based scan of literal titles (`title: '...'` on one line) — enough to catch
// the hardcoded suffixes this guards against; titles built elsewhere are not seen.
const BRAND_SUFFIX = /Web ?Store|Prime ?Web|Ech ?Prime/i

function listMetadataFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            const top = relative(APP_DIR, full).split(sep)[0]
            return SKIPPED_TOP_LEVEL.has(top) ? [] : listMetadataFiles(full)
        }
        return METADATA_FILE.test(entry.name) && full !== ROOT_LAYOUT ? [full] : []
    })
}

describe('[TC-F18.68] CMS page titles rely on the root layout suffix', () => {
    it('root layout keeps the single "%s | Web Store" template', () => {
        // Arrange
        const source = readFileSync(ROOT_LAYOUT, 'utf8')

        // Act
        const template = source.match(/template:\s*['"]([^'"]+)['"]/)?.[1]

        // Assert
        expect(template).toBe('%s | Web Store')
    })

    it('no CMS page or layout hardcodes a brand suffix in its metadata title', () => {
        // Arrange
        const files = listMetadataFiles(APP_DIR)

        // Act
        const offenders = files.flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('\n')
                .map((line, i) => ({ line: line.trim(), at: `${relative(process.cwd(), file)}:${i + 1}` }))
                .filter(({ line }) => /\btitle\s*:/.test(line) && BRAND_SUFFIX.test(line))
                .map(({ at, line }) => `${at} → ${line}`),
        )

        // Assert
        expect(files.length).toBeGreaterThan(20)
        expect(offenders).toEqual([])
    })
})
