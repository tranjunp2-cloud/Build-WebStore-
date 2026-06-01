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

export function isFooterBlock(block: PageBlockShape): boolean {
    const bt = typeof block?.blockType === 'string' ? block.blockType.toLowerCase() : ''
    return FOOTER_BLOCK_TYPES.has(bt)
}

function patchHollowNav(
    block: PageBlockShape,
    fallbackLinks: readonly { label: string; url: string }[],
    forceReplace?: boolean,
): PageBlockShape {
    const links = Array.isArray(block.links) ? block.links : []
    if (links.length > 0 && !forceReplace) return block
    const patched: PageBlockShape = { ...block, links: fallbackLinks.map((link) => ({ ...link })) }
    // Also sync ctaButton URL when force-replacing so it points to a real page.
    // Without this, ctaButton stays hardcoded to /contact even if no Contact page exists.
    if (forceReplace && patched.ctaButton && typeof patched.ctaButton === 'object') {
        patched.ctaButton = { ...(patched.ctaButton as Record<string, unknown>), url: resolveCtaUrl(fallbackLinks) }
    }
    return patched
}

// Replace the footer's pages column with normalized page links so footer mirrors the nav menu.
// Detects the pages column by title keyword; falls back to column[0] if none matches.
// Only the pages column is replaced — support/legal/contact columns kept intact.
function patchFooterPageLinks(
    block: PageBlockShape,
    pageLinks: readonly { label: string; url: string }[],
): PageBlockShape {
    if (!Array.isArray(block.columns)) return block
    const cols = block.columns as Array<Record<string, unknown>>
    if (cols.length === 0) {
        return { ...block, columns: [{ title: 'Pages', links: pageLinks.map((l) => ({ ...l })) }] }
    }
    const pagesIdx = cols.findIndex(
        (c) => typeof c.title === 'string' && /pages?|links?|nav|menu/i.test(c.title),
    )
    const targetIdx = pagesIdx >= 0 ? pagesIdx : 0
    const columns = cols.map((col, i) =>
        i === targetIdx ? { ...col, links: pageLinks.map((l) => ({ ...l })) } : col,
    )
    return { ...block, columns }
}

// Variants that occupy a fixed/sticky top position. Used by ensure-navigation pipeline only.
// SiteRenderer computes its own paddingTop offset logic — see OVERLAY_NAV_VARIANTS there.
// GH-725: transparent/floating get paddingTop in editor only (isEditor=true); live site lets
// them overlay the hero intentionally. Sticky variants (default/centered/mega/sidebar) never
// get the offset — they are in document flow and push content down naturally.
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

type NavLink = { label: string; url: string }

// Find a contact-type page from the link list, or fall back to the last page.
// Used to resolve ctaButton URL so it always points to a real generated page.
// Exported for reuse in applyGeneratedSiteNavigation (route.ts).
export function resolveCtaUrl(links: readonly NavLink[]): string {
    const contact = links.find(l =>
        /contact/i.test(l.label) || /contact/i.test(l.url)
    )
    return contact?.url ?? links[links.length - 1]?.url ?? '/contact'
}

function buildDefaultNavigation(businessName: string, pageLinks?: readonly NavLink[]): PageBlockShape {
    const links = (pageLinks ?? DEFAULT_NAV_LINKS).map((link) => ({ ...link }))
    return {
        blockType: 'navigation',
        variant: 'default',
        logoText: businessName,
        links,
        ctaButton: {
            label: 'Get in touch',
            url: resolveCtaUrl(links),
            style: 'primary',
        },
    }
}

function buildDefaultFooter(businessName: string, pageLinks?: readonly NavLink[]): PageBlockShape {
    const links = (pageLinks ?? DEFAULT_NAV_LINKS).map((link) => ({ ...link }))
    return {
        blockType: 'footer',
        variant: 'simple',
        logoText: businessName,
        description: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
        columns: [
            {
                title: 'Pages',
                links,
            },
            {
                title: 'Contact',
                links: [{ label: 'Get in touch', url: resolveCtaUrl(links) }],
            },
        ],
        socialLinks: [],
    }
}

/**
 * Ensure every page in the array has a navigation block at start
 * and a footer block at end. Mutates input array in place.
 *
 * @param pageLinks - Dynamic links derived from AI-generated pages. When provided,
 *   injected/patched nav blocks use these links instead of DEFAULT_NAV_LINKS.
 */
export function ensureNavigationBlocks(
    pages: PageShape[],
    businessName: string,
    pageLinks?: readonly NavLink[],
): PageShape[] {
    const safeName = businessName?.trim() || 'My Website'
    const fallbackLinks = pageLinks ?? DEFAULT_NAV_LINKS

    return pages.map((page) => {
        let layout = Array.isArray(page.layout) ? [...page.layout] : []

        const hasNavigation = layout.some(isNavBlock)
        const hasFooter = layout.some(isFooterBlock)

        if (!hasNavigation) {
            layout.unshift(buildDefaultNavigation(safeName, fallbackLinks))
        } else {
            // When aiPageLinks provided (pageLinks arg is defined), force-replace nav links
            // so hardcoded links injected by enforceMinimumStructure get overwritten.
            // Without forceReplace, patchHollowNav skips non-hollow navs — leaving
            // enforcer-injected [Home/About/Services/Contact] instead of actual AI pages.
            const forceReplace = pageLinks !== undefined
            layout = layout.map((b) => isNavBlock(b) ? patchHollowNav(b, fallbackLinks, forceReplace) : b)
        }

        if (!hasFooter) {
            layout.push(buildDefaultFooter(safeName, fallbackLinks))
        } else if (pageLinks !== undefined) {
            // Force-replace footer pages column with normalized links so footer
            // mirrors the nav menu (same fix as navigation forceReplace above).
            layout = layout.map((b) => isFooterBlock(b) ? patchFooterPageLinks(b, fallbackLinks) : b)
        }

        return { ...page, layout: injectFirstBlockOffset(layout) }
    })
}
