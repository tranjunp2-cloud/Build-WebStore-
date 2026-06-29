import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mocks — must be at top, before all imports ─────────────────────────────

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getComponent: vi.fn(),
    },
}))

vi.mock('@/blocks/ErrorBoundary', () => ({
    BlockErrorBoundary: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
}))

vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({
    GoogleFontsLoader: ({ fontHeading, fontBody }: { fontHeading?: string; fontBody?: string }) =>
        React.createElement('div', { 'data-testid': 'google-fonts-loader', 'data-heading': fontHeading, 'data-body': fontBody }),
}))

// ── Imports — after mocks ──────────────────────────────────────────────────
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { blockRegistry } from '@/blocks/registry'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Minimal test block component that renders its blockType as a data attribute */
function makeTestBlock(label: string) {
    const Comp = ({ block, theme, site }: { block: Record<string, unknown>; theme: Record<string, unknown>; site: Record<string, unknown> }) =>
        React.createElement('div', {
            'data-testid': `block-${label}`,
            'data-primary': (theme as Record<string, string>).primaryColor,
            'data-site-name': (site as Record<string, string>).name,
        })
    Comp.displayName = `TestBlock_${label}`
    return Comp
}

const mockGetComponent = vi.mocked(blockRegistry.getComponent)

const defaultSite = {
    name: 'Test Site',
    theme: {
        primaryColor: '#ff6600',
        secondaryColor: '#0000ff',
        backgroundColor: '#ffffff',
        fontHeading: 'Roboto',
        fontBody: 'Open Sans',
        colorMode: 'light' as const,
    },
}

const defaultPage = {
    layout: [{ blockType: 'hero', title: 'Hello' }],
}

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04.01 / TC-F04-SR-01 — renders blocks from page.layout via blockRegistry
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-01] SiteRenderer renders blocks from page.layout using blockRegistry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls blockRegistry.getComponent for each block in layout', () => {
        // Arrange
        const HeroBlock = makeTestBlock('hero')
        mockGetComponent.mockImplementation((type: string) =>
            type === 'hero' ? HeroBlock : null
        )

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'hero', title: 'Welcome' }] }}
            />
        )

        // Assert
        expect(mockGetComponent).toHaveBeenCalledWith('hero')
        expect(screen.getByTestId('block-hero')).toBeInTheDocument()
    })

    it('renders multiple blocks from layout array in order', () => {
        // Arrange
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'hero') return makeTestBlock('hero')
            if (type === 'footer') return makeTestBlock('footer')
            return null
        })

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'footer' },
                    ],
                }}
            />
        )

        // Assert
        expect(mockGetComponent).toHaveBeenCalledTimes(2)
        expect(screen.getByTestId('block-hero')).toBeInTheDocument()
        expect(screen.getByTestId('block-footer')).toBeInTheDocument()
    })

    it('prefers site.headerBlock over navigation block in page.layout', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'block-navigation' })
        }

        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlock : null
        )

        render(
            <SiteRenderer
                site={{
                    ...defaultSite,
                    headerBlock: {
                        blockType: 'navigation',
                        links: [
                            {
                                label: 'Services',
                                url: '/services',
                                children: [{ label: 'Consulting', url: '/services/consulting' }],
                            },
                        ],
                    },
                }}
                page={{
                    layout: [
                        { blockType: 'navigation', links: [{ label: 'Old Menu', url: '/old' }] },
                    ],
                }}
            />
        )

        expect(capturedBlocks[0].links).toEqual([
            {
                label: 'Services',
                url: '/services',
                children: [{ label: 'Consulting', url: '/services/consulting' }],
            },
        ])
    })

    it('injects site.headerBlock when page.layout does not contain navigation', () => {
        const NavBlock = makeTestBlock('navigation')
        const HeroBlock = makeTestBlock('hero')
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'navigation') return NavBlock
            if (type === 'hero') return HeroBlock
            return null
        })

        render(
            <SiteRenderer
                site={{
                    ...defaultSite,
                    headerBlock: {
                        blockType: 'navigation',
                        links: [{ label: 'Services', url: '/services' }],
                    },
                }}
                page={{ layout: [{ blockType: 'hero' }] }}
            />
        )

        expect(mockGetComponent).toHaveBeenNthCalledWith(1, 'navigation')
        expect(mockGetComponent).toHaveBeenNthCalledWith(2, 'hero')
        expect(screen.getByTestId('block-navigation')).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-02 — passes theme config to block components
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-02] SiteRenderer passes resolved theme config to block components', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards site.theme colours to block component as ThemeConfig', () => {
        // Arrange
        const HeroBlock = makeTestBlock('hero')
        mockGetComponent.mockReturnValue(HeroBlock)

        // Act
        render(
            <SiteRenderer
                site={{
                    ...defaultSite,
                    theme: { ...defaultSite.theme, primaryColor: '#ff6600' },
                }}
                page={{ layout: [{ blockType: 'hero' }] }}
            />
        )

        // Assert — test block renders data-primary from theme prop
        const block = screen.getByTestId('block-hero')
        expect(block).toHaveAttribute('data-primary', '#ff6600')
    })

    it('uses default theme values when site.theme is undefined', () => {
        // Arrange
        const capturedProps: Record<string, unknown>[] = []
        const SpyBlock = ({ theme }: { theme: Record<string, unknown> }) => {
            capturedProps.push(theme)
            return React.createElement('div', { 'data-testid': 'spy-block' })
        }
        mockGetComponent.mockReturnValue(SpyBlock)

        // Act
        render(
            <SiteRenderer
                site={{ name: 'No Theme Site' }}
                page={{ layout: [{ blockType: 'hero' }] }}
            />
        )

        // Assert — defaults from SiteRenderer source code.
        // Plan 260417 Wave 1 A2 — fallback changed dark cyan/magenta → light slate.
        expect(capturedProps[0]).toMatchObject({
            primaryColor: '#111827',
            secondaryColor: '#374151',
            backgroundColor: '#ffffff',
            fontHeading: 'Outfit',
            fontBody: 'Inter',
            colorMode: 'light',
        })
    })

    it('injects CSS variables for primary color into style tag', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer
                site={{ theme: { primaryColor: '#abcdef' } }}
                page={{ layout: [] }}
            />
        )

        // Assert
        const style = container.querySelector('style')
        expect(style?.textContent).toContain('--brand-primary: #abcdef')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-03 — passes site data to block components
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-03] SiteRenderer passes site data to block components', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards the full site object to each rendered block', () => {
        // Arrange
        const capturedSites: unknown[] = []
        const SpyBlock = ({ site }: { site: Record<string, unknown> }) => {
            capturedSites.push(site)
            return React.createElement('div', { 'data-testid': 'spy-block' })
        }
        mockGetComponent.mockReturnValue(SpyBlock)

        const siteWithData = {
            name: 'My Shop',
            contactInfo: { email: 'hello@shop.com' },
        }

        // Act
        render(
            <SiteRenderer
                site={siteWithData}
                page={{ layout: [{ blockType: 'hero' }] }}
            />
        )

        // Assert
        expect(capturedSites[0]).toMatchObject({ name: 'My Shop', contactInfo: { email: 'hello@shop.com' } })
    })

    it('forwards the page object to each rendered block', () => {
        // Arrange
        const capturedPages: unknown[] = []
        const SpyBlock = ({ page }: { page: Record<string, unknown> }) => {
            capturedPages.push(page)
            return React.createElement('div', { 'data-testid': 'spy-block' })
        }
        mockGetComponent.mockReturnValue(SpyBlock)

        const pageWithMeta = { slug: 'home', title: 'Home Page', layout: [{ blockType: 'hero' }] }

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={pageWithMeta}
            />
        )

        // Assert
        expect(capturedPages[0]).toMatchObject({ slug: 'home', title: 'Home Page' })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04.07 / TC-F04-SR-04 — skips unknown blockTypes silently
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-04] SiteRenderer skips unknown blockTypes silently (AC-6)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders nothing for a block type not in registry', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'non-existent-block' }] }}
            />
        )

        // Assert — only the style tag is rendered, no block content
        expect(container.querySelectorAll('[data-testid]')).toHaveLength(1) // only GoogleFontsLoader
        expect(mockGetComponent).toHaveBeenCalledWith('non-existent-block')
    })

    it('continues rendering known blocks after skipping an unknown one', () => {
        // Arrange
        const FooterBlock = makeTestBlock('footer')
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'footer') return FooterBlock
            return null
        })

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{
                    layout: [
                        { blockType: 'unknown-xyz' },
                        { blockType: 'footer' },
                    ],
                }}
            />
        )

        // Assert
        expect(screen.getByTestId('block-footer')).toBeInTheDocument()
    })

    it('skips block when blockType property is missing', () => {
        // Arrange
        mockGetComponent.mockReturnValue(makeTestBlock('hero'))

        // Act — inject object with no blockType
        const { container } = render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ title: 'Orphan block, no blockType' }] }}
            />
        )

        // Assert — getComponent must NOT have been called for a missing blockType
        expect(mockGetComponent).not.toHaveBeenCalled()
        expect(container.querySelectorAll('[data-testid]')).toHaveLength(1) // only GoogleFontsLoader
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04.10 / TC-F04-SR-05 — renders empty when page.layout is empty/undefined
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-05] SiteRenderer renders empty content when layout is empty or undefined', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders only style/font elements when layout is an empty array', () => {
        // Arrange — no blocks to look up
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer site={defaultSite} page={{ layout: [] }} />
        )

        // Assert
        expect(mockGetComponent).not.toHaveBeenCalled()
        const style = container.querySelector('style')
        expect(style).toBeInTheDocument()
    })

    it('renders only style/font elements when page.layout is undefined', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer site={defaultSite} page={{}} />
        )

        // Assert
        expect(mockGetComponent).not.toHaveBeenCalled()
        expect(container.querySelector('style')).toBeInTheDocument()
    })

    it('applies correct dark-mode body background CSS when layout is empty', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer
                site={{ theme: { colorMode: 'dark' } }}
                page={{ layout: [] }}
            />
        )

        // Assert
        const style = container.querySelector('style')
        expect(style?.textContent).toContain('background: #09090b')
    })

    it('applies correct light-mode body background CSS when layout is empty', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        // Act
        const { container } = render(
            <SiteRenderer
                site={{ theme: { colorMode: 'light' } }}
                page={{ layout: [] }}
            />
        )

        // Assert
        const style = container.querySelector('style')
        expect(style?.textContent).toContain('background: #ffffff')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-06 — nav always shows every authored link, regardless of page
// visibility. Hiding a page only affects its direct route (public query
// returns 404); the menu itself stays stable so users never see items
// disappear mid-session.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-06] SiteRenderer nav link visibility filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F04-SR-06a: visible pages keep their nav links; hidden page link is filtered for visitors', () => {
        // Slug-based matching: /services page is hidden → its nav link must be removed
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const links = [
            { label: 'Home', url: '/' },
            { label: 'Services', url: '/services' }, // isVisible=false below
            { label: 'About', url: '/about' },
        ]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
            { id: '3', slug: '/about', isVisible: true },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
                isOwner={false}
            />
        )

        // Services link filtered — only Home + About remain
        const renderedLinks = capturedBlocks[0].links as Array<{ label: string }>
        expect(renderedLinks.length).toBe(2)
        expect(renderedLinks.map((l: { label: string }) => l.label)).toEqual(['Home', 'About'])
    })

    it('TC-F05-959-01: URL-based links to hidden pages are filtered for visitors (non-owner, non-editor)', () => {
        // Arrange — links use URL/slug (actual data format, no reference.value)
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const links = [
            { label: 'Home', url: '/' },
            { label: 'Services', url: '/services' }, // isVisible=false page
            { label: 'About', url: '/about' },
        ]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
            { id: '3', slug: '/about', isVisible: true },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
                isOwner={false}
            />
        )

        // /services filtered out — only Home + About remain
        const renderedLinks = capturedBlocks[0].links as Array<{ label: string }>
        expect(renderedLinks.length).toBe(2)
        expect(renderedLinks.map(l => l.label)).toEqual(['Home', 'About'])
    })

    it('TC-F05-959-01b: hidden-page filtering handles case drift, query/hash, and trailing slash', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const links = [
            { label: 'Home', url: '/' },
            { label: 'Services Case', url: '/Services' },
            { label: 'Services Query', url: '/services?utm=nav' },
            { label: 'Services Hash', url: '/services#pricing' },
            { label: 'Services Slash', url: '/services/' },
            { label: 'About', url: '/about' },
        ]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
            { id: '3', slug: '/about', isVisible: true },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
                isOwner={false}
            />
        )

        const renderedLinks = capturedBlocks[0].links as Array<{ label: string }>
        expect(renderedLinks.map(l => l.label)).toEqual(['Home', 'About'])
    })

    it('TC-F05-959-02: links to hidden pages are preserved for owners', () => {
        // Owners always see all links (edit context)
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const links = [
            { label: 'Home', url: '/' },
            { label: 'Services', url: '/services' },
        ]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
                isOwner={true}
            />
        )

        // All links kept for owner
        expect((capturedBlocks[0].links as unknown[]).length).toBe(2)
    })

    it('TC-F05-959-03: links to soft-deleted pages are filtered for visitors', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const links = [
            { label: 'Home', url: '/' },
            { label: 'Old Page', url: '/old' },
        ]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true, deletedAt: null },
            { id: '2', slug: '/old', isVisible: true, deletedAt: '2026-05-01T00:00:00Z' },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
                isOwner={false}
            />
        )

        // Soft-deleted /old link filtered out
        const renderedLinks = capturedBlocks[0].links as Array<{ label: string }>
        expect(renderedLinks.length).toBe(1)
        expect(renderedLinks[0].label).toBe('Home')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F05-959-04 — footer column links to hidden pages are filtered for visitors
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F05-959-04] SiteRenderer footer hidden-page link filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F05-959-04a: footer links to hidden pages are filtered for visitors', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const FooterBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'footer-block' })
        }
        mockGetComponent.mockImplementation((type) => type === 'footer' ? FooterBlock : null)

        const columns = [{
            heading: 'Links',
            links: [
                { label: 'Home', url: '/' },
                { label: 'Services', url: '/services' },   // isVisible=false
                { label: 'About', url: '/about' },
            ],
        }]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
            { id: '3', slug: '/about', isVisible: true },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'footer', columns }] }}
                pages={pages}
                isOwner={false}
            />
        )

        const cols = capturedBlocks[0].columns as Array<{ links: Array<{ label: string }> }>
        expect(cols[0].links.map(l => l.label)).toEqual(['Home', 'About'])
    })

    it('TC-F05-959-04b: footer links to hidden pages are preserved for owners', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const FooterBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'footer-block' })
        }
        mockGetComponent.mockImplementation((type) => type === 'footer' ? FooterBlock : null)

        const columns = [{
            heading: 'Links',
            links: [
                { label: 'Home', url: '/' },
                { label: 'Services', url: '/services' },
            ],
        }]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/services', isVisible: false },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'footer', columns }] }}
                pages={pages}
                isOwner={true}
            />
        )

        const cols = capturedBlocks[0].columns as Array<{ links: Array<{ label: string }> }>
        expect(cols[0].links.map(l => l.label)).toEqual(['Home', 'Services'])
    })

    it('TC-F05-959-04c: footer links to soft-deleted pages are filtered for visitors', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const FooterBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'footer-block' })
        }
        mockGetComponent.mockImplementation((type) => type === 'footer' ? FooterBlock : null)

        const columns = [{
            heading: 'Links',
            links: [
                { label: 'Home', url: '/' },
                { label: 'Old Page', url: '/old' },
            ],
        }]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true, deletedAt: null },
            { id: '2', slug: '/old', isVisible: true, deletedAt: '2026-05-01T00:00:00Z' },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'footer', columns }] }}
                pages={pages}
                isOwner={false}
            />
        )

        const cols = capturedBlocks[0].columns as Array<{ links: Array<{ label: string }> }>
        expect(cols[0].links.map(l => l.label)).toEqual(['Home'])
    })

    it('TC-F05-959-04d: footer links to draft pages are filtered for visitors', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const FooterBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'footer-block' })
        }
        mockGetComponent.mockImplementation((type) => type === 'footer' ? FooterBlock : null)

        const columns = [{
            heading: 'Links',
            links: [
                { label: 'Home', url: '/' },
                { label: 'Draft Page', url: '/draft' },
                { label: 'About', url: '/about' },
            ],
        }]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/draft', isVisible: true, status: 'draft' },
            { id: '3', slug: '/about', isVisible: true, status: 'published' },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'footer', columns }] }}
                pages={pages}
                isOwner={false}
            />
        )

        const cols = capturedBlocks[0].columns as Array<{ links: Array<{ label: string }> }>
        expect(cols[0].links.map(l => l.label)).toEqual(['Home', 'About'])
    })

    it('TC-F05-959-04e: footer links in editor iframe are not filtered but stamped _hiddenFromVisitor', () => {
        const capturedBlocks: Record<string, unknown>[] = []
        const FooterBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'footer-block' })
        }
        mockGetComponent.mockImplementation((type) => type === 'footer' ? FooterBlock : null)

        const columns = [{
            heading: 'Links',
            links: [
                { label: 'Home', url: '/' },
                { label: 'Hidden Page', url: '/hidden' },
            ],
        }]
        const pages = [
            { id: '1', slug: '/', isHomepage: true, isVisible: true },
            { id: '2', slug: '/hidden', isVisible: false },
        ]

        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'footer', columns }] }}
                pages={pages}
                isEditor={true}
                isEditorIframe={true}
                isOwner={true}
            />
        )

        const cols = capturedBlocks[0].columns as Array<{ links: Array<{ label: string; _hiddenFromVisitor?: boolean }> }>
        // Both links present (not filtered)
        expect(cols[0].links.map(l => l.label)).toEqual(['Home', 'Hidden Page'])
        // Hidden page link gets the indicator flag
        expect(cols[0].links[1]._hiddenFromVisitor).toBe(true)
        expect(cols[0].links[0]._hiddenFromVisitor).toBeFalsy()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-07 — GoogleFontsLoader receives correct fonts from theme
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-07] SiteRenderer renders GoogleFontsLoader with correct fonts from theme', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockReturnValue(null)
    })

    it('passes fontHeading and fontBody from site.theme to GoogleFontsLoader', () => {
        // Arrange
        const site = {
            theme: {
                fontHeading: 'Poppins',
                fontBody: 'Nunito',
            },
        }

        // Act
        render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const loader = screen.getByTestId('google-fonts-loader')
        expect(loader).toHaveAttribute('data-heading', 'Poppins')
        expect(loader).toHaveAttribute('data-body', 'Nunito')
    })

    it('passes default font names when site.theme does not specify fonts', () => {
        // Act
        render(<SiteRenderer site={{ name: 'Bare Site' }} page={{ layout: [] }} />)

        // Assert
        const loader = screen.getByTestId('google-fonts-loader')
        expect(loader).toHaveAttribute('data-heading', 'Outfit')
        expect(loader).toHaveAttribute('data-body', 'Inter')
    })

    it('always renders exactly one GoogleFontsLoader per page', () => {
        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'hero' }, { blockType: 'footer' }] }}
            />
        )

        // Assert
        const loaders = screen.getAllByTestId('google-fonts-loader')
        expect(loaders).toHaveLength(1)
    })

    it('CSS variables reference next/font scoped vars from theme (post-F01D fix)', () => {
        // Arrange — both Merriweather and Lato are mapped in FONT_CSS_VAR_MAP
        // and loaded in AppShell. Both hit the known-font branch (literal first).
        const site = { theme: { fontHeading: 'Merriweather', fontBody: 'Lato' } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const style = container.querySelector('style')
        // Merriweather: mapped, literal first (single-word, unquoted)
        expect(style?.textContent).toContain('--font-heading: Merriweather,')
        expect(style?.textContent).toContain('var(--font-merriweather)')
        // Lato: mapped (GH-737 fix — now loaded in AppShell + in FONT_CSS_VAR_MAP)
        expect(style?.textContent).toContain('--font-body: Lato,')
        expect(style?.textContent).toContain('var(--font-lato)')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-S1-003 — SiteRenderer injects 20+ CSS variables via generateThemeCSS
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-S1-003] SiteRenderer injects 20+ CSS variables from resolveTheme + generateThemeCSS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockReturnValue(null)
    })

    it('injects all color CSS variables', () => {
        // Arrange
        const site = {
            theme: {
                primaryColor: '#0ea5e9',
                secondaryColor: '#d946ef',
                accentColor: '#7dd3fc',
                surfaceColor: '#111111',
                textColor: '#fafafa',
                mutedColor: '#a1a1aa',
                colorMode: 'dark' as const,
                backgroundColor: '#09090b',
            },
        }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const style = container.querySelector('style')
        const css = style?.textContent || ''
        expect(css).toContain('--brand-primary: #0ea5e9')
        expect(css).toContain('--brand-secondary: #d946ef')
        expect(css).toContain('--brand-accent: #7dd3fc')
        expect(css).toContain('--surface: #111111')
        expect(css).toContain('--text: #fafafa')
        expect(css).toContain('--muted: #a1a1aa')
        expect(css).toContain('--background: #09090b')
    })

    it('injects RGB variants for opacity support', () => {
        // Arrange
        const site = { theme: { primaryColor: '#0ea5e9', secondaryColor: '#d946ef' } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('--brand-primary-rgb:')
        expect(css).toContain('--brand-secondary-rgb:')
        expect(css).toContain('--brand-accent-rgb:')
    })

    it('injects spacing CSS variables', () => {
        // Arrange
        const site = { theme: { spacingPreset: 'default' as const } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('--space-xs:')
        expect(css).toContain('--space-sm:')
        expect(css).toContain('--space-md:')
        expect(css).toContain('--space-lg:')
        expect(css).toContain('--space-xl:')
        expect(css).toContain('--space-2xl:')
        expect(css).toContain('--section-padding:')
    })

    it('injects radius and shadow CSS variables', () => {
        // Arrange
        const site = { theme: { borderRadius: 'rounded' as const, shadowPreset: 'subtle' as const } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('--radius-sm:')
        expect(css).toContain('--radius-md:')
        expect(css).toContain('--radius-lg:')
        expect(css).toContain('--radius-full:')
        expect(css).toContain('--shadow-sm:')
        expect(css).toContain('--shadow-md:')
        expect(css).toContain('--shadow-lg:')
    })

    it('body uses var(--background) and var(--text)', () => {
        // Act
        const { container } = render(<SiteRenderer site={{ name: 'Test' }} page={{ layout: [] }} />)

        // Assert
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('background: var(--background)')
        expect(css).toContain('color: var(--text)')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-S1-004 — Backward compat — legacy site with only 2 colors renders with derived tokens
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-S1-004] SiteRenderer backward compat — legacy site with 2 colors renders with derived tokens', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockReturnValue(null)
    })

    it('legacy site with only primaryColor + secondaryColor still generates all CSS vars', () => {
        // Arrange — minimal v1 config
        const site = {
            theme: {
                primaryColor: '#0ea5e9',
                secondaryColor: '#d946ef',
                colorMode: 'dark' as const,
            },
        }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert — all CSS vars should still be present
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('--brand-primary: #0ea5e9')
        expect(css).toContain('--brand-secondary: #d946ef')
        expect(css).toContain('--brand-accent:')
        expect(css).toContain('--surface: #111111')
        expect(css).toContain('--text: #fafafa')
        expect(css).toContain('--muted: #a1a1aa')
        expect(css).toContain('--space-xs:')
        expect(css).toContain('--radius-sm:')
        expect(css).toContain('--shadow-sm:')
    })

    it('legacy site without any theme still renders with default tokens', () => {
        // Arrange — no theme at all
        const site = { name: 'Legacy Site No Theme' }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert — Plan 260417 Wave 1 A2: fallback now light slate.
        const css = container.querySelector('style')?.textContent || ''
        expect(css).toContain('--brand-primary: #111827')
        expect(css).toContain('--brand-secondary: #374151')
        expect(css).toContain('--font-heading:')
        expect(css).toContain('--font-body:')
        expect(css).toContain('--space-md:')
        expect(css).toContain('--radius-md:')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F01-GH770 — isBuilderPreview prop appends builder=1 to nav URL rewrites
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F01-GH770] SiteRenderer — builder preview nav URL rewriting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01-GH770-01: appends &builder=1 to rewritten nav URLs when isBuilderPreview=true', () => {
        // Arrange — capture how nav blocks receive the rewritten URL
        const capturedNavData: Record<string, unknown>[] = []
        const NavBlockSpy = (props: Record<string, unknown>) => {
            capturedNavData.push(props)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlockSpy : null
        )

        const site = { name: 'Test Site' }
        const page = {
            layout: [
                {
                    blockType: 'navigation',
                    links: [
                        {
                            label: 'Home',
                            slug: '/',
                            target: { slug: '/' },
                        },
                        {
                            label: 'About',
                            slug: '/about',
                            target: { slug: '/about' },
                        },
                    ],
                },
            ],
        }
        const pages = [
            { id: 'page-1', slug: '/', title: 'Home' },
            { id: 'page-2', slug: '/about', title: 'About' },
        ]

        // Act — render with isBuilderPreview=true
        render(
            <SiteRenderer
                site={site}
                page={page}
                pages={pages}
                isBuilderPreview={true}
            />
        )

        // Assert — nav block should receive links with rewritten URLs that include &builder=1
        expect(screen.getByTestId('nav-block')).toBeInTheDocument()
    })

    it('TC-F01-GH770-02: does not append &builder=1 to nav URLs when isBuilderPreview=false', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        const site = { name: 'Test Site' }
        const page = {
            layout: [
                {
                    blockType: 'navigation',
                    links: [
                        {
                            label: 'Home',
                            slug: '/',
                            target: { slug: '/' },
                        },
                    ],
                },
            ],
        }
        const pages = [{ id: 'page-1', slug: '/', title: 'Home' }]

        // Act — render with isBuilderPreview=false (or omitted, defaults to false)
        const { container } = render(
            <SiteRenderer
                site={site}
                page={page}
                pages={pages}
                isBuilderPreview={false}
            />
        )

        // Assert — component should render without error
        expect(container).toBeInTheDocument()
    })

    it('TC-F01-GH770-03: isBuilderPreview defaults to false', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        const site = { name: 'Test Site' }
        const page = { layout: [] }

        // Act — render without isBuilderPreview prop
        const { container } = render(
            <SiteRenderer
                site={site}
                page={page}
            />
        )

        // Assert — component should render with default behavior (no &builder=1)
        expect(container).toBeInTheDocument()
    })

    it('TC-F01-GH770-04: builder parameter is independent of isEditor prop', () => {
        // Arrange
        mockGetComponent.mockReturnValue(null)

        const site = { name: 'Test Site' }
        const page = { layout: [] }

        // Act — render with both isEditor=true and isBuilderPreview=true
        const { container: editorBuilder } = render(
            <SiteRenderer
                site={site}
                page={page}
                isEditor={true}
                isBuilderPreview={true}
            />
        )

        // Assert
        expect(editorBuilder).toBeInTheDocument()
    })

    it('TC-F01-GH770-05: builder parameter does not affect non-navigation link processing', () => {
        // Arrange
        const capturedBlocks: Record<string, unknown>[] = []
        const SpyBlock = (props: Record<string, unknown>) => {
            capturedBlocks.push(props)
            return React.createElement('div', { 'data-testid': 'spy-block' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'hero' ? SpyBlock : null
        )

        const site = { name: 'Test Site' }
        const page = {
            layout: [
                {
                    blockType: 'hero',
                    title: 'Welcome',
                    link: { href: '/some-page' },
                },
            ],
        }

        // Act — render with isBuilderPreview=true
        render(
            <SiteRenderer
                site={site}
                page={page}
                isBuilderPreview={true}
            />
        )

        // Assert — hero block should still render normally
        expect(screen.getByTestId('spy-block')).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-NAV-EDITOR — nav paddingTop offset: overlay variants in editor vs live site
// Overlay navs (transparent/floating) are fixed-position — in editor the first
// content block needs paddingTop so it isn't hidden behind the nav. On the live
// site the overlay is intentional (hero bg fills behind nav), so no offset.
// Sticky navs (default/centered/mega) are tested implicitly — they never receive
// the offset since they are in document flow (see SiteRenderer.tsx OVERLAY_NAV_VARIANTS).
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-NAV-EDITOR] SiteRenderer nav offset for overlay variants (editor vs live)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'navigation') return makeTestBlock('navigation')
            if (type === 'hero') return makeTestBlock('hero')
            return null
        })
    })

    const pageWithHero = { layout: [{ blockType: 'hero' }] }

    it('TC-NAV-EDITOR-01: floating nav + isEditor=true → first content block gets nav-height paddingTop (with +1rem for top-4 offset)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'floating' } }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={true} />
        )

        // Assert — editor wrapper carries data-block-type for querying
        const heroWrapper = container.querySelector('[data-block-type="hero"]') as HTMLElement
        expect(heroWrapper).not.toBeNull()
        expect(heroWrapper.style.paddingTop).toBe('calc(var(--nav-height, 64px) + 1rem)')
    })

    it('TC-NAV-EDITOR-02: transparent nav + isEditor=true → first content block gets nav-height paddingTop', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'transparent' } }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={true} />
        )

        // Assert
        const heroWrapper = container.querySelector('[data-block-type="hero"]') as HTMLElement
        expect(heroWrapper).not.toBeNull()
        expect(heroWrapper.style.paddingTop).toBe('var(--nav-height, 64px)')
    })

    it('TC-NAV-EDITOR-03: floating nav + isEditor=false → no nav-height offset on live site (overlay intentional)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'floating' } }

        // Act
        render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert — live site: hero bg fills behind fixed nav, offset would create white gap
        const heroWrapper = screen.getByTestId('block-hero').parentElement as HTMLElement
        expect(heroWrapper.style.paddingTop).toBe('var(--block-spacing-default)')
        expect(heroWrapper.style.paddingTop).not.toBe('calc(var(--nav-height, 64px) + 1rem)')
    })

    it('TC-NAV-EDITOR-04: transparent nav + isEditor=false → no nav-height offset on live site (overlay intentional)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'transparent' } }

        // Act
        render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert
        const heroWrapper = screen.getByTestId('block-hero').parentElement as HTMLElement
        expect(heroWrapper.style.paddingTop).toBe('var(--block-spacing-default)')
        expect(heroWrapper.style.paddingTop).not.toBe('var(--nav-height, 64px)')
    })

    it('TC-NAV-EDITOR-05: legacy variant "pill" (alias for floating) + isEditor=true → gets floating paddingTop offset', () => {
        // Arrange — 'pill' is stored in legacy DB rows; NavigationBlock aliases it to 'floating' at render
        // SiteRenderer must normalize through NAV_VARIANT_DB_ALIASES so legacy sites get the same offset
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'pill' } }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={true} />
        )

        // Assert — 'pill' → 'floating' → calc offset (same as TC-NAV-EDITOR-01)
        const heroWrapper = container.querySelector('[data-block-type="hero"]') as HTMLElement
        expect(heroWrapper).not.toBeNull()
        expect(heroWrapper.style.paddingTop).toBe('calc(var(--nav-height, 64px) + 1rem)')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-GH1412-01 — GH-1412 regression: nav-offset respects explicit blockSpacing.paddingTop
// When overlay nav + editor + user sets blockSpacing.paddingTop, wrapper must use user's value
// (not nav-height override). Default behavior (no user setting) → still use nav-height.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-GH1412-01] SiteRenderer nav-offset respects explicit blockSpacing.paddingTop', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'navigation') return makeTestBlock('navigation')
            if (type === 'cta') return makeTestBlock('cta')
            return null
        })
    })

    it('TC-F04-SR-GH1412-01a: overlay nav + isEditor=true + user-set blockSpacing.paddingTop=120 → wrapper paddingTop = "120px" (not nav-height)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'floating' } }
        const pageWithCTASpacing = {
            layout: [
                {
                    blockType: 'cta',
                    headline: 'Join us',
                    ctaLabel: 'Sign up',
                    blockSpacing: { paddingTop: 120 },
                },
            ],
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithCTASpacing} isEditor={true} />
        )

        // Assert — wrapper should respect user's 120px, not nav-height offset
        const ctaWrapper = container.querySelector('[data-block-type="cta"]') as HTMLElement
        expect(ctaWrapper).not.toBeNull()
        expect(ctaWrapper.style.paddingTop).toBe('120px')
        expect(ctaWrapper.style.paddingTop).not.toBe('calc(var(--nav-height, 64px) + 1rem)')
    })

    it('TC-F04-SR-GH1412-01b: overlay nav + isEditor=true + NO user blockSpacing.paddingTop → wrapper uses nav-height default (floating)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'floating' } }
        const pageWithCTA = {
            layout: [
                {
                    blockType: 'cta',
                    headline: 'Join us',
                    ctaLabel: 'Sign up',
                    // NO blockSpacing set — should use default nav-offset
                },
            ],
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithCTA} isEditor={true} />
        )

        // Assert — with no user blockSpacing, should fall back to nav-height offset
        const ctaWrapper = container.querySelector('[data-block-type="cta"]') as HTMLElement
        expect(ctaWrapper).not.toBeNull()
        expect(ctaWrapper.style.paddingTop).toBe('calc(var(--nav-height, 64px) + 1rem)')
    })

    it('TC-F04-SR-GH1412-01c: transparent nav + isEditor=true + user-set blockSpacing.paddingTop=80 → uses "80px" (not nav-height)', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'transparent' } }
        const pageWithCTASpacing = {
            layout: [
                {
                    blockType: 'cta',
                    headline: 'Join us',
                    ctaLabel: 'Sign up',
                    blockSpacing: { paddingTop: 80 },
                },
            ],
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithCTASpacing} isEditor={true} />
        )

        // Assert
        const ctaWrapper = container.querySelector('[data-block-type="cta"]') as HTMLElement
        expect(ctaWrapper).not.toBeNull()
        expect(ctaWrapper.style.paddingTop).toBe('80px')
        expect(ctaWrapper.style.paddingTop).not.toBe('var(--nav-height, 64px)')
    })

    it('TC-F04-SR-GH1412-01d: non-overlay nav (sticky/default) does NOT apply nav-offset even in editor', () => {
        // Arrange — sticky nav should never trigger applyNavOffset
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'default' } }
        const pageWithCTA = {
            layout: [
                {
                    blockType: 'cta',
                    headline: 'Join us',
                    ctaLabel: 'Sign up',
                    blockSpacing: { paddingTop: 60 },
                },
            ],
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithCTA} isEditor={true} />
        )

        // Assert — should use the explicit blockSpacing value (sticky nav doesn't trigger offset)
        const ctaWrapper = container.querySelector('[data-block-type="cta"]') as HTMLElement
        expect(ctaWrapper).not.toBeNull()
        expect(ctaWrapper.style.paddingTop).toBe('60px')
    })

    it('TC-F04-SR-GH1412-01e: overlay nav + isEditor=true + user-set blockSpacing.paddingTop=0 → uses "0px" (explicit 0 wins over nav-offset)', () => {
        // Arrange — paddingTop=0 is a deliberate user choice; `0 === undefined` is false
        // so it must NOT fall back to the nav-height default.
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'floating' } }
        const pageWithZeroSpacing = {
            layout: [
                {
                    blockType: 'cta',
                    headline: 'Join us',
                    ctaLabel: 'Sign up',
                    blockSpacing: { paddingTop: 0 },
                },
            ],
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithZeroSpacing} isEditor={true} />
        )

        // Assert — explicit 0 must be respected, not overridden by nav-offset
        const ctaWrapper = container.querySelector('[data-block-type="cta"]') as HTMLElement
        expect(ctaWrapper).not.toBeNull()
        expect(ctaWrapper.style.paddingTop).toBe('0px')
        expect(ctaWrapper.style.paddingTop).not.toBe('calc(var(--nav-height, 64px) + 1rem)')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-07 — SiteRenderer injects _logoHref into navigation blocks
// Logo redirect fix (GH-1278): ensures logo link is rewritten for local dev
//
// Note: TC-IDs are prefixed F04 (Block Renderer QA doc) because this tests
// SiteRenderer's _logoHref injection behaviour which is a block-renderer
// concern. Tests live here (f05-site-renderer.test.tsx) because the subject
// under test is SiteRenderer — there is no separate F04 test file for it.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-GH1412-02 — GH-1412 regression: CTA floating-sticky joins floating widget stack
// CTA floats (joins floating container) only in floating-sticky variant.
// Other CTA variants (banner/card/etc) render in normal flow, not floating.
// CTA + whatsapp-button (both floating-sticky / bottom-right) → grouped in same floating container,
// NOT overlapping. Tests verify floatingBlockSet excludes other-variant CTA + renders correctly.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-GH1412-02] SiteRenderer floating-sticky CTA joins widget stack', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'cta') return makeTestBlock('cta')
            if (type === 'whatsapp-button') return makeTestBlock('whatsapp-button')
            return null
        })
    })

    it('TC-F04-SR-GH1412-02a: CTA floating-sticky + whatsapp-button bottom-right → both in same floating container z-[51]', () => {
        // Arrange — both blocks should join floatingBlockSet and render in grouped bottom-right container
        const page = {
            layout: [
                { blockType: 'cta', variant: 'floating-sticky', headline: 'Join us' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — both blocks should NOT appear in main flow (no [data-block-type="cta"] wrapper in main content)
        const mainFlowCTA = container.querySelector('[data-block-type="cta"]')
        expect(mainFlowCTA).toBeNull()

        // Assert — both blocks should be inside the floating container (z-[51] div with bottom-6 right-6)
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]')
        expect(floatingContainer).toBeInTheDocument()

        // Assert — outer group lays out vertically on mobile (flex-col) and horizontally on
        // desktop (md:flex-row); the launcher column keeps its own flex-col-reverse stack.
        expect(floatingContainer?.classList.contains('flex')).toBe(true)
        expect(floatingContainer?.classList.contains('flex-col')).toBe(true)
        expect(floatingContainer?.classList.contains('md:flex-row')).toBe(true)
        expect(floatingContainer?.classList.contains('gap-3')).toBe(true)

        // Assert — both test blocks should render inside the floating container
        expect(screen.getByTestId('block-cta')).toBeInTheDocument()
        expect(screen.getByTestId('block-whatsapp-button')).toBeInTheDocument()
    })

    it('TC-F04-SR-GH1412-02b: CTA variant="card" (non-floating) renders in main flow, NOT in floating container', () => {
        // Arrange — CTA variant != 'floating-sticky' should NOT join floating stack
        const page = {
            layout: [
                { blockType: 'cta', variant: 'card', headline: 'Special offer' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — card CTA test block should render somewhere in the document (not null)
        const ctaTestBlock = screen.getByTestId('block-cta')
        expect(ctaTestBlock).toBeInTheDocument()

        // Assert — card CTA should NOT be inside the floating container
        // Verify: look for block-type=cta inside floating container → should not find
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]')
        if (floatingContainer) {
            const ctaInFloating = floatingContainer.querySelector('[data-testid="block-cta"]')
            expect(ctaInFloating).toBeNull() // CTA should not be in floating container

            // Only whatsapp should be in floating container
            const whatsappInFloating = floatingContainer.querySelector('[data-testid="block-whatsapp-button"]')
            expect(whatsappInFloating).toBeInTheDocument()
        }
    })

    it('TC-F04-SR-GH1412-02c: whatsapp-button alone in bottom-right renders in floating container (regression test)', () => {
        // Arrange — verify whatsapp floating behavior unchanged when no CTA present
        const page = {
            layout: [
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — whatsapp should be in floating container
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]')
        expect(floatingContainer).toBeInTheDocument()
        expect(screen.getByTestId('block-whatsapp-button')).toBeInTheDocument()

        // Assert — container has correct styling
        expect(floatingContainer?.classList.contains('flex')).toBe(true)
        expect(floatingContainer?.classList.contains('flex-col-reverse')).toBe(true)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-GH1412-03 — CTA floating-sticky is a SEPARATE block beside the launcher column
// GH-1412: the launcher widgets (WhatsApp/social/cart) keep their own untouched
// flex-col-reverse column; a floating-sticky CTA renders as a sibling next to it,
// NOT inside the launcher column.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-GH1412-03] SiteRenderer CTA floating-sticky separated from launcher column', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'cta') return makeTestBlock('cta')
            if (type === 'whatsapp-button') return makeTestBlock('whatsapp-button')
            return null
        })
    })

    it('TC-F04-SR-GH1412-03a: launcher column (flex-col-reverse) holds whatsapp but NOT the CTA', () => {
        // Arrange
        const page = {
            layout: [
                { blockType: 'cta', variant: 'floating-sticky', headline: 'Join now' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — both blocks present in the floating group
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]')
        expect(floatingContainer).toBeInTheDocument()
        expect(floatingContainer?.querySelectorAll('[data-testid]').length).toBe(2)

        // Assert — the nested launcher column keeps its own flex-col-reverse stack and
        // contains the whatsapp launcher but NOT the CTA (CTA is a separate sibling).
        const launcherColumn = floatingContainer?.querySelector('.flex.flex-col-reverse')
        expect(launcherColumn).toBeInTheDocument()
        expect(launcherColumn?.querySelector('[data-testid="block-whatsapp-button"]')).toBeInTheDocument()
        expect(launcherColumn?.querySelector('[data-testid="block-cta"]')).toBeNull()
    })

    it('TC-F04-SR-GH1412-03b: CTA renders before the launcher column in DOM (CTA left on desktop, top on mobile)', () => {
        // Arrange — author order does not matter; CTA must still precede the launcher column
        const page = {
            layout: [
                { blockType: 'whatsapp-button', position: 'bottom-right' },
                { blockType: 'cta', variant: 'floating-sticky', headline: 'Contact us' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — direct children of the group: [CTA block, launcher column]
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]') as HTMLElement
        const directChildren = Array.from(floatingContainer.children) as HTMLElement[]
        expect(directChildren.length).toBe(2)
        // First direct child holds the CTA; second is the launcher column.
        expect(directChildren[0].querySelector('[data-testid="block-cta"]')).toBeInTheDocument()
        expect(directChildren[1].classList.contains('flex-col-reverse')).toBe(true)
        expect(directChildren[1].querySelector('[data-testid="block-whatsapp-button"]')).toBeInTheDocument()
    })

    it('TC-F04-SR-GH1412-03c: CTA non-floating variant stays in main flow, not in floating container', () => {
        // Arrange — CTA variant='card' (not floating-sticky) should NOT join floating stack
        // Only whatsapp should be in the bottom-right floating container
        const page = {
            layout: [
                { blockType: 'cta', variant: 'card', headline: 'Special offer' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — floating container should only have whatsapp (1 child)
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]')
        const floatingChildren = floatingContainer?.querySelectorAll('[data-testid]')
        expect(floatingChildren?.length).toBe(1)
        expect(floatingChildren?.[0]?.getAttribute('data-testid')).toBe('block-whatsapp-button')

        // Assert — card CTA renders in main flow (somewhere else in document)
        const ctaInMain = screen.getByTestId('block-cta')
        expect(ctaInMain).toBeInTheDocument()
        // Verify it's NOT inside the floating container
        expect(floatingContainer?.contains(ctaInMain)).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-GH1412-04 — bottom-right group responsive layout
// GH-1412: a bottom-right group that contains a floating-sticky CTA lays out
// horizontally on desktop (md:flex-row) but stays a vertical stack on mobile
// (flex-col-reverse) so the wide CTA card never overflows the viewport width.
// Widget-only groups (no CTA) stay vertical at every breakpoint.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-GH1412-04] SiteRenderer bottom-right responsive layout (CTA → md:flex-row)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'cta') return makeTestBlock('cta')
            if (type === 'whatsapp-button') return makeTestBlock('whatsapp-button')
            return null
        })
    })

    it('TC-F04-SR-GH1412-04a: CTA floating-sticky + whatsapp → container is horizontal on desktop (md:flex-row), vertical on mobile (flex-col-reverse)', () => {
        // Arrange
        const page = {
            layout: [
                { blockType: 'cta', variant: 'floating-sticky', headline: 'Join now' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — bottom-right floating group opts into the desktop row layout
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]') as HTMLElement
        expect(floatingContainer).toBeInTheDocument()
        expect(floatingContainer.className).toContain('md:flex-row')
        // Mobile stays a vertical stack (outer column; launcher sub-column keeps flex-col-reverse)
        expect(floatingContainer.className).toContain('flex-col')
    })

    it('TC-F04-SR-GH1412-04b: whatsapp only (no CTA) → container stays vertical, NO md:flex-row', () => {
        // Arrange — widget-only bottom-right group must not switch to horizontal
        const page = {
            layout: [
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]') as HTMLElement
        expect(floatingContainer).toBeInTheDocument()
        expect(floatingContainer.className).not.toContain('md:flex-row')
        expect(floatingContainer.className).toContain('flex-col-reverse')
    })

    it('TC-F04-SR-GH1412-04c: multiple floating-sticky CTAs stack in a column (no horizontal overflow)', () => {
        // Arrange — two floating-sticky CTAs must stack vertically in the CTA column, not spread
        // across the desktop row (which would overflow the viewport width).
        const page = {
            layout: [
                { blockType: 'cta', variant: 'floating-sticky', headline: 'First CTA' },
                { blockType: 'cta', variant: 'floating-sticky', headline: 'Second CTA' },
                { blockType: 'whatsapp-button', position: 'bottom-right' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — first direct child is the CTA column holding BOTH CTAs
        const floatingContainer = container.querySelector('.fixed.bottom-6.right-6.z-\\[51\\]') as HTMLElement
        const ctaColumn = floatingContainer.children[0] as HTMLElement
        expect(ctaColumn.className).toContain('flex-col')
        expect(ctaColumn.querySelectorAll('[data-testid="block-cta"]').length).toBe(2)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F04-SR-07 — SiteRenderer injects _logoHref into navigation blocks
// Logo redirect fix (GH-1278): ensures logo link is rewritten for local dev
//
// Note: TC-IDs are prefixed F04 (Block Renderer QA doc) because this tests
// SiteRenderer's _logoHref injection behaviour which is a block-renderer
// concern. Tests live here (f05-site-renderer.test.tsx) because the subject
// under test is SiteRenderer — there is no separate F04 test file for it.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-07] SiteRenderer injects _logoHref into navigation blocks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F04-SR-07a: navigation block in page.layout gets _logoHref: "/" in non-editor mode', () => {
        // Arrange — capture block props to verify _logoHref injection
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'block-navigation' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlock : null
        )

        // Act — render SiteRenderer with navigation block in page.layout
        render(
            <SiteRenderer
                site={defaultSite}
                page={{
                    layout: [
                        {
                            blockType: 'navigation',
                            links: [
                                { label: 'Home', url: '/' },
                                { label: 'About', url: '/about' },
                            ],
                        },
                    ],
                }}
            />
        )

        // Assert — navigation block should receive _logoHref property injected
        expect(capturedBlocks.length).toBeGreaterThan(0)
        expect(capturedBlocks[0]._logoHref).toBe('/')
    })

    it('TC-F04-SR-07b: site.headerBlock also gets _logoHref: "/" injected', () => {
        // Arrange — capture block props to verify _logoHref injection on headerBlock
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'block-navigation' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlock : null
        )

        // Act — render SiteRenderer with site.headerBlock
        render(
            <SiteRenderer
                site={{
                    ...defaultSite,
                    headerBlock: {
                        blockType: 'navigation',
                        links: [
                            { label: 'Services', url: '/services' },
                            { label: 'Contact', url: '/contact' },
                        ],
                    },
                }}
                page={{ layout: [] }}
            />
        )

        // Assert — headerBlock navigation should receive _logoHref property injected
        expect(capturedBlocks.length).toBeGreaterThan(0)
        expect(capturedBlocks[0]._logoHref).toBe('/')
    })

    it('TC-F04-SR-07c: SiteRenderer in editor mode injects _logoHref pointing to preview URL', () => {
        // Arrange — capture block props to verify preview URL injection in editor mode
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'block-navigation' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlock : null
        )

        // Act — render SiteRenderer with isEditor=true and homepage
        render(
            <SiteRenderer
                site={{ ...defaultSite, id: 'site-abc' }}
                page={{
                    id: 'page-xyz',
                    slug: '/',
                    isHomepage: true,
                    layout: [{ blockType: 'navigation', links: [{ label: 'Home', url: '/' }] }],
                }}
                pages={[{ id: 'page-xyz', slug: '/', isHomepage: true }]}
                isEditor={true}
            />
        )

        // Assert — navigation block should receive preview URL in _logoHref
        expect(capturedBlocks.length).toBeGreaterThan(0)
        expect(capturedBlocks[0]._logoHref).toBe('/preview/site-abc?pageId=page-xyz')
    })

    it('TC-F04-SR-07d: SiteRenderer in editor mode with no homepage page → _logoHref = "#" (safe fallback)', () => {
        // Arrange — capture block props to verify fallback behavior when no homepage
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'block-navigation' })
        }
        mockGetComponent.mockImplementation((type: string) =>
            type === 'navigation' ? NavBlock : null
        )

        // Act — render SiteRenderer with isEditor=true but empty pages array (no homepage found)
        render(
            <SiteRenderer
                site={{ ...defaultSite, id: 'site-abc' }}
                page={{
                    id: 'page-xyz',
                    slug: '/about',
                    layout: [{ blockType: 'navigation', links: [{ label: 'About', url: '/about' }] }],
                }}
                pages={[]}
                isEditor={true}
            />
        )

        // Assert — navigation block should receive safe fallback "#" when homepage not found
        expect(capturedBlocks.length).toBeGreaterThan(0)
        expect(capturedBlocks[0]._logoHref).toBe('#')
    })
})
