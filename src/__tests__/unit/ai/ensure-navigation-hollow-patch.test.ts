/**
 * Unit Tests: ensureNavigationBlocks — hollow nav link injection (Phase 04 fix)
 * TC-ID: TC-NAV-ENS-01..08
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { ensureNavigationBlocks, DEFAULT_NAV_LINKS, type PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 't', description: 'd' }

function makePage(layout: Array<Record<string, unknown>>): PageShape {
    return { title: 'Home', slug: '/', isHomepage: true, layout, seo: seoStub }
}

describe('ensureNavigationBlocks — hollow nav patching', () => {
    it('TC-NAV-ENS-01: no nav block → prepends default nav with default link count', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'hero' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.blockType).toBe('navigation')
        expect(Array.isArray(nav.links)).toBe(true)
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })

    it('TC-NAV-ENS-02: hollow nav links:[] → patched with defaults, logoText preserved', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'navigation', variant: 'simple', logoText: 'Acme', links: [] }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
        expect(nav.logoText).toBe('Acme')
        expect(nav.variant).toBe('simple')
    })

    it('TC-NAV-ENS-03: populated nav links → NOT overwritten', () => {
        // Arrange
        const customLinks = [{ label: 'Shop', url: '/shop' }, { label: 'Blog', url: '/blog' }]
        const pages = [makePage([{ blockType: 'navigation', links: customLinks }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(nav.links).toEqual(customLinks)
    })

    it('TC-NAV-ENS-04: blockType "Navigation" (capital N) → detected as nav, patched', () => {
        // Arrange — AI may emit capitalised blockType
        const pages = [makePage([{ blockType: 'Navigation', links: [] }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert — no duplicate nav prepended; original block patched
        const navBlocks = result[0].layout.filter(
            (b) => (b as Record<string, unknown>).blockType?.toString().toLowerCase() === 'navigation',
        )
        expect(navBlocks.length).toBe(1)
        const nav = navBlocks[0] as Record<string, unknown>
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })

    it('TC-NAV-ENS-05: blockType "header" → detected as nav alias, patched', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'header', links: [] }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert — no extra navigation prepended
        const navCount = result[0].layout.filter(
            (b) => (b as Record<string, unknown>).blockType === 'navigation',
        ).length
        expect(navCount).toBe(0) // original 'header' block stays, not replaced
        const headerBlock = result[0].layout[0] as Record<string, unknown>
        expect(headerBlock.blockType).toBe('header')
        expect((headerBlock.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })

    it('TC-NAV-ENS-06: nav with missing links field → patched', () => {
        // Arrange — no links property at all
        const pages = [makePage([{ blockType: 'navigation', variant: 'simple' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(Array.isArray(nav.links)).toBe(true)
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })

    it('TC-NAV-ENS-07: nav with links:"invalid" (non-array) → patched via Array.isArray guard', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'navigation', links: 'invalid' }])]
        // Act
        const result = ensureNavigationBlocks(pages, 'Acme')
        // Assert
        const nav = result[0].layout[0] as Record<string, unknown>
        expect(Array.isArray(nav.links)).toBe(true)
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })

    it('TC-NAV-ENS-08: running ensureNavigationBlocks twice is idempotent (no link duplication)', () => {
        // Arrange
        const pages = [makePage([{ blockType: 'navigation', links: [] }])]
        // Act
        const once = ensureNavigationBlocks(pages, 'Acme')
        const twice = ensureNavigationBlocks(once as unknown as PageShape[], 'Acme')
        // Assert
        const nav = twice[0].layout[0] as Record<string, unknown>
        expect((nav.links as unknown[]).length).toBe(DEFAULT_NAV_LINKS.length)
    })
})
