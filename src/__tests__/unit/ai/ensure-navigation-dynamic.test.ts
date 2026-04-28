/**
 * Unit Tests: ensureNavigationBlocks — dynamic pageLinks param (GH-817)
 * TC-ID: TC-NAV-DYN-06, TC-NAV-DYN-07, TC-NAV-DYN-08, TC-NAV-DYN-11, TC-NAV-DYN-12
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { ensureNavigationBlocks, DEFAULT_NAV_LINKS, type PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 't', description: 'd' }

const AI_PAGE_LINKS = [
    { label: 'Home', url: '/' },
    { label: 'Services', url: '/services' },
    { label: 'Gallery', url: '/gallery' },
    { label: 'Contact', url: '/contact' },
] as const

function makePage(layout: Array<Record<string, unknown>>, overrides?: Partial<PageShape>): PageShape {
    return { title: 'Home', slug: '/', isHomepage: true, layout, seo: seoStub, ...overrides }
}

describe('ensureNavigationBlocks — dynamic pageLinks param', () => {
    it('TC-NAV-DYN-06: injected default nav uses provided pageLinks when nav block is missing', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'hero' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme', AI_PAGE_LINKS)
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.blockType).toBe('navigation')
        const links = nav.links as Array<{ label: string; url: string }>
        expect(links).toHaveLength(AI_PAGE_LINKS.length)
        expect(links[0]).toEqual({ label: 'Home', url: '/' })
        expect(links[1]).toEqual({ label: 'Services', url: '/services' })
        expect(links[2]).toEqual({ label: 'Gallery', url: '/gallery' })
    })

    it('TC-NAV-DYN-07: without pageLinks param, behavior unchanged — injects DEFAULT_NAV_LINKS', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'hero' }])]
        // Act — no pageLinks arg (back-compat)
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        const links = nav.links as Array<{ label: string; url: string }>
        expect(links).toHaveLength(DEFAULT_NAV_LINKS.length)
        expect(links.map((l) => l.url)).toEqual(DEFAULT_NAV_LINKS.map((l) => l.url))
    })

    it('TC-NAV-DYN-08: hollow nav (empty links) is patched with provided pageLinks', () => {
        // Arrange — nav block exists but has no links
        const hollowNav = { blockType: 'navigation', links: [] }
        const pages = [makePage([hollowNav, { blockType: 'hero' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme', AI_PAGE_LINKS)
        // Assert — first block is nav; it should now have AI page links
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.blockType).toBe('navigation')
        const links = nav.links as Array<{ label: string; url: string }>
        expect(links).toHaveLength(AI_PAGE_LINKS.length)
        expect(links[1].url).toBe('/services')
    })

    it('TC-NAV-DYN-11: non-hollow nav with hardcoded links is force-replaced with aiPageLinks', () => {
        // Arrange — enforceMinimumStructure injects nav with hardcoded Home/About/Services/Contact
        // This nav is non-hollow (has 4 links), so old patchHollowNav would skip it.
        const hardcodedNav = {
            blockType: 'navigation',
            links: [
                { label: 'Home', url: '/' },
                { label: 'About', url: '/about' },
                { label: 'Services', url: '/services' },
                { label: 'Contact', url: '/contact' },
            ],
        }
        const pages = [makePage([hardcodedNav, { blockType: 'hero' }])]
        // Act — AI generated [Home, Gallery, Blog, Contact] but enforcer injected [Home, About, Services, Contact]
        const dynamicLinks = [
            { label: 'Home', url: '/' },
            { label: 'Gallery', url: '/gallery' },
            { label: 'Blog', url: '/blog' },
            { label: 'Contact', url: '/contact' },
        ] as const
        const result = ensureNavigationBlocks(pages, 'Acme', dynamicLinks)
        // Assert — nav should now reflect actual AI pages, not hardcoded enforcer links
        const nav = result[0].layout[0] as Record<string, unknown>
        const links = nav.links as Array<{ label: string; url: string }>
        expect(links).toHaveLength(4)
        expect(links[1]).toEqual({ label: 'Gallery', url: '/gallery' })
        expect(links[2]).toEqual({ label: 'Blog', url: '/blog' })
    })

    it('TC-NAV-DYN-12: without pageLinks, non-hollow nav keeps existing links (back-compat)', () => {
        // Arrange — existing nav has links; no aiPageLinks provided
        const existingNav = {
            blockType: 'navigation',
            links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }],
        }
        const pages = [makePage([existingNav, { blockType: 'hero' }])]
        // Act — no pageLinks arg
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert — links unchanged (patchHollowNav skips non-hollow when no forceReplace)
        const nav = result[0].layout[0] as Record<string, unknown>
        const links = nav.links as Array<{ label: string; url: string }>
        expect(links).toHaveLength(2)
        expect(links[1]).toEqual({ label: 'About', url: '/about' })
    })
})
