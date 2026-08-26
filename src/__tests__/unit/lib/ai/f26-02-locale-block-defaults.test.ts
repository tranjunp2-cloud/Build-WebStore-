/**
 * F26-02: Locale-aware block defaults — unit tests
 * TC-IDs: F26-02-01 → F26-02-12
 *
 * Covers:
 *   AC-1: ms site → BM defaults injected
 *   AC-2: en site → EN defaults, no regression
 *   AC-3: missing BM → EN fallback + needsTranslation: true
 *   1d:   locale_content init (both slots) on block add
 */

import { describe, it, expect } from 'vitest'
import {
    resolveBlockContent,
    hasLocaleContent,
    getLocaleCoverage,
} from '@/lib/ai/add-section-content'

// ── AC-2: EN defaults (no regression) ────────────────────────────────────────

describe('TC-F26-02-01: resolveBlockContent — EN hero returns English headline', () => {
    it('resolves EN hero headline', () => {
        const result = resolveBlockContent('hero', 'en', 'TestBrand')
        expect(result.needsTranslation).toBe(false)
        expect(result.localeUsed).toBe('en')
        const content = result.content as { headline: string }
        expect(content.headline).toContain('TestBrand')
        expect(content.headline).toMatch(/welcome/i)
    })
})

describe('TC-F26-02-02: resolveBlockContent — EN faq headline is English', () => {
    it('resolves EN faq headline', () => {
        const result = resolveBlockContent('faq', 'en', 'Acme')
        expect(result.needsTranslation).toBe(false)
        const content = result.content as { headline: string }
        expect(content.headline).toMatch(/frequently asked/i)
        expect(content.headline).toContain('Acme')
    })
})

// ── AC-1: BM defaults ─────────────────────────────────────────────────────────

describe('TC-F26-02-03: resolveBlockContent — ms hero returns BM headline', () => {
    it('resolves BM hero headline with brand interpolation', () => {
        const result = resolveBlockContent('hero', 'ms', 'Kedai Mak Cik')
        expect(result.needsTranslation).toBe(false)
        expect(result.localeUsed).toBe('ms')
        const content = result.content as { headline: string }
        expect(content.headline).toContain('Kedai Mak Cik')
        expect(content.headline).toMatch(/selamat datang/i)
    })
})

describe('TC-F26-02-04: resolveBlockContent — ms faq returns BM "Soalan Lazim"', () => {
    it('resolves BM faq headline', () => {
        const result = resolveBlockContent('faq', 'ms', 'TestShop')
        expect(result.needsTranslation).toBe(false)
        const content = result.content as { headline: string }
        expect(content.headline).toMatch(/soalan lazim/i)
    })
})

describe('TC-F26-02-05: All 15 priority blocks have BM content authored', () => {
    const PRIORITY_BLOCKS = [
        'hero', 'features', 'faq', 'testimonials', 'team',
        'pricing', 'newsletter', 'cta', 'contact', 'stats',
        'accordion', 'service-cards', 'about', 'gallery', 'products',
    ]

    it.each(PRIORITY_BLOCKS)('block "%s" has ms content', (blockType) => {
        expect(hasLocaleContent(blockType, 'ms')).toBe(true)
    })
})

// ── AC-3: Missing BM → EN fallback ────────────────────────────────────────────

describe('TC-F26-02-06: resolveBlockContent — unknown block → EN fallback + needsTranslation', () => {
    it('falls back to EN and sets needsTranslation for unknown-block in ms locale', () => {
        const result = resolveBlockContent('unknown-block-xyz', 'ms', 'Brand')
        expect(result.needsTranslation).toBe(true)
        expect(result.localeUsed).toBe('en')
    })
})

describe('TC-F26-02-07: resolveBlockContent — never throws for any locale/type combo', () => {
    it('returns an object (never throws)', () => {
        expect(() => resolveBlockContent('nonexistent', 'ms', 'X')).not.toThrow()
        expect(() => resolveBlockContent('nonexistent', 'en', 'X')).not.toThrow()
        const result = resolveBlockContent('nonexistent', 'ms', 'X')
        expect(typeof result.content).toBe('object')
    })
})

// ── Brand interpolation ───────────────────────────────────────────────────────

describe('TC-F26-02-08: {brand} token replaced in both EN and BM content', () => {
    it('replaces {brand} in EN hero headline', () => {
        const result = resolveBlockContent('hero', 'en', 'Ali Bakery')
        const content = result.content as { headline: string }
        expect(content.headline).not.toContain('{brand}')
        expect(content.headline).toContain('Ali Bakery')
    })

    it('replaces {brand} in ms hero headline', () => {
        const result = resolveBlockContent('hero', 'ms', 'Kedai Ali')
        const content = result.content as { headline: string }
        expect(content.headline).not.toContain('{brand}')
        expect(content.headline).toContain('Kedai Ali')
    })

    it('replaces {brand} deeply in faq items', () => {
        const result = resolveBlockContent('faq', 'ms', 'MyBrand')
        const content = result.content as { items: Array<{ question: string; answer: string }> }
        const hasRawToken = content.items.some(
            item => item.question.includes('{brand}') || item.answer.includes('{brand}')
        )
        expect(hasRawToken).toBe(false)
    })
})

// ── hasLocaleContent ──────────────────────────────────────────────────────────

describe('TC-F26-02-09: hasLocaleContent — hero has both en and ms', () => {
    it('returns true for hero/en', () => {
        expect(hasLocaleContent('hero', 'en')).toBe(true)
    })
    it('returns true for hero/ms', () => {
        expect(hasLocaleContent('hero', 'ms')).toBe(true)
    })
    it('returns false for nonexistent/ms', () => {
        expect(hasLocaleContent('nonexistent-block', 'ms')).toBe(false)
    })
})

// ── getLocaleCoverage ─────────────────────────────────────────────────────────

describe('TC-F26-02-10: getLocaleCoverage — returns matrix for all registered blocks', () => {
    it('returns a non-empty coverage object', () => {
        const coverage = getLocaleCoverage()
        expect(Object.keys(coverage).length).toBeGreaterThan(0)
    })

    it('hero has en: true, ms: true', () => {
        const coverage = getLocaleCoverage()
        expect(coverage['hero']).toEqual({ en: true, ms: true })
    })

    it('every block in coverage has en: true (EN always complete)', () => {
        const coverage = getLocaleCoverage()
        for (const [blockType, status] of Object.entries(coverage)) {
            expect({ blockType, en: status.en }).toEqual({ blockType, en: true })
        }
    })
})

// ── locale_content init structure (AC: 1d) ────────────────────────────────────

describe('TC-F26-02-11: locale_content init — both en and ms slots populated on block add', () => {
    it('resolving both locales gives non-empty objects for hero', () => {
        const en = resolveBlockContent('hero', 'en', 'TestBrand').content
        const ms = resolveBlockContent('hero', 'ms', 'TestBrand').content
        // Both slots must be non-empty objects (as stored in __localeInit)
        expect(typeof en).toBe('object')
        expect(typeof ms).toBe('object')
        expect(Object.keys(en as object).length).toBeGreaterThan(0)
        expect(Object.keys(ms as object).length).toBeGreaterThan(0)
    })
})

// ── Regression: EN-only sites unaffected ─────────────────────────────────────

describe('TC-F26-02-12: EN-only site regression — resolving en never sets needsTranslation', () => {
    const BLOCKS_TO_CHECK = ['hero', 'faq', 'features', 'contact', 'cta']
    it.each(BLOCKS_TO_CHECK)('block "%s" in en locale → needsTranslation: false', (blockType) => {
        const result = resolveBlockContent(blockType, 'en', 'Brand')
        expect(result.needsTranslation).toBe(false)
        expect(result.localeUsed).toBe('en')
    })
})
