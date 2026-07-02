// @vitest-environment jsdom
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
    GoogleFontsLoader: () => React.createElement('div', { 'data-testid': 'google-fonts-loader' }),
}))

vi.mock('@/components/site-renderer/TrackingManager', () => ({
    TrackingManager: () => null,
}))

// ── Imports — after mocks ──────────────────────────────────────────────────
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { SiteLayoutShell } from '@/components/site-renderer/SiteLayoutShell'
import { blockRegistry } from '@/blocks/registry'

const mockGetComponent = vi.mocked(blockRegistry.getComponent)

/** Minimal test block component — renders blockType as a data-testid'd div. */
function makeTestBlock(label: string) {
    const Comp = () => React.createElement('div', { 'data-testid': `block-${label}` })
    Comp.displayName = `TestBlock_${label}`
    return Comp
}

/** Global blocks (header/footer) render unwrapped, so their root IS the wrapper child —
 *  querySelector alone misses that (only matches descendants), hence check self too. */
function elementMatches(el: Element, selector: string): boolean {
    return el.matches(selector) || !!el.querySelector(selector)
}

const defaultSite = {
    name: 'Test Site',
    theme: { primaryColor: '#ff6600', colorMode: 'light' as const },
}

describe('GH-1466: SiteLayoutShell sticky footer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => makeTestBlock(type))
    })

    it('TC-GH1466-01: wraps header, main(children), footer in a min-h-screen flex-col container', () => {
        // Arrange / Act
        const { container } = render(
            <SiteLayoutShell
                site={{
                    ...defaultSite,
                    headerBlock: { blockType: 'navigation', links: [] },
                    footerBlock: { blockType: 'footer', columns: [] },
                }}
                isOwner={false}
            >
                <div data-testid="page-content">Short content</div>
            </SiteLayoutShell>,
        )

        // Assert — sticky-footer wrapper exists with expected utility classes
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        expect(wrapper).toBeInTheDocument()

        // Assert — main wraps the page content and carries flex-1 (absorbs slack, pushes footer down)
        const main = wrapper?.querySelector('main.flex-1')
        expect(main).toBeInTheDocument()
        expect(main).toContainElement(screen.getByTestId('page-content'))

        // Assert — DOM order: header block before main, footer block after main
        const children = Array.from(wrapper?.children ?? [])
        const headerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-navigation"]'))
        const mainIdx = children.findIndex((el) => el.tagName === 'MAIN')
        const footerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-footer"]'))
        expect(headerIdx).toBeGreaterThanOrEqual(0)
        expect(headerIdx).toBeLessThan(mainIdx)
        expect(mainIdx).toBeLessThan(footerIdx)
    })

    it('TC-GH1466-02: cartWidget renders outside the flex-col wrapper (unaffected fixed sibling)', () => {
        // Arrange / Act
        const { container } = render(
            <SiteLayoutShell site={defaultSite} isOwner={false} forceCartWidget>
                <div>content</div>
            </SiteLayoutShell>,
        )

        // Assert — cartWidget block exists but is NOT a descendant of the flex-col wrapper
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        const cartWidget = screen.getByTestId('block-cartWidget')
        expect(cartWidget).toBeInTheDocument()
        expect(wrapper).not.toContainElement(cartWidget)
    })
})

describe('GH-1466: SiteRenderer sticky footer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => makeTestBlock(type))
    })

    it('TC-GH1466-03: buckets navigation/content/footer blocks into a min-h-screen flex-col + main.flex-1 tree', () => {
        // Arrange
        const page = {
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'hero', title: 'Welcome' },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        expect(wrapper).toBeInTheDocument()

        const main = wrapper?.querySelector('main.flex-1')
        expect(main).toBeInTheDocument()
        expect(main).toContainElement(screen.getByTestId('block-hero'))

        const children = Array.from(wrapper?.children ?? [])
        const headerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-navigation"]'))
        const mainIdx = children.findIndex((el) => el.tagName === 'MAIN')
        const footerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-footer"]'))
        expect(headerIdx).toBeGreaterThanOrEqual(0)
        expect(headerIdx).toBeLessThan(mainIdx)
        expect(mainIdx).toBeLessThan(footerIdx)
    })

    it('TC-GH1466-04: renders a valid empty main when layout has only nav+footer (no content blocks)', () => {
        // Arrange — minimal-content page: exactly the short-page shape that reproduces GH-1466
        const page = {
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — main renders (empty) without crashing, wrapper structure still intact
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        const main = wrapper?.querySelector('main.flex-1')
        expect(main).toBeInTheDocument()
        expect(main?.children.length).toBe(0)
    })

    it('TC-GH1466-05: header/navigation and footer blocks snap to canonical position even if authored mid-array', () => {
        // Arrange — GH-1466 adversarial finding: ensureNavigationBlocks (src/lib/ai/ensure-navigation.ts)
        // can leave nav/footer at a non-canonical index; bucketing intentionally renders them at
        // top/bottom regardless of original array position (documented at SiteRenderer.tsx:525-533).
        const page = {
            layout: [
                { blockType: 'hero', title: 'Content before nav (malformed)' },
                { blockType: 'navigation', links: [] },
                { blockType: 'footer', columns: [] },
                { blockType: 'text', content: 'Content after footer (malformed)' },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — despite authored order [hero, nav, footer, text], render order is [nav, main(hero+text), footer]
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        const children = Array.from(wrapper?.children ?? [])
        const headerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-navigation"]'))
        const mainIdx = children.findIndex((el) => el.tagName === 'MAIN')
        const footerIdx = children.findIndex((el) => elementMatches(el, '[data-testid="block-footer"]'))
        expect(headerIdx).toBe(0)
        expect(mainIdx).toBe(1)
        expect(footerIdx).toBe(2)

        const main = children[mainIdx]
        expect(main).toContainElement(screen.getByTestId('block-hero'))
        expect(main).toContainElement(screen.getByTestId('block-text'))
    })

    it('TC-GH1466-06: floating widgets (position:fixed) render outside the flex-col wrapper, unaffected', () => {
        // Arrange
        const page = {
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'cartWidget' },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — cartWidget is a floating widget, excluded from the bucketed flex tree entirely
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        const cartWidget = screen.getByTestId('block-cartWidget')
        expect(cartWidget).toBeInTheDocument()
        expect(wrapper).not.toContainElement(cartWidget)
    })

    it('TC-GH1466-07: editor mode preserves data-block-index/data-block-type on bucketed nav/footer (PreviewScripts contract)', () => {
        // Arrange — PreviewScripts (editor iframe) selects blocks via `[data-block-index]` /
        // `[data-block-type]` using closest(); this contract must survive header/footer bucketing.
        const page = {
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'hero', title: 'Welcome' },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} isEditor />)

        // Assert — bucketed header/footer wrapper divs still carry the editor data attributes
        const wrapper = container.querySelector('.min-h-screen.flex.flex-col')
        const navEl = wrapper?.querySelector('[data-block-type="navigation"]')
        const footerEl = wrapper?.querySelector('[data-block-type="footer"]')
        const heroEl = wrapper?.querySelector('main.flex-1 [data-block-type="hero"]')
        expect(navEl).toBeInTheDocument()
        expect(navEl?.getAttribute('data-block-index')).toBe('0')
        expect(footerEl).toBeInTheDocument()
        expect(footerEl?.getAttribute('data-block-index')).toBe('2')
        expect(heroEl).toBeInTheDocument()
        expect(heroEl?.getAttribute('data-block-index')).toBe('1')
    })

    it('TC-GH1466-08: isHomepage JSON-LD (Organization/WebSite) gates on page.isHomepage, not block order — survives malformed layout', () => {
        // Arrange — same malformed layout as TC-GH1466-05 (nav authored mid-array, not blocks[0]).
        // Pre-fix, isHomepage used `blocks[0]?.blockType === 'navigation'` (authored order), which
        // is false here even though page.isHomepage=true — wrong schema would render.
        const page = {
            isHomepage: true,
            layout: [
                { blockType: 'hero', title: 'Content before nav (malformed)' },
                { blockType: 'navigation', links: [] },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — Organization/WebSite schema present (homepage-only), WebPage schema absent
        const jsonLd = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
            .map((el) => el.textContent)
            .join('\n')
        expect(jsonLd).toContain('"@type":"Organization"')
        expect(jsonLd).toContain('"@type":"WebSite"')
        expect(jsonLd).not.toContain('"@type":"WebPage"')
    })

    it('TC-GH1466-09: isHomepage JSON-LD renders WebPage (not Organization/WebSite) when page.isHomepage is not true, even with hero+nav-first blocks', () => {
        // Arrange — blocks look exactly like a homepage (hero present, nav authored first), but
        // page.isHomepage is false. Old heuristic would have wrongly emitted Organization/WebSite.
        const page = {
            isHomepage: false,
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'hero', title: 'Not actually the homepage' },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — WebPage schema present, standalone Organization/WebSite schemas absent.
        // (WebPage legitimately nests a `isPartOf: {"@type":"WebSite", ...}` sub-object — only
        // the standalone top-level schema, prefixed by its own @context, must be absent.)
        const jsonLd = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
            .map((el) => el.textContent)
            .join('\n')
        expect(jsonLd).toContain('"@type":"WebPage"')
        expect(jsonLd).not.toContain('"@context":"https://schema.org","@type":"Organization"')
        expect(jsonLd).not.toContain('"@context":"https://schema.org","@type":"WebSite"')
    })

    it('TC-GH1466-10: isHomepage JSON-LD renders WebPage when page.isHomepage is omitted entirely (not just explicit false)', () => {
        // Arrange — page.isHomepage is undefined (the realistic shape for most non-homepage
        // pages, which never had the field set at all). Guards the `=== true` strict-equality
        // check: a regression to `!== false` would treat omitted isHomepage as truthy and
        // wrongly emit Organization/WebSite here — adversarial review caught this gap via
        // mutation testing (TC-08/09 only covered explicit true/false, not omitted).
        const page = {
            layout: [
                { blockType: 'navigation', links: [] },
                { blockType: 'hero', title: 'Some page, isHomepage never set' },
                { blockType: 'footer', columns: [] },
            ],
        }

        // Act
        const { container } = render(<SiteRenderer site={defaultSite} page={page} />)

        // Assert — WebPage schema present, standalone Organization/WebSite schemas absent.
        const jsonLd = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
            .map((el) => el.textContent)
            .join('\n')
        expect(jsonLd).toContain('"@type":"WebPage"')
        expect(jsonLd).not.toContain('"@context":"https://schema.org","@type":"Organization"')
        expect(jsonLd).not.toContain('"@context":"https://schema.org","@type":"WebSite"')
    })
})
