'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe `matchMedia` check — defaults to `false` on the server and first client
 * render, then syncs to the real viewport post-mount. Guards against
 * `window.matchMedia` being absent (jsdom in unit tests doesn't polyfill it by
 * default) — degrades to the default rather than throwing.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return

        const mediaQuery = window.matchMedia(query)
        setMatches(mediaQuery.matches)
        const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches)
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [query])

    return matches
}

/**
 * `<768px` (phone) viewport check. Deliberately finer than `useEditorLayoutMode`'s
 * `<1280px` bucket (that hook conflates phone+tablet for the editor's compact
 * layout) — use this one when a component needs to distinguish phone from
 * tablet-and-up specifically.
 */
export function useIsMobileViewport(): boolean {
    return useMediaQuery('(max-width: 767px)')
}
