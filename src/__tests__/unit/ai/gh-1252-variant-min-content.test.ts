/**
 * Regression tests — GH-1252: VARIANT_MIN_CONTENT grid-col mismatch
 *
 * testimonials.cards and team.grid both render as 3-col grids but had
 * min=2 in VARIANT_MIN_CONTENT. On non-English sites padItems skips
 * library padding, so 2 items reached the 3-col grid → empty cell.
 *
 * Fix: bump cards:2→3 and grid:2→3 so enforceMinContent downgrades the
 * variant before padding is attempted.
 *
 * TC-IDs: docs/qa/F01-ai-builder-variety.md → GH-1252 section
 */

import { describe, it, expect } from 'vitest'
import { enforceMinContent, VARIANT_MIN_CONTENT } from '@/lib/ai/variant-validation'

describe('GH-1252 — VARIANT_MIN_CONTENT grid-col mismatch', () => {
    describe('testimonials.cards min updated to 3 (matches 3-col grid)', () => {
        it('TC-1252-01: cards variant with 2 items → enforceMinContent downgrades to non-grid variant', () => {
            // Arrange — AI gen produced only 2 testimonials (common on non-English sites)
            const variant = 'cards'
            const itemCount = 2

            // Act
            const result = enforceMinContent('testimonials', variant, itemCount)

            // Assert — variant must NOT be 'cards' (3-col grid needs 3 items)
            expect(result).not.toBe('cards')
            // Result should be a simpler single-item or non-grid variant
            const GRID_VARIANTS = new Set(['cards', 'masonry'])
            expect(GRID_VARIANTS.has(result)).toBe(false)
        })

        it('TC-1252-02: cards variant with 3 items → enforceMinContent keeps cards', () => {
            // Arrange — AI gen produced 3 testimonials (enough for 3-col grid)
            const variant = 'cards'
            const itemCount = 3

            // Act
            const result = enforceMinContent('testimonials', variant, itemCount)

            // Assert — 3 items is exactly the minimum for cards → no downgrade
            expect(result).toBe('cards')
        })

        it('TC-1252-02b: VARIANT_MIN_CONTENT.testimonials.cards is 3', () => {
            expect(VARIANT_MIN_CONTENT.testimonials?.cards).toBe(3)
        })
    })

    describe('team.grid min updated to 3 (matches 3-col grid)', () => {
        it('TC-1252-03: team grid variant with 2 members → enforceMinContent downgrades to list', () => {
            // Arrange — AI gen produced only 2 team members
            const variant = 'grid'
            const itemCount = 2

            // Act
            const result = enforceMinContent('team', variant, itemCount)

            // Assert — 'grid' needs 3 items so it must downgrade
            expect(result).not.toBe('grid')
            // 'list' is the only other team variant and requires 2 → should be chosen
            expect(result).toBe('list')
        })

        it('TC-1252-04: team grid variant with 3 members → enforceMinContent keeps grid', () => {
            // Arrange — AI gen produced 3 team members (enough for 3-col grid)
            const variant = 'grid'
            const itemCount = 3

            // Act
            const result = enforceMinContent('team', variant, itemCount)

            // Assert — 3 items is exactly the minimum for grid → no downgrade
            expect(result).toBe('grid')
        })

        it('TC-1252-04b: VARIANT_MIN_CONTENT.team.grid is 3', () => {
            expect(VARIANT_MIN_CONTENT.team?.grid).toBe(3)
        })
    })
})
