/**
 * Unit tests for buildProductAlt (src/lib/products/build-product-alt.ts).
 *
 * TC-09.38 — alt-text fallback "{Product Name}" (GH-1458, GH-1502). Mirrors the
 * priority-chain test style of safeAltText usage in hero blocks.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { buildProductAlt } from '@/lib/products/build-product-alt'

describe('buildProductAlt — TC-09.38: alt present', () => {
    it('returns the trimmed merchant-entered alt text as-is', () => {
        expect(buildProductAlt('  Front view of pink dress  ', 'Baju Pink', 'My Shop')).toBe('Front view of pink dress')
    })
})

describe('buildProductAlt — TC-09.38: alt blank -> name only', () => {
    it('builds "{name}" when alt is empty, whitespace, or missing', () => {
        expect(buildProductAlt('', 'Baju Pink', 'My Shop')).toBe('Baju Pink')
        expect(buildProductAlt('   ', 'Baju Pink', 'My Shop')).toBe('Baju Pink')
        expect(buildProductAlt(undefined, 'Baju Pink', 'My Shop')).toBe('Baju Pink')
        expect(buildProductAlt(null, 'Baju Pink', 'My Shop')).toBe('Baju Pink')
    })
})

describe('buildProductAlt — TC-09.38: missing store -> name only', () => {
    it('falls back to product name when store name is blank/missing', () => {
        expect(buildProductAlt('', 'Baju Pink', '')).toBe('Baju Pink')
        expect(buildProductAlt('', 'Baju Pink', undefined)).toBe('Baju Pink')
    })
})

describe('buildProductAlt — TC-09.38: missing name -> store only', () => {
    it('falls back to store name when product name is blank/missing', () => {
        expect(buildProductAlt('', '', 'My Shop')).toBe('My Shop')
        expect(buildProductAlt('', undefined, 'My Shop')).toBe('My Shop')
    })
})

describe('buildProductAlt — TC-09.38: both blank -> hard fallback', () => {
    it('returns "Product image" when alt, name, and store are all blank/missing', () => {
        expect(buildProductAlt('', '', '')).toBe('Product image')
        expect(buildProductAlt(undefined, undefined, undefined)).toBe('Product image')
        expect(buildProductAlt('   ', '   ', '   ')).toBe('Product image')
    })

    it('never returns an empty string for any combination of blank inputs', () => {
        const blanks = [undefined, null, '', '   ']
        for (const alt of blanks) {
            for (const name of blanks) {
                for (const store of blanks) {
                    expect(buildProductAlt(alt as string | null | undefined, name as string | null | undefined, store as string | null | undefined)).not.toBe('')
                }
            }
        }
    })
})

describe('buildProductAlt — TC-09.38: non-string alt guarded', () => {
    it('ignores non-string alt values and falls through the chain', () => {
        // @ts-expect-error — verifying runtime guard against unexpected non-string input
        expect(buildProductAlt(123, 'Baju Pink', 'My Shop')).toBe('Baju Pink')
    })
})
