'use client'

import { useEffect, useState } from 'react'

/**
 * Plan 260415 nav-bugfix D — shrink navigation on scroll.
 *
 * Returns `true` once the user has scrolled past `threshold` pixels.
 * Respects `prefers-reduced-motion`: users who disabled motion always
 * receive `false` so the nav never animates for them. Listener is passive
 * and cleaned up on unmount to avoid memory leaks when navigating pages.
 */
export function useScrollShrink(threshold: number = 50): boolean {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const prefersReducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) return

        const handleScroll = () => setScrolled(window.scrollY > threshold)
        handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [threshold])

    return scrolled
}
