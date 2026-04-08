'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import type { HeadingLevel } from './heading-utils'

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
