'use client'

import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import type { NavLink } from './config'

// gap-1 = 4px; More button reserved width accounts for label + padding + chevron
const GAP_PX = 4
const MORE_BTN_PX = 88

/**
 * Measures how many nav links fit in a container width.
 * Uses ResizeObserver for real-time updates on container resize.
 * SSR-safe: ResizeObserver only attaches on client.
 *
 * @param links - Full nav link list
 * @param budgetOffset - Pixels to subtract from container width before measuring
 *   (use to reserve space for absolutely-positioned siblings inside the same flex row)
 * @returns containerRef to attach to the wrapper div, itemRefs array for each link
 *   element, and visibleCount indicating how many items fit
 */
export function useNavOverflow(links: NavLink[], budgetOffset: number = 0) {
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLElement | null)[]>([])
    const [visibleCount, setVisibleCount] = useState(links.length)

    // Track labels so measure re-fires when a label changes width (e.g. user edits
    // a link label in the CMS editor), not just when the link count changes.
    const linksSignature = links.map(l => `${l.label}:${l.children?.length ?? 0}`).join('\0')

    const measure = useCallback(() => {
        const container = containerRef.current
        if (!container) return
        const available = container.clientWidth - budgetOffset
        // No layout yet (jsdom, hidden container) — keep current state
        if (available <= 0) return

        // Fast path: if all items fit without a More button, show everything.
        // Without this, the per-item More-reserve check incorrectly hides the last
        // item(s) when items 0..n-2 collectively just exceed available-MORE_BTN_PX
        // even though all n items together fit in available.
        let totalAll = 0
        let allMounted = true
        for (let i = 0; i < links.length; i++) {
            const el = itemRefs.current[i]
            if (!el) { allMounted = false; break }
            totalAll += el.offsetWidth + (i > 0 ? GAP_PX : 0)
        }
        if (allMounted && totalAll <= available) {
            setVisibleCount(links.length)
            return
        }

        // Some items overflow — find cutoff, reserving space for the More button.
        let total = 0
        let count = 0
        for (let i = 0; i < links.length; i++) {
            const el = itemRefs.current[i]
            // null ref — hidden measurement layer not yet mounted for this item.
            if (!el) break
            const itemW = el.offsetWidth + (i > 0 ? GAP_PX : 0)
            if (total + itemW + MORE_BTN_PX > available) break
            total += itemW
            count = i + 1
        }

        setVisibleCount(count)
    }, [links.length, budgetOffset, linksSignature])

    // Measure synchronously before paint so items collapse without a visible flash.
    // Reading clientWidth/offsetWidth inside useLayoutEffect triggers a forced
    // reflow, giving accurate dimensions at commit time.
    useLayoutEffect(() => {
        measure()
    }, [measure])

    // ResizeObserver wires up after paint to handle ongoing container size changes.
    // RAF debounce coalesces rapid callbacks (e.g. during CSS height transitions or
    // framer-motion transforms) into one measure per animation frame, preventing the
    // measure → re-render → layout change → ResizeObserver → measure feedback loop.
    useEffect(() => {
        if (typeof window === 'undefined') return
        let rafId: number
        const debouncedMeasure = () => {
            cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(measure)
        }
        const ro = new ResizeObserver(debouncedMeasure)
        if (containerRef.current) ro.observe(containerRef.current)
        return () => { ro.disconnect(); cancelAnimationFrame(rafId) }
    }, [measure])

    return { containerRef, itemRefs: itemRefs.current, visibleCount }
}
