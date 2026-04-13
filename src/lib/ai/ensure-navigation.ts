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

function buildDefaultNavigation(businessName: string): PageBlockShape {
    return {
        blockType: 'navigation',
        variant: 'minimal',
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
        const layout = Array.isArray(page.layout) ? [...page.layout] : []

        const hasNavigation = layout.some(
            (block) =>
                typeof block?.blockType === 'string' &&
                NAVIGATION_BLOCK_TYPES.has(block.blockType),
        )
        const hasFooter = layout.some(
            (block) =>
                typeof block?.blockType === 'string' &&
                FOOTER_BLOCK_TYPES.has(block.blockType),
        )

        if (!hasNavigation) {
            layout.unshift(buildDefaultNavigation(safeName))
        }
        if (!hasFooter) {
            layout.push(buildDefaultFooter(safeName))
        }

        return { ...page, layout }
    })
}
