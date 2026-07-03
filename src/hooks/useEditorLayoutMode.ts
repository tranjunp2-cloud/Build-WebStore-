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
 * Threshold is `max-width: 1279px` (Phase 05) — the compact layout now covers
 * phone + every iPad band; desktop 3-pane starts at `xl` (1280px). `isTablet`
 * stays `false` since no caller currently needs to distinguish phone vs tablet
 * (Phase 06 tablet polish scopes via `min-[768px]:` classes instead).
 */
export function useEditorLayoutMode(): EditorLayoutModeState {
    const [isCompact, setIsCompact] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1279px)')
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
