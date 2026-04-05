import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mocks — must be at top, before all imports ─────────────────────────────

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getComponent: vi.fn(),
    },
}))

vi.mock('@/lib/navigation', () => ({
    filterNavigationLinksByVisibility: vi.fn((links: unknown[]) => links ?? []),
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
import { filterNavigationLinksByVisibility } from '@/lib/navigation'

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
const mockFilterLinks = vi.mocked(filterNavigationLinksByVisibility)

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

        // Assert — defaults from SiteRenderer source code
        expect(capturedProps[0]).toMatchObject({
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            backgroundColor: '#09090b',
            fontHeading: 'Outfit',
            fontBody: 'Inter',
            colorMode: 'dark',
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
// TC-F04.06 / TC-F04-SR-06 — navigation link filtering via filterNavigationLinksByVisibility
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F04-SR-06] SiteRenderer applies navigation link filtering for nav blocks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls filterNavigationLinksByVisibility for navigation blockType', () => {
        // Arrange
        const NavBlock = makeTestBlock('navigation')
        mockGetComponent.mockReturnValue(NavBlock)
        const links = [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
        ]
        const pages = [
            { id: '1', slug: 'about', isVisible: false },
        ]
        mockFilterLinks.mockReturnValue([{ label: 'Home', url: '/' }])

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                pages={pages}
            />
        )

        // Assert
        expect(mockFilterLinks).toHaveBeenCalledWith(links, pages)
    })

    it('does NOT call filterNavigationLinksByVisibility for non-navigation blocks', () => {
        // Arrange
        const HeroBlock = makeTestBlock('hero')
        mockGetComponent.mockReturnValue(HeroBlock)

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'hero', links: [] }] }}
            />
        )

        // Assert
        expect(mockFilterLinks).not.toHaveBeenCalled()
    })

    it('passes filtered links (not original links) to NavigationBlock component', () => {
        // Arrange
        const capturedBlocks: Record<string, unknown>[] = []
        const NavBlock = ({ block }: { block: Record<string, unknown> }) => {
            capturedBlocks.push(block)
            return React.createElement('div', { 'data-testid': 'nav-block' })
        }
        mockGetComponent.mockReturnValue(NavBlock)

        const originalLinks = [
            { label: 'Home', url: '/' },
            { label: 'Hidden', url: '/hidden' },
        ]
        const filteredLinks = [{ label: 'Home', url: '/' }]
        mockFilterLinks.mockReturnValue(filteredLinks)

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links: originalLinks }] }}
                pages={[]}
            />
        )

        // Assert — block passed to NavBlock must have the filtered links
        expect(capturedBlocks[0].links).toEqual(filteredLinks)
        expect(capturedBlocks[0].links).not.toEqual(originalLinks)
    })

    it('defaults pages to [] when not provided — passes empty array to filter', () => {
        // Arrange
        const NavBlock = makeTestBlock('navigation')
        mockGetComponent.mockReturnValue(NavBlock)
        const links = [{ label: 'Home', url: '/' }]
        mockFilterLinks.mockReturnValue(links)

        // Act
        render(
            <SiteRenderer
                site={defaultSite}
                page={{ layout: [{ blockType: 'navigation', links }] }}
                // pages prop omitted intentionally
            />
        )

        // Assert — second arg must be the default empty array
        expect(mockFilterLinks).toHaveBeenCalledWith(links, [])
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

    it('CSS variables reference the resolved font names from theme', () => {
        // Arrange
        const site = { theme: { fontHeading: 'Merriweather', fontBody: 'Lato' } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={{ layout: [] }} />)

        // Assert
        const style = container.querySelector('style')
        expect(style?.textContent).toContain("--font-heading: 'Merriweather'")
        expect(style?.textContent).toContain("--font-body: 'Lato'")
    })
})
