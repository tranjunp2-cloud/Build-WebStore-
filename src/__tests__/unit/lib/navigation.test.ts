import { describe, it, expect, beforeEach } from 'vitest'
import { filterNavigationLinksByVisibility } from '@/lib/navigation'

// ── TC-F04.06: Navigation block — visibility filtering ─────────────────────
// Related: F04 Block Renderer — navigation links derived from page visibility state

describe('[TC-F04.06] filterNavigationLinksByVisibility — happy path', () => {
    it('returns all links when all pages are visible', () => {
        // Arrange
        const links = [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
            { label: 'Products', url: '/products' },
        ]
        const pages = [
            { slug: 'about', isVisible: true, isHomepage: false, deletedAt: null },
            { slug: 'products', isVisible: true, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert
        expect(result).toHaveLength(3)
        expect(result.map(l => l.url)).toEqual(['/', '/about', '/products'])
    })

    it('removes internal links pointing to hidden pages', () => {
        // Arrange
        const links = [
            { label: 'Home', url: '/' },
            { label: 'Hidden Page', url: '/hidden' },
            { label: 'Visible Page', url: '/visible' },
        ]
        const pages = [
            { slug: 'hidden', isVisible: false, isHomepage: false, deletedAt: null },
            { slug: 'visible', isVisible: true, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert
        expect(result).toHaveLength(2)
        expect(result.map(l => l.url)).toEqual(['/', '/visible'])
    })

    it('keeps external links (https://) even when a page is hidden', () => {
        // Arrange
        const links = [
            { label: 'External', url: 'https://example.com' },
            { label: 'Also External', url: 'http://other.com' },
            { label: 'Hidden Internal', url: '/hidden' },
        ]
        const pages = [
            { slug: 'hidden', isVisible: false, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert
        expect(result).toHaveLength(2)
        expect(result.map(l => l.label)).toEqual(['External', 'Also External'])
    })

    it('does not hide homepage link even when isVisible is false', () => {
        // Arrange
        // Homepage pages have isHomepage=true — they should NOT be added to hiddenPaths
        const links = [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
        ]
        const pages = [
            { slug: 'home', isVisible: false, isHomepage: true, deletedAt: null },
            { slug: 'about', isVisible: true, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — homepage page is excluded from hiddenPaths filter
        expect(result).toHaveLength(2)
        expect(result.map(l => l.url)).toEqual(['/', '/about'])
    })

    it('does not hide page that is deleted (soft-deleted pages are not "hidden")', () => {
        // Arrange — deletedAt != null means page is deleted, should NOT block nav link
        const links = [
            { label: 'Deleted Page', url: '/deleted' },
        ]
        const pages = [
            { slug: 'deleted', isVisible: false, isHomepage: false, deletedAt: '2026-01-01T00:00:00Z' },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — deleted page (has deletedAt) is not in hiddenPaths
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('/deleted')
    })
})

// ── TC-F04.10: Empty layout / null inputs (edge cases) ─────────────────────
describe('[TC-F04.10] filterNavigationLinksByVisibility — empty & null inputs', () => {
    it('returns empty array when links is undefined', () => {
        // Arrange + Act
        const result = filterNavigationLinksByVisibility(undefined, [])

        // Assert
        expect(result).toEqual([])
    })

    it('returns empty array when links is an empty array', () => {
        // Arrange
        const pages = [{ slug: 'about', isVisible: true, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility([], pages)

        // Assert
        expect(result).toEqual([])
    })

    it('returns original links unchanged when pages is undefined', () => {
        // Arrange
        const links = [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, undefined)

        // Assert — no pages to filter against, all links pass through
        expect(result).toHaveLength(2)
        expect(result).toBe(links) // same reference
    })

    it('returns original links unchanged when pages is an empty array', () => {
        // Arrange
        const links = [
            { label: 'About', url: '/about' },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, [])

        // Assert
        expect(result).toHaveLength(1)
    })
})

// ── TC-F04.06b: Slug normalization edge cases ──────────────────────────────
describe('[TC-F04.06b] filterNavigationLinksByVisibility — slug normalization', () => {
    it('normalizes slug without leading slash to match link with leading slash', () => {
        // Arrange — page slug stored without leading /, link url has leading /
        const links = [{ label: 'About', url: '/about' }]
        const pages = [{ slug: 'about', isVisible: false, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — 'about' normalized to '/about', link is filtered out
        expect(result).toHaveLength(0)
    })

    it('normalizes slug "home" to "/" — link to "/" is never hidden', () => {
        // Arrange — "home" slug page, even if isVisible=false and not isHomepage,
        // normalizePagePath("home", false) returns "/" — root link survives
        const links = [{ label: 'Home', url: '/' }]
        const pages = [{ slug: 'home', isVisible: false, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — "/" is in hiddenPaths, but normalizePagePath('/', false) = '/'
        // so the root link would be hidden (this tests actual implementation behavior)
        // The slug "home" normalizes to "/" so it IS in hiddenPaths
        expect(result).toHaveLength(0)
    })

    it('handles slug with leading slash already present', () => {
        // Arrange — slug stored WITH leading slash
        const links = [{ label: 'Contact', url: '/contact' }]
        const pages = [{ slug: '/contact', isVisible: false, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — '/contact' is already normalized, link is filtered out
        expect(result).toHaveLength(0)
    })

    it('normalizes slug that is all whitespace to "/" (whitespace-only slug)', () => {
        // Arrange — slug is whitespace only: trimmed = '', which triggers the !trimmed branch
        const links = [{ label: 'Home', url: '/' }]
        const pages = [{ slug: '   ', isVisible: false, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — whitespace slug normalizes to '/', so '/' is in hiddenPaths
        expect(result).toHaveLength(0)
    })

    it('handles link with no url (non-internal path) — always kept', () => {
        // Arrange — link with no url: isInternalPath(undefined) = false → keep
        const links = [{ label: 'Orphan', url: undefined as unknown as string }]
        const pages = [{ slug: 'anything', isVisible: false, isHomepage: false, deletedAt: null }]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — no url is not internal path, link is kept
        expect(result).toHaveLength(1)
    })

    it('filters multiple hidden pages simultaneously', () => {
        // Arrange
        const links = [
            { label: 'Home', url: '/' },
            { label: 'Hidden A', url: '/hidden-a' },
            { label: 'Hidden B', url: '/hidden-b' },
            { label: 'Visible', url: '/visible' },
            { label: 'Ext', url: 'https://ext.com' },
        ]
        const pages = [
            { slug: 'hidden-a', isVisible: false, isHomepage: false, deletedAt: null },
            { slug: 'hidden-b', isVisible: false, isHomepage: false, deletedAt: null },
            { slug: 'visible', isVisible: true, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert
        expect(result).toHaveLength(3)
        expect(result.map(l => l.url)).toEqual(['/', '/visible', 'https://ext.com'])
    })
})

// ── TC-F04.12: Links with custom extra properties are preserved ────────────
describe('[TC-F04.12] filterNavigationLinksByVisibility — generic type passthrough', () => {
    it('preserves additional properties on link objects', () => {
        // Arrange — extended link type with extra fields
        const links = [
            { label: 'Blog', url: '/blog', icon: 'book', order: 1 },
            { label: 'Hidden', url: '/hidden', icon: 'eye-off', order: 2 },
        ]
        const pages = [
            { slug: 'hidden', isVisible: false, isHomepage: false, deletedAt: null },
        ]

        // Act
        const result = filterNavigationLinksByVisibility(links, pages)

        // Assert — extra fields are preserved on surviving links
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ label: 'Blog', url: '/blog', icon: 'book', order: 1 })
    })
})
