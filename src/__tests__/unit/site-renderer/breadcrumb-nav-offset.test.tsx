import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
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
    GoogleFontsLoader: () => null,
}))

// ── Imports — after mocks ──────────────────────────────────────────────────
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { blockRegistry } from '@/blocks/registry'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeTestBlock(label: string) {
    const Comp = () => React.createElement('div', { 'data-testid': `block-${label}` })
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

// Breadcrumb is injected via headerBlock.breadcrumbConfig.showOnAllPages — NOT via page.layout.
// page.layout breadcrumb entries are filtered out by SiteRenderer (line 105).
// nav is injected from site.headerBlock when blockType === 'navigation'.
// Render order: navigation (from headerBlock) → breadcrumb (injected at navIdx+1) → page content.

// ═══════════════════════════════════════════════════════════════════════════
// [TC-BUG-HEAD-009-BC] breadcrumb paddingTop under fixed nav variants
// ═══════════════════════════════════════════════════════════════════════════

describe('[TC-BUG-HEAD-009-BC] SiteRenderer breadcrumb offset under fixed nav variants', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'navigation') return makeTestBlock('navigation')
            if (type === 'breadcrumb') return makeTestBlock('breadcrumb')
            if (type === 'hero') return makeTestBlock('hero')
            return null
        })
    })

    const breadcrumbConfig = { showOnAllPages: true, homeLabel: 'Home', separator: '/' }
    const pageWithHero = { layout: [{ blockType: 'hero' }] }

    it('TC-BUG-HEAD-009-BC-01: nav variant=transparent → breadcrumb wrapper has paddingTop 64px', () => {
        // Arrange — breadcrumb injected via breadcrumbConfig (page.layout entries are filtered)
        const site = {
            ...defaultSite,
            headerBlock: { blockType: 'navigation', variant: 'transparent', breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert — breadcrumb gets a paddingTop wrapper when fixed nav is present
        const breadcrumbEl = container.querySelector('[data-testid="block-breadcrumb"]') as HTMLElement
        expect(breadcrumbEl).not.toBeNull()
        const wrapper = breadcrumbEl.parentElement as HTMLElement
        expect(wrapper.style.paddingTop).toBe('64px')
    })

    it('TC-BUG-HEAD-009-BC-02: nav variant=sidebar → breadcrumb wrapper has paddingTop 64px', () => {
        // Arrange
        const site = {
            ...defaultSite,
            headerBlock: { blockType: 'navigation', variant: 'sidebar', breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert
        const breadcrumbEl = container.querySelector('[data-testid="block-breadcrumb"]') as HTMLElement
        expect(breadcrumbEl).not.toBeNull()
        const wrapper = breadcrumbEl.parentElement as HTMLElement
        expect(wrapper.style.paddingTop).toBe('64px')
    })

    it('TC-BUG-HEAD-009-BC-03: nav variant=floating → breadcrumb wrapper has paddingTop 88px', () => {
        // Arrange — floating (pill) starts at top-4, needs extra margin
        const site = {
            ...defaultSite,
            headerBlock: { blockType: 'navigation', variant: 'floating', breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert
        const breadcrumbEl = container.querySelector('[data-testid="block-breadcrumb"]') as HTMLElement
        expect(breadcrumbEl).not.toBeNull()
        const wrapper = breadcrumbEl.parentElement as HTMLElement
        expect(wrapper.style.paddingTop).toBe('88px')
    })

    it('TC-BUG-HEAD-009-BC-04: breadcrumb with no nav block → no paddingTop (no fixed-nav offset)', () => {
        // Arrange — headerBlock has breadcrumbConfig but is NOT a navigation block → no nav injected
        // breadcrumb still renders (showOnAllPages=true), but navForOffset=null → no offset
        const site = {
            ...defaultSite,
            headerBlock: { breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert — breadcrumb is global block without offset; returned unwrapped (no inline paddingTop div)
        const breadcrumbEl = container.querySelector('[data-testid="block-breadcrumb"]') as HTMLElement
        expect(breadcrumbEl).not.toBeNull()
        // When no offset applies, breadcrumb returns blockContent directly (no wrapper div with paddingTop)
        // Walk up ancestors until we find one with an inline paddingTop — should not find one near breadcrumb
        const directParent = breadcrumbEl.parentElement as HTMLElement
        const ancestorStyle = directParent?.style?.paddingTop ?? ''
        expect(ancestorStyle).not.toMatch(/^\d+px$/)
        expect(ancestorStyle).not.toContain('nav-height')
    })

    it('TC-BUG-HEAD-009-BC-06: nav variant=default (sticky, in-flow) → breadcrumb has NO extra paddingTop (no double-gap)', () => {
        // Arrange — sticky nav pushes content down via document flow; extra paddingTop would create a gap
        const site = {
            ...defaultSite,
            headerBlock: { blockType: 'navigation', variant: 'default', breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert — breadcrumb is global block, no offset for sticky variant → returns blockContent unwrapped
        const breadcrumbEl = container.querySelector('[data-testid="block-breadcrumb"]') as HTMLElement
        expect(breadcrumbEl).not.toBeNull()
        const directParent = breadcrumbEl.parentElement as HTMLElement
        const paddingTop = directParent?.style?.paddingTop ?? ''
        expect(paddingTop).not.toMatch(/^\d+px$/)
        expect(paddingTop).not.toContain('nav-height')
    })

    it('TC-BUG-HEAD-009-BC-05: transparent nav + breadcrumb + hero on live site → hero has no nav-height paddingTop (overlay preserved)', () => {
        // Arrange — transparent overlay is intentional: hero background fills behind nav
        const site = {
            ...defaultSite,
            headerBlock: { blockType: 'navigation', variant: 'transparent', breadcrumbConfig },
        }

        // Act
        const { container } = render(
            <SiteRenderer site={site} page={pageWithHero} isEditor={false} />
        )

        // Assert — hero (first content block) must NOT get nav-height offset on live site
        const heroEl = container.querySelector('[data-testid="block-hero"]') as HTMLElement
        expect(heroEl).not.toBeNull()
        const heroWrapper = heroEl.parentElement as HTMLElement
        expect(heroWrapper.style.paddingTop).not.toContain('nav-height')
        expect(heroWrapper.style.paddingTop).not.toBe('64px')
        // Hero uses the default block spacing variable
        expect(heroWrapper.style.paddingTop).toBe('var(--block-spacing-default)')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// [TC-GH2246-07/08] breadcrumb on/off when config missing vs present
// ═══════════════════════════════════════════════════════════════════════════

describe('[TC-GH2246] SiteRenderer breadcrumb default when breadcrumbConfig is missing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            if (type === 'navigation') return makeTestBlock('navigation')
            if (type === 'breadcrumb') return makeTestBlock('breadcrumb')
            if (type === 'hero') return makeTestBlock('hero')
            return null
        })
    })

    const pageWithHero = { layout: [{ blockType: 'hero' }] }

    it('TC-GH2246-07: old store without breadcrumbConfig → no breadcrumb rendered', () => {
        // Arrange
        const site = { ...defaultSite, headerBlock: { blockType: 'navigation', variant: 'default' } }

        // Act
        const { container } = render(<SiteRenderer site={site} page={pageWithHero} isEditor={false} />)

        // Assert
        expect(container.querySelector('[data-testid="block-breadcrumb"]')).toBeNull()
    })

    it('TC-GH2246-08: config with showOnAllPages=false → no breadcrumb; true → breadcrumb', () => {
        // Arrange
        const off = { ...defaultSite, headerBlock: { blockType: 'navigation', breadcrumbConfig: { showOnAllPages: false } } }
        const on = { ...defaultSite, headerBlock: { blockType: 'navigation', breadcrumbConfig: { showOnAllPages: true } } }

        // Act
        const offRender = render(<SiteRenderer site={off} page={pageWithHero} isEditor={false} />)
        const offFound = offRender.container.querySelector('[data-testid="block-breadcrumb"]')
        offRender.unmount()
        const onRender = render(<SiteRenderer site={on} page={pageWithHero} isEditor={false} />)

        // Assert
        expect(offFound).toBeNull()
        expect(onRender.container.querySelector('[data-testid="block-breadcrumb"]')).not.toBeNull()
    })
})
