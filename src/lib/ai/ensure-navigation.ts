/**
 * Force-inject navigation + footer blocks into AI-generated pages.
 *
 * BUG-F01-24: AI sometimes omits header/footer blocks → site renders without
 * menu → user sees broken site. This util guarantees every page has both.
 *
 * Strategy: defensive injection AFTER AI parse, BEFORE Payload save.
 * - Detect if any block on page has blockType 'navigation' (or 'header')
 * - If missing, prepend default navigation block
 * - Same logic for footer at end
 *
 * Trade-off: may override AI's intentional custom layouts that omit nav.
 * Acceptable because broken nav is worse than slightly less custom design.
 */

export interface PageBlockShape {
    blockType?: string
    // Runtime-only flag — used by injectFirstBlockOffset for idempotency guard only.
    // NOT read by SiteRenderer (renderer recomputes offset from nav variant at render time).
    // Stripped by stripNavOffset before any payload.create/update call.
    _navOffset?: boolean
    [key: string]: unknown
}

export interface PageShape {
    title: string
    slug: string
    isHomepage: boolean
    layout: PageBlockShape[]
    seo: { title: string; description: string }
}

export const DEFAULT_NAV_LINKS = [
    { label: 'Home', url: '/' },
    { label: 'About', url: '/about' },
    { label: 'Products', url: '/products' },
    { label: 'Contact', url: '/contact' },
] as const

const NAVIGATION_BLOCK_TYPES = new Set(['navigation', 'header', 'navbar'])
const FOOTER_BLOCK_TYPES = new Set(['footer'])

// Case-insensitive block type matching — AI may return 'Navigation', 'Nav', etc.
// IMPORTANT: normalize for detection only — never mutate block.blockType to lowercase.
// Exported so SiteRenderer and injectFirstBlockOffset can share the same detection logic.
export function isNavBlock(block: PageBlockShape): boolean {
    const bt = typeof block?.blockType === 'string' ? block.blockType.toLowerCase() : ''
    return NAVIGATION_BLOCK_TYPES.has(bt)
}

function isFooterBlock(block: PageBlockShape): boolean {
    const bt = typeof block?.blockType === 'string' ? block.blockType.toLowerCase() : ''
    return FOOTER_BLOCK_TYPES.has(bt)
}

function patchHollowNav(
    block: PageBlockShape,
    fallbackLinks: readonly { label: string; url: string }[],
): PageBlockShape {
    const links = Array.isArray(block.links) ? block.links : []
    if (links.length > 0) return block
    return { ...block, links: fallbackLinks.map((link) => ({ ...link })) }
}

// Variants that occupy fixed top position — first content block needs padding-top offset.
// 'transparent' IS included: fixed top-0, out of flow → hero text still needs offset so it
// isn't hidden behind the semi-transparent nav bar. The transparency affects only the nav
// background (see-through to hero image), NOT the content offset requirement.
// 'floating' IS included: fixed top-4, out of viewport top area (see plan validation 2026-04-24).
// 'default', 'centered', 'mega' are sticky (stay in document flow) — offset still added
// as breathing room between nav and first section.
// NOTE: 'transparent' and 'floating' are intentionally excluded from the paddingTop offset in
// SiteRenderer (via OVERLAY_NAV_VARIANTS) because they overlay the hero. This set is the
// source of truth for fixed/sticky membership; SiteRenderer adds a narrowing exclusion on top.
// See: src/components/site-renderer/SiteRenderer.tsx → OVERLAY_NAV_VARIANTS
export const FIXED_NAV_VARIANTS = new Set(['default', 'centered', 'mega', 'transparent', 'floating', 'sidebar'])

function shouldOffsetFirstBlock(navBlock: PageBlockShape): boolean {
    const variant = typeof navBlock.variant === 'string' ? navBlock.variant : 'default'
    return FIXED_NAV_VARIANTS.has(variant)
}

export function injectFirstBlockOffset(layout: PageBlockShape[]): PageBlockShape[] {
    if (layout.length < 2) return layout
    const [nav, firstContent, ...rest] = layout
    if (!nav || !isNavBlock(nav)) return layout
    if (!shouldOffsetFirstBlock(nav)) return layout
    if (firstContent?._navOffset === true) return layout  // idempotent
    return [nav, { ...firstContent, _navOffset: true }, ...rest]
}

export function stripNavOffset(layout: PageBlockShape[]): PageBlockShape[] {
    return layout.map(({ _navOffset: _, ...block }) => block)
}

function buildDefaultNavigation(businessName: string): PageBlockShape {
    return {
        blockType: 'navigation',
        variant: 'default',
        logoText: businessName,
        links: DEFAULT_NAV_LINKS.map((link) => ({ ...link })),
        ctaButton: {
            label: 'Get in touch',
            url: '/contact',
            style: 'primary',
        },
    }
}

function buildDefaultFooter(businessName: string): PageBlockShape {
    return {
        blockType: 'footer',
        variant: 'simple',
        logoText: businessName,
        description: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
        columns: [
            {
                title: 'Pages',
                links: DEFAULT_NAV_LINKS.map((link) => ({ ...link })),
            },
            {
                title: 'Contact',
                links: [{ label: 'Get in touch', url: '/contact' }],
            },
        ],
        socialLinks: [],
    }
}

/**
 * Ensure every page in the array has a navigation block at start
 * and a footer block at end. Mutates input array in place.
 */
export function ensureNavigationBlocks(
    pages: PageShape[],
    businessName: string,
): PageShape[] {
    const safeName = businessName?.trim() || 'My Website'

    return pages.map((page) => {
        let layout = Array.isArray(page.layout) ? [...page.layout] : []

        const hasNavigation = layout.some(isNavBlock)
        const hasFooter = layout.some(isFooterBlock)

        if (!hasNavigation) {
            layout.unshift(buildDefaultNavigation(safeName))
        } else {
            // Nav exists but may be hollow (empty links) — patch with defaults
            layout = layout.map((b) => isNavBlock(b) ? patchHollowNav(b, DEFAULT_NAV_LINKS) : b)
        }

        if (!hasFooter) {
            layout.push(buildDefaultFooter(safeName))
        }

        return { ...page, layout: injectFirstBlockOffset(layout) }
    })
}
