import { describe, it, expect } from 'vitest'
import { collectMenuPageIds } from '@/lib/menu-page-links'

// TC-F05-02-13: collectMenuPageIds pure helper

type RawLink = Record<string, unknown>
type Page = { id: string; slug: string; isHomepage?: boolean }

const makeLink = (overrides: Partial<RawLink> = {}): RawLink => ({
    id: 'link-1',
    type: 'page',
    url: '/about',
    label: 'About',
    children: [],
    ...overrides,
})

const makePage = (overrides: Partial<Page> = {}): Page => ({
    id: 'page-1',
    slug: 'about',
    ...overrides,
})

describe('collectMenuPageIds — TC-F05-02-13', () => {
    it('returns empty set when no links', () => {
        // Arrange & Act
        const result = collectMenuPageIds([], [makePage()])
        // Assert
        expect(result.size).toBe(0)
    })

    it('returns empty set when no pages', () => {
        // Arrange & Act
        const result = collectMenuPageIds([makeLink()], [])
        // Assert
        expect(result.size).toBe(0)
    })

    it('matches page by slug when link url matches exactly', () => {
        // Arrange
        const links: RawLink[] = [makeLink({ url: '/about' })]
        const pages: Page[] = [makePage({ id: 'p1', slug: 'about' })]
        // Act
        const result = collectMenuPageIds(links, pages)
        // Assert
        expect(result.has('p1')).toBe(true)
    })

    it('matches slug regardless of leading slash (normalizes both sides)', () => {
        // Arrange — link has no leading slash, page slug has no slash either
        const links: RawLink[] = [makeLink({ url: 'about' })]
        const pages: Page[] = [makePage({ id: 'p2', slug: '/about' })]
        // Act
        const result = collectMenuPageIds(links, pages)
        // Assert — normalizeSlug strips leading slash on both sides
        expect(result.has('p2')).toBe(true)
    })

    it('treats homepage as always linked regardless of link tree', () => {
        // Arrange — no links at all, but page.isHomepage = true
        const pages: Page[] = [makePage({ id: 'hp', slug: 'home', isHomepage: true })]
        // Act
        const result = collectMenuPageIds([], pages)
        // Assert
        expect(result.has('hp')).toBe(true)
    })

    it('skips external link types even when url matches a page slug', () => {
        // Arrange — external link with same url as a page slug
        const links: RawLink[] = [makeLink({ type: 'external', url: '/about' })]
        const pages: Page[] = [makePage({ id: 'p3', slug: 'about' })]
        // Act
        const result = collectMenuPageIds(links, pages)
        // Assert — external links must not match pages
        expect(result.has('p3')).toBe(false)
    })

    it('walks nested children to collect page links', () => {
        // Arrange — link with a child that points to a page
        const child: RawLink = makeLink({ id: 'child-1', url: '/contact' })
        const parent: RawLink = makeLink({ id: 'parent-1', url: '/about', children: [child] })
        const pages: Page[] = [
            makePage({ id: 'p4', slug: 'about' }),
            makePage({ id: 'p5', slug: 'contact' }),
        ]
        // Act
        const result = collectMenuPageIds([parent], pages)
        // Assert — both parent and child pages are found
        expect(result.has('p4')).toBe(true)
        expect(result.has('p5')).toBe(true)
    })

    it('returns IDs as strings matching String(page.id)', () => {
        // Arrange — numeric-looking id
        const links: RawLink[] = [makeLink({ url: '/about' })]
        const pages: Page[] = [makePage({ id: '42', slug: 'about' })]
        // Act
        const result = collectMenuPageIds(links, pages)
        // Assert — must match String('42')
        expect(result.has('42')).toBe(true)
    })

    it('handles duplicate links without duplicating IDs in set', () => {
        // Arrange — two links pointing to same slug
        const links: RawLink[] = [
            makeLink({ id: 'a', url: '/about' }),
            makeLink({ id: 'b', url: '/about' }),
        ]
        const pages: Page[] = [makePage({ id: 'p6', slug: 'about' })]
        // Act
        const result = collectMenuPageIds(links, pages)
        // Assert — Set deduplicates
        expect(result.size).toBe(1)
        expect(result.has('p6')).toBe(true)
    })
})
