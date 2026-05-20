/**
 * Phase 04 — capture-generation field-count helpers.
 *
 * Coverage:
 *   TC-P04.01 — countSnapshotFields: single-page flat blocks
 *   TC-P04.02 — countSnapshotFields: multi-page structure
 *   TC-P04.03 — countSnapshotFields: empty/null values → filled=0
 *   TC-P04.04 — countSnapshotFields: truncated snapshot returns 0/0
 *   TC-P04.05 — countSnapshotFields: nested arrays (features list)
 *   TC-P04.06 — countSnapshotFields: structural skip keys ignored
 *   TC-P04.07 — countSnapshotFields: boolean and number values count as filled
 *
 * Plan: plans/260420-1028-studio-ui-visual-feature-audit/phase-04-schema-additions.md
 */

import { describe, it, expect } from 'vitest'
import { countSnapshotFields } from '@/lib/ai/snapshot-field-counter'

// ── TC-P04.01: Single-page flat blocks ────────────────────────────────────────
describe('countSnapshotFields — single-page flat blocks', () => {
    it('counts total and filled for a simple hero block', () => {
        const snapshot = {
            blocks: [
                {
                    blockType: 'hero',
                    headline: 'Welcome to Our Store',
                    subheadline: 'Best deals in town',
                    ctaText: 'Shop Now',
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // headline, subheadline, ctaText = 3 total, all non-empty = 3 filled
        expect(result.fieldsTotal).toBe(3)
        expect(result.fieldsFilled).toBe(3)
    })

    it('counts multiple blocks', () => {
        const snapshot = {
            blocks: [
                { blockType: 'hero', headline: 'Hello', subheadline: '' },
                { blockType: 'footer', copyrightText: '2026 Acme' },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // hero: headline(1f), subheadline(1t 0f) | footer: copyrightText(1f) → total=3, filled=2
        expect(result.fieldsTotal).toBe(3)
        expect(result.fieldsFilled).toBe(2)
    })
})

// ── TC-P04.02: Multi-page structure ──────────────────────────────────────────
describe('countSnapshotFields — multi-page', () => {
    it('counts across all pages', () => {
        const snapshot = {
            pages: [
                {
                    layout: [
                        { blockType: 'hero', headline: 'Home Hero' },
                    ],
                },
                {
                    layout: [
                        { blockType: 'about', description: 'About us text' },
                    ],
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // page0: headline (1t 1f) | page1: description (1t 1f) → 2t 2f
        expect(result.fieldsTotal).toBe(2)
        expect(result.fieldsFilled).toBe(2)
    })
})

// ── TC-P04.03: Empty / null values ───────────────────────────────────────────
describe('countSnapshotFields — empty values', () => {
    it('empty string fields count as total but not filled', () => {
        const snapshot = {
            blocks: [
                {
                    blockType: 'cta',
                    headline: '',
                    subtext: '   ',  // whitespace-only → also not filled
                    ctaLabel: 'Buy Now',
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // headline: total+1 filled+0 | subtext: total+1 filled+0 | ctaLabel: total+1 filled+1
        expect(result.fieldsTotal).toBe(3)
        expect(result.fieldsFilled).toBe(1)
    })
})

// ── TC-P04.04: Truncated snapshot ────────────────────────────────────────────
describe('countSnapshotFields — truncated snapshot', () => {
    it('returns 0/0 when snapshot was truncated due to size', () => {
        const snapshot = {
            _truncated: true,
            _sizeKb: 80,
            warning: 'Snapshot exceeded size limit',
        }
        const result = countSnapshotFields(snapshot)
        expect(result.fieldsTotal).toBe(0)
        expect(result.fieldsFilled).toBe(0)
    })
})

// ── TC-P04.05: Nested arrays (features list) ─────────────────────────────────
describe('countSnapshotFields — nested arrays', () => {
    it('recurses into array of feature objects', () => {
        const snapshot = {
            blocks: [
                {
                    blockType: 'features',
                    title: 'Why Choose Us',
                    items: [
                        { label: 'Fast Delivery', description: 'Ships same day' },
                        { label: 'Quality', description: '' },
                    ],
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // title: 1f | items[0].label: 1f, items[0].description: 1f | items[1].label: 1f, items[1].description: 1t 0f
        // total=5, filled=4
        expect(result.fieldsTotal).toBe(5)
        expect(result.fieldsFilled).toBe(4)
    })
})

// ── TC-P04.06: Structural keys ignored ───────────────────────────────────────
describe('countSnapshotFields — structural key exclusion', () => {
    it('does not count blockType, id, _order, variant, path, siteName', () => {
        const snapshot = {
            blocks: [
                {
                    blockType: 'hero',
                    id: 'block-123',
                    _order: 0,
                    variant: 'split',
                    path: 'template-first',
                    siteName: 'My Store',  // structural, skipped
                    headline: 'Real Field',
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // Only headline should count
        expect(result.fieldsTotal).toBe(1)
        expect(result.fieldsFilled).toBe(1)
    })
})

// ── TC-P04.07: Boolean and number values ─────────────────────────────────────
describe('countSnapshotFields — boolean and number values', () => {
    it('counts booleans and numbers as filled (non-null)', () => {
        const snapshot = {
            blocks: [
                {
                    blockType: 'pricing',
                    price: 99,
                    isPopular: true,
                    discount: 0,     // zero is still "filled" for a number
                    label: '',
                },
            ],
        }
        const result = countSnapshotFields(snapshot)
        // price(1f), isPopular(1f), discount(1f), label(1t 0f) → total=4, filled=3
        expect(result.fieldsTotal).toBe(4)
        expect(result.fieldsFilled).toBe(3)
    })
})

// ── TC-P04.08: Empty snapshot returns 0/0 ────────────────────────────────────
describe('countSnapshotFields — empty snapshot', () => {
    it('handles snapshot with no blocks or pages gracefully', () => {
        expect(countSnapshotFields({})).toEqual({ fieldsTotal: 0, fieldsFilled: 0 })
        expect(countSnapshotFields({ path: 'fallback-no-key' })).toEqual({ fieldsTotal: 0, fieldsFilled: 0 })
    })
})
