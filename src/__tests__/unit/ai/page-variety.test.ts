/**
 * Unit Tests: enforcePageVariety — break monotony between AI pages
 * TC-ID: TC-F01.VAR — BUG-F01-23 fix verification
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { enforcePageVariety } from '@/lib/ai/page-variety'
import type { PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 't', description: 'd' }

function makePage(slug: string, layout: Array<{ blockType: string; variant: string }>): PageShape {
    return {
        title: slug,
        slug,
        isHomepage: slug === '/',
        layout,
        seo: seoStub,
    }
}

describe('enforcePageVariety', () => {
    it('TC-F01.VAR.01 — leaves single-page input unchanged', () => {
        const pages = [
            makePage('/', [
                { blockType: 'navigation', variant: 'minimal' },
                { blockType: 'hero', variant: 'centered' },
                { blockType: 'footer', variant: 'simple' },
            ]),
        ]
        const result = enforcePageVariety(pages)
        expect(result).toEqual(pages)
    })

    it('TC-F01.VAR.02 — swaps variants when 2 pages identical', () => {
        const layout = [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'hero', variant: 'centered' },
            { blockType: 'features', variant: 'grid-3' },
            { blockType: 'about', variant: 'split-image' },
            { blockType: 'footer', variant: 'simple' },
        ]
        const pages = [makePage('/', [...layout]), makePage('/about', [...layout])]
        const result = enforcePageVariety(pages)

        // page 1 unchanged
        expect(result[0].layout[1]).toEqual({ blockType: 'hero', variant: 'centered' })
        // page 2 — middle blocks variant should differ
        const page2Hero = result[1].layout[1]
        expect(page2Hero.blockType).toBe('hero')
        expect(page2Hero.variant).not.toBe('centered')
    })

    it('TC-F01.VAR.03 — does not modify nav/footer (positions 0 + last)', () => {
        const layout = [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'hero', variant: 'centered' },
            { blockType: 'features', variant: 'grid-3' },
            { blockType: 'footer', variant: 'simple' },
        ]
        const pages = [makePage('/', [...layout]), makePage('/about', [...layout])]
        const result = enforcePageVariety(pages)

        expect(result[1].layout[0]).toEqual({ blockType: 'navigation', variant: 'minimal' })
        expect(result[1].layout[result[1].layout.length - 1]).toEqual({ blockType: 'footer', variant: 'simple' })
    })

    it('TC-F01.VAR.04 — leaves diverse pages unchanged (overlap below threshold)', () => {
        const pageA = makePage('/', [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'hero', variant: 'centered' },
            { blockType: 'features', variant: 'grid-3' },
            { blockType: 'footer', variant: 'simple' },
        ])
        const pageB = makePage('/about', [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'about', variant: 'split-image' },
            { blockType: 'testimonials', variant: 'carousel' },
            { blockType: 'footer', variant: 'simple' },
        ])
        const result = enforcePageVariety([pageA, pageB])

        expect(result[1].layout[1]).toEqual({ blockType: 'about', variant: 'split-image' })
        expect(result[1].layout[2]).toEqual({ blockType: 'testimonials', variant: 'carousel' })
    })

    it('TC-F01.VAR.05 — handles unknown block types gracefully', () => {
        const layout = [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'unknown-block', variant: 'foo' },
            { blockType: 'footer', variant: 'simple' },
        ]
        const pages = [makePage('/', [...layout]), makePage('/x', [...layout])]
        const result = enforcePageVariety(pages)

        // unknown block stays the same (no variant cycle defined)
        expect(result[1].layout[1]).toEqual({ blockType: 'unknown-block', variant: 'foo' })
    })

    it('TC-F01.VAR.06 — uses configurable threshold (>1.0 disables swap)', () => {
        const layout = [
            { blockType: 'navigation', variant: 'minimal' },
            { blockType: 'hero', variant: 'centered' },
            { blockType: 'features', variant: 'grid-3' },
            { blockType: 'about', variant: 'split-image' },
            { blockType: 'footer', variant: 'simple' },
        ]
        const pages = [makePage('/', [...layout]), makePage('/x', [...layout])]
        // Threshold 1.0 — overlap 1.0 is NOT strictly greater, so no swap
        const result = enforcePageVariety(pages, 1.0)

        expect(result[1].layout[1]).toEqual({ blockType: 'hero', variant: 'centered' })
    })
})
