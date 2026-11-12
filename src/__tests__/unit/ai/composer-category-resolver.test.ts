/**
 * GH-1611 — the builder form posts an ALREADY RESOLVED composer key as
 * `businessInfo.industry` (GET /api/data/industries serves TEMPLATE_CATEGORY_OPTIONS
 * values verbatim). Feeding that key back through `resolveComposerCategory` —
 * a free-text classifier — silently rewrote 'fnb' and 'realestate' to the
 * 'business' safe sink, because neither key appears in its own keyword list.
 *
 * Downstream, that drift sent Pixabay `category=business` instead of `food` for a
 * bakery, so retail/fashion stock was allowed into the image pool: the reported
 * "gallery of a cake shop showing clothes on a rack".
 *
 * TC-GH1611-10..14
 */

import { describe, it, expect } from 'vitest'
import {
    resolveComposerCategory,
    normalizeComposerCategory,
} from '@/lib/ai/composer-category-resolver'
import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'
import { PIXABAY_CATEGORY_BY_COMPOSER } from '@/lib/ai/pixabay-client'
import { resolveSiteType } from '@/lib/ai/site-type'

// Source the values from the collection itself — a new industry option added to
// the form is then covered by this test automatically, instead of silently
// drifting to 'business' the way 'fnb' did.
const FORM_VALUES = TEMPLATE_CATEGORY_OPTIONS.map((o) => o.value)

describe('TC-GH1611-10 — every industry the form can post survives normalization', () => {
    it.each(FORM_VALUES)('normalizeComposerCategory(%s) is idempotent', (value) => {
        expect(normalizeComposerCategory(value)).toBe(value)
    })

    it('covers all 14 form options (guard: the list is not empty/mistyped)', () => {
        expect(FORM_VALUES).toHaveLength(14)
        expect(FORM_VALUES).toContain('fnb')
        expect(FORM_VALUES).toContain('realestate')
    })
})

describe('TC-GH1611-11 — resolveComposerCategory is free-text only (the trap)', () => {
    // Pinned deliberately: this documents WHY the call sites must not use it on
    // an already-resolved key. Changing this behaviour should be a conscious act.
    it('rewrites the composer keys that are absent from their own keyword list', () => {
        expect(resolveComposerCategory('fnb')).toBe('business')
        expect(resolveComposerCategory('realestate')).toBe('business')
    })

    it('still classifies genuine free text', () => {
        expect(resolveComposerCategory('tiệm bánh ngọt')).toBe('fnb')
        expect(resolveComposerCategory('nhà hàng hải sản')).toBe('restaurant')
        expect(normalizeComposerCategory('tiệm bánh ngọt')).toBe('fnb')
    })

    it('falls back to business for unknown input', () => {
        expect(normalizeComposerCategory(undefined)).toBe('business')
        expect(normalizeComposerCategory('')).toBe('business')
    })
})

describe('TC-GH1611-12 — the drift is what let cross-industry photos in', () => {
    it('a bakery filters Pixabay on food, not business', () => {
        expect(PIXABAY_CATEGORY_BY_COMPOSER[normalizeComposerCategory('fnb')]).toBe('food')
        // What the bug actually shipped: category=business → retail/fashion stock.
        expect(PIXABAY_CATEGORY_BY_COMPOSER[resolveComposerCategory('fnb')]).toBe('business')
    })

    it('real estate filters on buildings, not business', () => {
        expect(PIXABAY_CATEGORY_BY_COMPOSER[normalizeComposerCategory('realestate')]).toBe('buildings')
    })
})

describe('TC-GH1611-13 — siteType alias is no longer defeated upstream', () => {
    it('fnb maps to the restaurant site type', () => {
        // site-type.ts aliases fnb → restaurant, but the alias never saw 'fnb':
        // the category had already been rewritten to 'business' before it got here.
        expect(resolveSiteType(normalizeComposerCategory('fnb'))).toBe('restaurant')
    })
})

describe('TC-GH1611-33 — Vietnamese free text no longer sinks to business', () => {
    it.each([
        ['tiệm hoa tươi', 'ecommerce'],
        ['cửa hàng hoa', 'ecommerce'],
        ['bánh kẹo', 'fnb'],
        ['bánh ngọt', 'fnb'],
        ['bánh mì', 'fnb'],
    ])('resolveComposerCategory(%s) → %s', (text, expected) => {
        expect(resolveComposerCategory(text)).toBe(expected)
    })

    it('leaves a category with no matching composer key on the business sink', () => {
        expect(resolveComposerCategory('sửa xe máy')).toBe('business')
    })

    it('does not change the form-key-wins rule', () => {
        expect(normalizeComposerCategory('fnb')).toBe('fnb')
    })
})
