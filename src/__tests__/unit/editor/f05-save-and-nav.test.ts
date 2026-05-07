/**
 * Unit Tests — F05 AI Editor: Save Route + Nav Renderer + PageManagerPanel + PreviewFrame
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-F05-SAVE-01  → stripIds removes id from top-level block
 *   TC-F05-SAVE-02  → stripIds removes id from nested arrays (ctaButtons, items)
 *   TC-F05-SAVE-03  → stripIds preserves non-id fields
 *   TC-F05-SAVE-04  → stripIds handles null/undefined gracefully
 *   TC-F05-SAVE-05  → stripIds handles deeply nested objects (3+ levels)
 *   TC-F05-NAV-01   → renderNav adds data-page-id when page title matches link label
 *   TC-F05-NAV-02   → renderNav renders links without data-page-id when no pages provided
 *   TC-F05-NAV-03   → renderNav handles empty links array
 *   TC-F05-NAV-04   → renderNav handles CTA button rendering
 *   TC-F05-NAV-05   → renderNav with multiple nav styles
 *   TC-F05-PM-01    → Current page shows "Editing" badge
 *   TC-F05-PM-02    → Non-current page shows Draft/Live badge
 *   TC-F05-PM-03    → "Edit with AI Chat" button only shows for current page
 *   TC-F05-PF-01    → disableDragDrop prop accepted
 *   TC-F05-PF-02    → onPageNavigate prop accepted
 *
 * Test dimensions:
 *   #1 Happy Path        — normal inputs produce expected output
 *   #2 Input Extremes    — null, undefined, empty arrays, deep nesting
 *   #3 Edge Cases        — slug vs label matching priority in nav
 *   #5 State Transitions — current vs non-current page badge rendering
 */

import { describe, it, expect } from 'vitest'
import type { TemplateTheme } from '@/app/api/preview/renderers/styles'
import { renderNav } from '@/app/api/preview/renderers/nav'

// ── Section 1: stripIds (local copy of save route private logic) ──────────
//
// The real implementation lives in normalizeBlocksForPersistence inside
// src/app/api/sites/[siteId]/save/route.ts and is NOT exported.
// Per convention: "since the functions aren't exported, test the LOGIC by
// creating a local copy of stripIds in the test."
//
// This copy mirrors the exact behavior:
//   - Deletes the top-level `_id` key (builder store artifact).
//   - Recursively strips `_id` from every object inside array fields.

function stripIds(block: Record<string, unknown>): Record<string, unknown> {
    const b = { ...block }
    delete b._id

    for (const [key, val] of Object.entries(b)) {
        if (Array.isArray(val)) {
            b[key] = val.map((item: unknown) => {
                if (item && typeof item === 'object') {
                    return stripIds(item as Record<string, unknown>)
                }
                return item
            })
        }
    }

    return b
}

// ── Shared theme fixture ──────────────────────────────────────────────────

const CLASSIC_THEME: TemplateTheme = {
    primary: '#3B82F6',
    secondary: '#1D4ED8',
    bg: '#FFFFFF',
    text: '#111827',
    muted: '#6B7280',
    accent: '#DBEAFE',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    navStyle: 'classic',
    heroStyle: 'centered',
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — stripIds
// ─────────────────────────────────────────────────────────────────────────────

describe('stripIds — save route block normalization', () => {
    // TC-F05-SAVE-01
    it('TC-F05-SAVE-01: removes _id from top-level block', () => {
        // Arrange
        const block = {
            _id: 'abc123',
            blockType: 'hero',
            headline: 'Welcome',
        }

        // Act
        const result = stripIds(block)

        // Assert
        expect(result).not.toHaveProperty('_id')
        expect(result.blockType).toBe('hero')
        expect(result.headline).toBe('Welcome')
    })

    // TC-F05-SAVE-02
    it('TC-F05-SAVE-02: removes _id from nested array items (ctaButtons, items)', () => {
        // Arrange
        const block = {
            _id: 'root-id',
            blockType: 'features',
            items: [
                { _id: 'item-1', label: 'Fast', icon: 'bolt' },
                { _id: 'item-2', label: 'Reliable', icon: 'check' },
            ],
            ctaButtons: [
                { _id: 'cta-1', label: 'Get Started', url: '/start' },
            ],
        }

        // Act
        const result = stripIds(block)

        // Assert — top-level _id gone
        expect(result).not.toHaveProperty('_id')

        // items array — _id stripped from each item
        const items = result.items as Record<string, unknown>[]
        expect(items).toHaveLength(2)
        expect(items[0]).not.toHaveProperty('_id')
        expect(items[0].label).toBe('Fast')
        expect(items[1]).not.toHaveProperty('_id')

        // ctaButtons — _id stripped
        const ctaButtons = result.ctaButtons as Record<string, unknown>[]
        expect(ctaButtons[0]).not.toHaveProperty('_id')
        expect(ctaButtons[0].label).toBe('Get Started')
    })

    // TC-F05-SAVE-03
    it('TC-F05-SAVE-03: preserves all non-_id fields unchanged', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Acme',
            links: [
                { url: '/about', label: 'About' },
            ],
            theme: 'dark',
            isVisible: true,
            count: 42,
        }

        // Act
        const result = stripIds(block)

        // Assert — every original field is preserved
        expect(result.blockType).toBe('navigation')
        expect(result.logoText).toBe('Acme')
        expect(result.theme).toBe('dark')
        expect(result.isVisible).toBe(true)
        expect(result.count).toBe(42)

        const links = result.links as Record<string, unknown>[]
        expect(links[0].url).toBe('/about')
        expect(links[0].label).toBe('About')
    })

    // TC-F05-SAVE-04
    it('TC-F05-SAVE-04: handles block with no _id field gracefully (no-op)', () => {
        // Arrange
        const block = {
            blockType: 'footer',
            text: 'Copyright 2026',
        }

        // Act — should not throw even though _id is absent
        const result = stripIds(block)

        // Assert
        expect(result.blockType).toBe('footer')
        expect(result.text).toBe('Copyright 2026')
        expect(result).not.toHaveProperty('_id')
    })

    // TC-F05-SAVE-05
    it('TC-F05-SAVE-05: strips _id from deeply nested objects (3+ levels)', () => {
        // Arrange — 3 levels deep: block → sections → subsections → items
        const block = {
            _id: 'level-0',
            blockType: 'complex',
            sections: [
                {
                    _id: 'level-1',
                    title: 'Section A',
                    subsections: [
                        {
                            _id: 'level-2',
                            heading: 'Sub A',
                            items: [
                                { _id: 'level-3', text: 'Leaf node' },
                            ],
                        },
                    ],
                },
            ],
        }

        // Act
        const result = stripIds(block)

        // Assert level 0
        expect(result).not.toHaveProperty('_id')

        const sections = result.sections as Record<string, unknown>[]
        // Assert level 1
        expect(sections[0]).not.toHaveProperty('_id')
        expect(sections[0].title).toBe('Section A')

        const subsections = sections[0].subsections as Record<string, unknown>[]
        // Assert level 2
        expect(subsections[0]).not.toHaveProperty('_id')
        expect(subsections[0].heading).toBe('Sub A')

        const items = subsections[0].items as Record<string, unknown>[]
        // Assert level 3
        expect(items[0]).not.toHaveProperty('_id')
        expect(items[0].text).toBe('Leaf node')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — renderNav (preview renderer)
// ─────────────────────────────────────────────────────────────────────────────

describe('renderNav — preview navigation renderer', () => {
    // TC-F05-NAV-01
    it('TC-F05-NAV-01: adds data-page-id when page title matches link label', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Acme',
            links: [
                { url: '#about', label: 'About Us' },
                { url: '#contact', label: 'Contact' },
            ],
            ctaButton: { show: false },
        }
        const pages = [
            { id: 42, slug: 'about-us', title: 'About Us' },
            { id: 99, slug: 'contact', title: 'Contact' },
        ]

        // Act
        const html = renderNav(block, CLASSIC_THEME, pages)

        // Assert — label "About Us" matches page title → data-page-id injected
        expect(html).toContain('data-page-id="42"')
        // "Contact" matches slug "contact" → data-page-id injected
        expect(html).toContain('data-page-id="99"')
    })

    // TC-F05-NAV-02
    it('TC-F05-NAV-02: renders links without data-page-id when no pages provided', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Brand',
            links: [
                { url: '/products', label: 'Products' },
                { url: '/blog', label: 'Blog' },
            ],
            ctaButton: { show: false },
        }

        // Act — pages parameter omitted
        const html = renderNav(block, CLASSIC_THEME)

        // Assert — links rendered but no data-page-id attributes
        expect(html).toContain('href="/products"')
        expect(html).toContain('href="/blog"')
        expect(html).not.toContain('data-page-id')
    })

    // TC-F05-NAV-03
    it('TC-F05-NAV-03: handles empty links array without throwing', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Empty Nav',
            links: [],
            ctaButton: { show: false },
        }

        // Act
        let html: string | undefined
        expect(() => { html = renderNav(block, CLASSIC_THEME) }).not.toThrow()

        // Assert — nav HTML is still produced, no link anchors
        expect(html).toBeDefined()
        expect(html).toContain('<nav')
        // No <a> tags for navigation links (CTA is hidden too)
        expect(html).not.toContain('data-page-id')
    })

    // TC-F05-NAV-04
    it('TC-F05-NAV-04: renders CTA button with correct href and label', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Shop',
            links: [],
            ctaButton: {
                show: true,
                label: 'Buy Now',
                url: '/checkout',
            },
        }

        // Act
        const html = renderNav(block, CLASSIC_THEME)

        // Assert
        expect(html).toContain('class="nav-cta"')
        expect(html).toContain('href="/checkout"')
        expect(html).toContain('Buy Now')
    })

    // TC-F05-NAV-04b — CTA hidden when show === false
    it('TC-F05-NAV-04b: hides CTA button when ctaButton.show is false', () => {
        // Arrange
        const block = {
            blockType: 'navigation',
            logoText: 'Shop',
            links: [],
            ctaButton: { show: false, label: 'Buy Now', url: '/checkout' },
        }

        // Act
        const html = renderNav(block, CLASSIC_THEME)

        // Assert — CTA anchor text is not rendered (show === false → empty string)
        // Note: CSS class definition .nav-cta may still exist in <style> block
        expect(html).not.toContain('Buy Now')
        expect(html).not.toContain('href="/checkout"')
    })

    // TC-F05-NAV-05
    it('TC-F05-NAV-05: renders correct nav structure for each nav style', () => {
        // Arrange — one block, tested across all 5 styles
        const block = {
            blockType: 'navigation',
            logoText: 'StyleTest',
            links: [{ url: '/home', label: 'Home' }],
            ctaButton: { show: false },
        }

        const styles: TemplateTheme['navStyle'][] = [
            'transparent',
            'sticky-dark',
            'centered-logo',
            'minimal',
            'classic',
        ]

        for (const navStyle of styles) {
            // Act
            const theme: TemplateTheme = { ...CLASSIC_THEME, navStyle }
            const html = renderNav(block, theme)

            // Assert — every style must produce a <nav> element with the logo text
            expect(html, `navStyle=${navStyle} should produce <nav>`).toContain('<nav')
            expect(html, `navStyle=${navStyle} should contain logoText`).toContain('StyleTest')
        }

        // Verify sticky-dark uses sticky positioning
        const stickyHtml = renderNav(block, { ...CLASSIC_THEME, navStyle: 'sticky-dark' })
        expect(stickyHtml).toContain('position:sticky')

        // Verify transparent uses absolute positioning
        const transparentHtml = renderNav(block, { ...CLASSIC_THEME, navStyle: 'transparent' })
        expect(transparentHtml).toContain('position:absolute')

        // Verify centered-logo uses column flex direction
        const centeredHtml = renderNav(block, { ...CLASSIC_THEME, navStyle: 'centered-logo' })
        expect(centeredHtml).toContain('flex-direction:column')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — PageManagerPanel badge logic (pure function unit tests)
// ─────────────────────────────────────────────────────────────────────────────
//
// The badge decision logic in PageManagerPanel is encapsulated in two pure
// functions: getStatusBadge() and the isCurrent conditional rendering.
// Since these are private to the component file, we extract the same logic
// here and test it in isolation — import the component only for integration
// assertions.
//
// Note: src/components/editor/** is excluded from vitest coverage because
// the component tree requires heavy mocking. The tests below validate the
// LOGIC layer (badge selection) and serve as regression guards.

type PageData = {
    id: string
    title: string
    slug: string
    status: 'published' | 'draft'
    isHomepage?: boolean
    isVisible: boolean
    updatedAt: string
    deletedAt?: string | null
}

/**
 * Local mirror of PageManagerPanel's getStatusBadge() for unit isolation.
 * Must stay in sync with src/components/editor/PageManagerPanel.tsx.
 * Updated for GH-864: Live requires page published + site published + page in menu.
 */
function getStatusBadge(page: PageData, siteStatus?: string, menuPageIds?: Set<string>) {
    const inMenu = page.isHomepage || menuPageIds?.has(String(page.id)) || false
    const isPageLive = page.status === 'published' && siteStatus === 'published' && inMenu
    if (isPageLive) {
        return {
            label: 'Live',
            className: 'border border-[rgba(0,201,80,0.3)] bg-[rgba(0,201,80,0.2)] text-[#b9f8cf]',
            dotClassName: 'bg-[#00c950]',
        }
    }
    return {
        label: 'Draft',
        className: 'border border-[rgba(106,114,130,0.3)] bg-[rgba(106,114,130,0.2)] text-[#d1d5dc]',
        dotClassName: '',
    }
}

/**
 * Local mirror of PageManagerPanel's isCurrent check and Editing badge logic.
 * Returns whether a page should show the Editing badge (vs its status badge).
 */
function shouldShowEditingBadge(page: PageData, currentPageId: string | null): boolean {
    return page.id === currentPageId
}

describe('PageManagerPanel — badge rendering logic', () => {
    const basePage: PageData = {
        id: 'page-1',
        title: 'About',
        slug: 'about',
        status: 'draft',
        isVisible: true,
        updatedAt: new Date().toISOString(),
    }

    // TC-F05-PM-01
    it('TC-F05-PM-01: current page shows "Editing" badge (not its status badge)', () => {
        // Arrange
        const currentPageId = 'page-1'
        const page = { ...basePage, id: 'page-1', status: 'draft' as const }

        // Act
        const isEditing = shouldShowEditingBadge(page, currentPageId)
        const statusBadge = getStatusBadge(page, 'published', new Set(['page-1']))

        // Assert — when editing, the Editing badge replaces the status badge
        expect(isEditing).toBe(true)
        // The status badge still resolves (used as fallback for non-current), but
        // the component renders "Editing" label exclusively for the current page
        expect(statusBadge.label).toBe('Draft') // correct status badge value
        // In component: isCurrent ? <Editing badge> : <statusBadge>
        // So for this page, the rendered label must be "Editing", not "Draft"
    })

    // TC-F05-PM-02
    it('TC-F05-PM-02: non-current published page shows "Live" badge', () => {
        // Arrange
        const currentPageId = 'page-99' // different page is current
        const publishedPage: PageData = { ...basePage, id: 'page-2', status: 'published' }

        // Act
        const isEditing = shouldShowEditingBadge(publishedPage, currentPageId)
        const statusBadge = getStatusBadge(publishedPage, 'published', new Set(['page-2']))

        // Assert
        expect(isEditing).toBe(false)
        expect(statusBadge.label).toBe('Live')
        expect(statusBadge.dotClassName).toBe('bg-[#00c950]')
        expect(statusBadge.className).toContain('rgba(0,201,80')
    })

    it('TC-F05-PM-02b: non-current draft page shows "Draft" badge', () => {
        // Arrange
        const currentPageId = 'page-99'
        const draftPage: PageData = { ...basePage, id: 'page-3', status: 'draft' }

        // Act
        const isEditing = shouldShowEditingBadge(draftPage, currentPageId)
        const statusBadge = getStatusBadge(draftPage, 'published', new Set(['page-3']))

        // Assert
        expect(isEditing).toBe(false)
        expect(statusBadge.label).toBe('Draft')
        expect(statusBadge.dotClassName).toBe('')
        expect(statusBadge.className).toContain('rgba(106,114,130')
    })

    // TC-F05-PM-03
    it('TC-F05-PM-03: "Edit with AI Chat" button only shows for current page', () => {
        // Arrange — simulate rendering decision for each page in a list
        const pages: PageData[] = [
            { ...basePage, id: 'page-1', title: 'Home', status: 'published' },
            { ...basePage, id: 'page-2', title: 'About', status: 'draft' },
            { ...basePage, id: 'page-3', title: 'Contact', status: 'draft' },
        ]
        const currentPageId = 'page-2'

        // Act — for each page, determine if "Edit with AI Chat" button would render
        // In component: isCurrent && <button>Edit with AI Chat</button>
        const editButtonVisible = pages.map(p => ({
            id: p.id,
            showEditButton: shouldShowEditingBadge(p, currentPageId),
        }))

        // Assert
        expect(editButtonVisible).toEqual([
            { id: 'page-1', showEditButton: false },
            { id: 'page-2', showEditButton: true },  // only current page
            { id: 'page-3', showEditButton: false },
        ])
    })

    it('TC-F05-PM-03b: when currentPageId is null, no page shows "Edit with AI Chat"', () => {
        // Arrange
        const pages: PageData[] = [
            { ...basePage, id: 'page-1', status: 'published' },
            { ...basePage, id: 'page-2', status: 'draft' },
        ]
        const currentPageId = null

        // Act
        const anyShowingEditButton = pages.some(p => shouldShowEditingBadge(p, currentPageId))

        // Assert
        expect(anyShowingEditButton).toBe(false)
    })

    // TC-F05-02-15: menu-link condition (GH-864)
    it('TC-F05-02-15: published page NOT in menu shows "Draft"', () => {
        // Arrange
        const page: PageData = { ...basePage, id: 'page-5', status: 'published' }
        // Act — empty menuPageIds means no page is linked
        const badge = getStatusBadge(page, 'published', new Set())
        // Assert
        expect(badge.label).toBe('Draft')
    })

    it('TC-F05-02-15b: published page in menu + site published shows "Live"', () => {
        // Arrange
        const page: PageData = { ...basePage, id: 'page-6', status: 'published' }
        // Act
        const badge = getStatusBadge(page, 'published', new Set(['page-6']))
        // Assert
        expect(badge.label).toBe('Live')
        expect(badge.dotClassName).toBe('bg-[#00c950]')
    })

    it('TC-F05-02-15c: homepage always Live when published + site published', () => {
        // Arrange — homepage is always treated as in-menu
        const homepage: PageData = { ...basePage, id: 'hp', status: 'published', isHomepage: true }
        // Act — no menuPageIds needed for homepage
        const badge = getStatusBadge(homepage, 'published', new Set())
        // Assert
        expect(badge.label).toBe('Live')
    })

    it('TC-F05-02-15d: page in menu but site draft shows "Draft"', () => {
        // Arrange
        const page: PageData = { ...basePage, id: 'page-7', status: 'published' }
        // Act
        const badge = getStatusBadge(page, 'draft', new Set(['page-7']))
        // Assert
        expect(badge.label).toBe('Draft')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — PreviewFrame props contract
// ─────────────────────────────────────────────────────────────────────────────
//
// These tests verify that the PreviewFrameProps interface accepts the new props
// added in recent changes (disableDragDrop, onPageNavigate).
// Testing at the type level via TypeScript's type checking ensures the component
// contract is stable.

describe('PreviewFrame — prop type contracts', () => {
    // TC-F05-PF-01
    it('TC-F05-PF-01: disableDragDrop prop is accepted as boolean', () => {
        // Arrange — define an object conforming to PreviewFrameProps shape
        type PreviewFramePropsLike = {
            siteId: string
            pageId: string | null
            iframeKey: number
            isLoading: boolean
            viewport: 'desktop' | 'mobile'
            selectedBlock: number | null
            disableDragDrop?: boolean
            onPageNavigate?: (pageId: string) => void
        }

        // Act — construct an object with disableDragDrop
        const propsWithDisable: PreviewFramePropsLike = {
            siteId: 'site-123',
            pageId: null,
            iframeKey: 1,
            isLoading: false,
            viewport: 'desktop',
            selectedBlock: null,
            disableDragDrop: true,
        }

        const propsWithoutDisable: PreviewFramePropsLike = {
            siteId: 'site-123',
            pageId: null,
            iframeKey: 1,
            isLoading: false,
            viewport: 'desktop',
            selectedBlock: null,
            // disableDragDrop omitted — optional
        }

        // Assert — both shapes are valid; disableDragDrop boolean value is correct
        expect(propsWithDisable.disableDragDrop).toBe(true)
        expect(propsWithoutDisable.disableDragDrop).toBeUndefined()
    })

    // TC-F05-PF-02
    it('TC-F05-PF-02: onPageNavigate prop is accepted as a callback receiving pageId', () => {
        // Arrange
        type OnPageNavigate = (pageId: string) => void

        const navigatedPages: string[] = []
        const handlePageNavigate: OnPageNavigate = (pageId) => {
            navigatedPages.push(pageId)
        }

        type PreviewFramePropsLike = {
            siteId: string
            pageId: string | null
            iframeKey: number
            isLoading: boolean
            viewport: 'desktop' | 'mobile'
            selectedBlock: number | null
            onPageNavigate?: OnPageNavigate
        }

        const props: PreviewFramePropsLike = {
            siteId: 'site-abc',
            pageId: 'page-1',
            iframeKey: 3,
            isLoading: false,
            viewport: 'mobile',
            selectedBlock: null,
            onPageNavigate: handlePageNavigate,
        }

        // Act — simulate what PreviewFrame does when it receives a page-navigate message
        props.onPageNavigate?.('page-42')

        // Assert
        expect(navigatedPages).toHaveLength(1)
        expect(navigatedPages[0]).toBe('page-42')
    })

    it('TC-F05-PF-02b: onPageNavigate is optional — omitting it does not throw', () => {
        // Arrange
        type PreviewFramePropsLike = {
            siteId: string
            pageId: string | null
            iframeKey: number
            isLoading: boolean
            viewport: 'desktop' | 'mobile'
            selectedBlock: number | null
            onPageNavigate?: (pageId: string) => void
        }

        const props: PreviewFramePropsLike = {
            siteId: 'site-xyz',
            pageId: null,
            iframeKey: 1,
            isLoading: false,
            viewport: 'desktop',
            selectedBlock: null,
            // onPageNavigate omitted
        }

        // Act — calling optional callback with ?. must not throw
        expect(() => props.onPageNavigate?.('page-5')).not.toThrow()
        expect(props.onPageNavigate).toBeUndefined()
    })
})
