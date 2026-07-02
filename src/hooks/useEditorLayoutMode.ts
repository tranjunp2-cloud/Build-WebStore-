'use client'

import { useEffect, useState } from 'react'

export type EditorLayoutMode = 'desktop' | 'compact'

export interface EditorLayoutModeState {
    mode: EditorLayoutMode
    isCompact: boolean
    isPhone: boolean
    isTablet: boolean
}

/**
 * Detects whether `/editor/[siteId]` should render the compact (mobile/tablet)
 * layout instead of the desktop 3-pane layout.
 *
 * SSR-safe: defaults to `false` (desktop) on the server + first client render,
 * then syncs to the real viewport post-mount via `matchMedia` — identical
 * behavior to the inline effect this hook replaces.
 *
 * Threshold stays `max-width: 767px` for Phase 01 (pure extract, no behavior
 * change). Phase 05 widens this to `<1280px` once the compact layout is
 * feature-complete; `isTablet` stays `false` until that phase distinguishes
 * phone vs tablet bands.
 */
export function useEditorLayoutMode(): EditorLayoutModeState {
    const [isCompact, setIsCompact] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)')
        const applyLayoutMode = (matches: boolean) => setIsCompact(matches)

        applyLayoutMode(mediaQuery.matches)

        const handleChange = (event: MediaQueryListEvent) => applyLayoutMode(event.matches)
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    return {
        mode: isCompact ? 'compact' : 'desktop',
        isCompact,
        isPhone: isCompact,
        isTablet: false,
    }
}
