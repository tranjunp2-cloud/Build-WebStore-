/**
 * Unit tests for US-F26-06: Complete block content-injection locale coverage
 * TC-IDs: TC-F26.06-01 through TC-F26.06-03
 * Ref: plans/260526-1551-f26-multilingual-editor/phase-05-f26-06-coverage-audit.md
 */
import { describe, it, expect } from 'vitest'
import { getLocaleCoverage, hasLocaleContent } from '@/lib/ai/add-section-content'

/** High-traffic blocks required to have hand-authored BM content (from brainstorm §6) */
const HIGH_TRAFFIC_BLOCKS = [
    'hero', 'features', 'faq', 'testimonials', 'team',
    'pricing', 'newsletter', 'cta', 'contact', 'stats',
    'accordion', 'service-cards', 'about', 'gallery', 'products',
] as const

// ── TC-F26.06-01: Coverage matrix completeness ────────────────────────────────

describe('getLocaleCoverage — matrix completeness [TC-F26.06-01]', () => {
    it('returns a non-empty object', () => {
        const coverage = getLocaleCoverage()
        expect(typeof coverage).toBe('object')
        expect(Object.keys(coverage).length).toBeGreaterThan(0)
    })

    it('every entry has boolean en and ms fields', () => {
        const coverage = getLocaleCoverage()
        for (const [block, status] of Object.entries(coverage)) {
            expect(typeof status.en, `${block}.en should be boolean`).toBe('boolean')
            expect(typeof status.ms, `${block}.ms should be boolean`).toBe('boolean')
        }
    })

    it('detects missing BM for a hypothetical unregistered block', () => {
        // hasLocaleContent is the underlying check — ensure it returns false for unknown key
        expect(hasLocaleContent('__nonexistent__', 'ms')).toBe(false)
        expect(hasLocaleContent('__nonexistent__', 'en')).toBe(false)
    })
})

// ── TC-F26.06-02: EN always present for all registered blocks ─────────────────

describe('EN coverage — no EN-missing block [TC-F26.06-02]', () => {
    it('every registered block has EN content', () => {
        const coverage = getLocaleCoverage()
        const missingEn = Object.entries(coverage)
            .filter(([, { en }]) => !en)
            .map(([block]) => block)
        expect(missingEn).toEqual([])
    })
})

// ── TC-F26.06-03: High-traffic blocks have full EN + BM coverage ──────────────

describe('High-traffic blocks — full EN+BM [TC-F26.06-03]', () => {
    it.each(HIGH_TRAFFIC_BLOCKS)('%s has EN coverage', (block) => {
        expect(hasLocaleContent(block, 'en')).toBe(true)
    })

    it.each(HIGH_TRAFFIC_BLOCKS)('%s has BM coverage', (block) => {
        expect(hasLocaleContent(block, 'ms')).toBe(true)
    })

    it('all 15 high-traffic blocks are present in coverage map', () => {
        const coverage = getLocaleCoverage()
        const missing = HIGH_TRAFFIC_BLOCKS.filter(b => !(b in coverage))
        expect(missing).toEqual([])
    })

    it('zero high-traffic blocks have BM gaps', () => {
        const coverage = getLocaleCoverage()
        const bm_gaps = HIGH_TRAFFIC_BLOCKS.filter(b => !coverage[b]?.ms)
        expect(bm_gaps).toEqual([])
    })
})
