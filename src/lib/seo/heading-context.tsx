'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

/**
 * HeadingContext — enforces 1 H1 per page for SEO.
 *
 * Rules (from Scenario #16):
 * - H1 assigned to hero blockType, NOT by position
 * - Duplicate heroes: only first gets H1
 * - No hero on page: first section gets H1 (fallback)
 * - All other sections get H2
 * - Card items get H3
 */

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingContextValue = {
    /** The heading level this block should use for its title */
    level: HeadingLevel
}

const HeadingCtx = createContext<HeadingContextValue>({ level: 2 })

export function useHeadingLevel(): HeadingLevel {
    return useContext(HeadingCtx).level
}

type HeadingProviderProps = {
    level: HeadingLevel
    children: ReactNode
}

export function HeadingProvider({ level, children }: HeadingProviderProps) {
    const value = useMemo(() => ({ level }), [level])
    return <HeadingCtx.Provider value={value}>{children}</HeadingCtx.Provider>
}

/**
 * Determines heading level for each block based on type and position.
 * Called by SiteRenderer to assign levels before rendering.
 */
export function getBlockHeadingLevel(
    blockType: string,
    allBlockTypes: string[],
): HeadingLevel {
    // Hero gets H1 — only the FIRST hero (Scenario #26)
    if (blockType === 'hero') {
        const firstHeroIndex = allBlockTypes.indexOf('hero')
        const currentIndex = allBlockTypes.lastIndexOf(blockType)
        // Only first hero gets H1
        if (firstHeroIndex === currentIndex || firstHeroIndex === allBlockTypes.indexOf(blockType)) {
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

/**
 * Dynamic heading component — renders h1-h6 based on context level.
 */
export function DynamicHeading({
    children,
    className,
    style,
    level: overrideLevel,
}: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
    level?: HeadingLevel
}) {
    const contextLevel = useHeadingLevel()
    const l = overrideLevel || contextLevel

    switch (l) {
        case 1: return <h1 className={className} style={style}>{children}</h1>
        case 2: return <h2 className={className} style={style}>{children}</h2>
        case 3: return <h3 className={className} style={style}>{children}</h3>
        case 4: return <h4 className={className} style={style}>{children}</h4>
        case 5: return <h5 className={className} style={style}>{children}</h5>
        case 6: return <h6 className={className} style={style}>{children}</h6>
        default: return <h2 className={className} style={style}>{children}</h2>
    }
}
