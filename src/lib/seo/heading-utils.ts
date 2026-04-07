export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Determines heading level for each block based on type and position.
 * Called by SiteRenderer to assign levels before rendering.
 * Pure function separated from context to allow calling in Server Components.
 */
export function getBlockHeadingLevel(
    blockType: string,
    allBlockTypes: string[],
): HeadingLevel {
    // Hero gets H1 — only the FIRST hero (Scenario #26)
    if (blockType === 'hero') {
        const firstHeroIndex = allBlockTypes.indexOf('hero')
        const currentIndex = allBlockTypes.indexOf(blockType)
        // Only first hero gets H1
        if (firstHeroIndex === currentIndex) {
            return 1
        }
        return 2
    }

    // Navigation, footer, breadcrumb — no heading level needed (they don't have section titles)
    if (['navigation', 'footer', 'breadcrumb', 'divider', 'whatsapp-button', 'announcement-bar'].includes(blockType)) {
        return 3
    }

    // If no hero exists on page, first content block gets H1 (fallback — Scenario #15)
    const hasHero = allBlockTypes.includes('hero')
    if (!hasHero) {
        const contentBlocks = allBlockTypes.filter(
            t => !['navigation', 'footer', 'breadcrumb', 'divider', 'whatsapp-button', 'announcement-bar'].includes(t),
        )
        if (contentBlocks[0] === blockType) {
            return 1
        }
    }

    // All other sections get H2
    return 2
}
