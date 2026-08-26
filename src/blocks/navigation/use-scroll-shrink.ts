'use client'

import { useEffect, useState } from 'react'

// Hysteresis buffer (px) prevents scroll-anchoring feedback loop:
// When the sticky nav height changes (~8px), the browser adjusts scrollY to
// preserve content position. Without hysteresis this causes the scrolled state
// to oscillate if scrollY is near the threshold, flickering the nav continuously.
// Buffer of 20px ensures the anchoring adjustment (~8px) can't flip the state.
const HYSTERESIS = 20

/**
 * Plan 260415 nav-bugfix D — shrink navigation on scroll.
 *
 * Returns `true` once the user has scrolled past `threshold` pixels.
 * Uses hysteresis to prevent scroll-anchoring oscillation when the nav
 * height change causes the browser to readjust scrollY near the threshold.
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

        const handleScroll = () => {
            const y = window.scrollY
            setScrolled(prev => {
                if (!prev && y > threshold + HYSTERESIS) return true
                if (prev && y < threshold - HYSTERESIS) return false
                return prev
            })
        }
        handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [threshold])

    return scrolled
}
