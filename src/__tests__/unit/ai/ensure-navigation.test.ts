/**
 * Unit Tests: ensureNavigationBlocks — force-inject header/footer
 * TC-ID: TC-F01.NAV — BUG-F01-24 fix verification
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { ensureNavigationBlocks, type PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 't', description: 'd' }

function makePage(layout: Array<{ blockType?: string; variant?: string }>): PageShape {
    return {
        title: 'Home',
        slug: '/',
        isHomepage: true,
        layout,
        seo: seoStub,
    }
}

describe('ensureNavigationBlocks', () => {
    it('TC-F01.NAV.01 — injects nav + footer when both missing', () => {
        const pages = [makePage([{ blockType: 'hero' }, { blockType: 'features' }])]
        const result = ensureNavigationBlocks(pages, 'Acme Co')

        expect(result[0].layout).toHaveLength(4)
        expect(result[0].layout[0].blockType).toBe('navigation')
        expect(result[0].layout[result[0].layout.length - 1].blockType).toBe('footer')
    })

    it('TC-F01.NAV.02 — preserves existing nav block', () => {
        const pages = [
            makePage([
                { blockType: 'navigation', variant: 'split' },
                { blockType: 'hero' },
                { blockType: 'footer' },
            ]),
        ]
        const result = ensureNavigationBlocks(pages, 'Acme')

        expect(result[0].layout).toHaveLength(3)
        expect(result[0].layout[0]).toMatchObject({ blockType: 'navigation', variant: 'split' })
    })

    it('TC-F01.NAV.03 — accepts header/navbar as navigation alias', () => {
        const pages = [makePage([{ blockType: 'header' }, { blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'Acme')

        // header counts as nav → no injection at start; footer still added
        expect(result[0].layout[0].blockType).toBe('header')
        expect(result[0].layout[result[0].layout.length - 1].blockType).toBe('footer')
    })

    it('TC-F01.NAV.04 — uses business name in default nav logoText', () => {
        const pages = [makePage([{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'My Shop')

        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.logoText).toBe('My Shop')
    })

    it('TC-F01.NAV.05 — falls back to default name when business name empty', () => {
        const pages = [makePage([{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, '')

        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.logoText).toBe('My Website')
    })

    it('TC-F01.NAV.06 — handles multi-page input', () => {
        const pages = [
            makePage([{ blockType: 'hero' }]),
            makePage([{ blockType: 'about' }]),
            makePage([{ blockType: 'contact' }]),
        ]
        const result = ensureNavigationBlocks(pages, 'Acme')

        for (const page of result) {
            expect(page.layout[0].blockType).toBe('navigation')
            expect(page.layout[page.layout.length - 1].blockType).toBe('footer')
        }
    })

    it('TC-F01.NAV.07 — does not mutate input array', () => {
        const original = [makePage([{ blockType: 'hero' }])]
        const originalLength = original[0].layout.length
        ensureNavigationBlocks(original, 'Acme')

        expect(original[0].layout).toHaveLength(originalLength)
    })

    it('TC-F01.NAV.08 — handles empty layout array', () => {
        const pages = [makePage([])]
        const result = ensureNavigationBlocks(pages, 'Acme')

        expect(result[0].layout).toHaveLength(2)
        expect(result[0].layout[0].blockType).toBe('navigation')
        expect(result[0].layout[1].blockType).toBe('footer')
    })
})
