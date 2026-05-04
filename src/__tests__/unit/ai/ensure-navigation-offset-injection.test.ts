/**
 * Unit Tests: ensureNavigationBlocks — first-block nav offset injection (Phase 03 fix)
 * TC-ID: TC-NAV-OFF-01..09
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { ensureNavigationBlocks, type PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 't', description: 'd' }
const navLinks = [{ label: 'Home', url: '/' }]

function makePageWithNav(variant: string, contentBlocks: Array<Record<string, unknown>> = []): PageShape {
    return {
        title: 'Home',
        slug: '/',
        isHomepage: true,
        layout: [
            { blockType: 'navigation', variant, links: navLinks },
            ...contentBlocks,
        ],
        seo: seoStub,
    }
}

describe('ensureNavigationBlocks — first-block nav offset injection', () => {
    it('TC-NAV-OFF-01: variant "default" → _navOffset:true on first content block', () => {
        // Arrange
        const pages = [makePageWithNav('default', [{ blockType: 'hero', headline: 'Welcome' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-02: variant "transparent" → _navOffset:true (fixed top-0, hero text still needs offset)', () => {
        // Arrange
        const pages = [makePageWithNav('transparent', [{ blockType: 'hero', headline: 'Welcome' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert — transparent nav is position:fixed, hero content must be offset so it is visible below the nav bar
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-03: variant "centered" → _navOffset:true', () => {
        const pages = [makePageWithNav('centered', [{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'Acme')
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-04: variant "mega" → _navOffset:true', () => {
        const pages = [makePageWithNav('mega', [{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'Acme')
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-05: variant "floating" → _navOffset:true (floating occupies top viewport area)', () => {
        const pages = [makePageWithNav('floating', [{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'Acme')
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-06: variant "sidebar" → _navOffset:true', () => {
        const pages = [makePageWithNav('sidebar', [{ blockType: 'hero' }])]
        const result = ensureNavigationBlocks(pages, 'Acme')
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
    })

    it('TC-NAV-OFF-07: nav-only page (no content blocks) → returns safely with no error', () => {
        // Arrange — only nav block, no content
        const pages: PageShape[] = [{
            title: 'Home', slug: '/', isHomepage: true,
            layout: [{ blockType: 'navigation', variant: 'default', links: navLinks }],
            seo: seoStub,
        }]
        // Act + Assert — should not throw
        expect(() => ensureNavigationBlocks(pages, 'Acme')).not.toThrow()
    })

    it('TC-NAV-OFF-08: offset injection is idempotent (running twice does not stack flags)', () => {
        // Arrange
        const pages = [makePageWithNav('default', [{ blockType: 'hero' }])]
        // Act
        const once = ensureNavigationBlocks(pages, 'Acme')
        const twice = ensureNavigationBlocks(once as unknown as PageShape[], 'Acme')
        // Assert — _navOffset is true exactly once, not nested/doubled
        const hero = twice[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?._navOffset).toBe(true)
        // Ensure no extra wrapping
        expect(typeof hero?._navOffset).toBe('boolean')
    })

    it('TC-NAV-OFF-09: original block props preserved — only _navOffset added', () => {
        // Arrange
        const pages = [makePageWithNav('default', [{ blockType: 'hero', headline: 'Hello', variant: 'split' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const hero = result[0].layout.find((b) => (b as Record<string, unknown>).blockType === 'hero') as Record<string, unknown>
        expect(hero?.headline).toBe('Hello')
        expect(hero?.variant).toBe('split')
        expect(hero?.blockType).toBe('hero')
        expect(hero?._navOffset).toBe(true)
    })
})
