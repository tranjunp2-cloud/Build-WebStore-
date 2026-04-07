'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Animates a number from 0 to target when element scrolls into view.
 * Respects prefers-reduced-motion — shows final value immediately.
 * Safe for SSR — no IntersectionObserver on server.
 */
export function useCountUp(target: number, duration = 2000): {
    value: number
    ref: React.RefObject<HTMLElement | null>
} {
    const [value, setValue] = useState(0)
    const ref = useRef<HTMLElement | null>(null)
    const hasAnimated = useRef(false)
    const shouldReduce = useReducedMotion()

    useEffect(() => {
        if (shouldReduce || typeof window === 'undefined') {
            setValue(target)
            return
        }

        const element = ref.current
        if (!element || hasAnimated.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true
                    observer.disconnect()

                    const startTime = performance.now()
                    const animate = (now: number) => {
                        const elapsed = now - startTime
                        const progress = Math.min(elapsed / duration, 1)
                        // ease-out cubic
                        const eased = 1 - Math.pow(1 - progress, 3)
                        setValue(Math.round(eased * target))

                        if (progress < 1) {
                            requestAnimationFrame(animate)
                        }
                    }
                    requestAnimationFrame(animate)
                }
            },
            { threshold: 0.3 },
        )

        observer.observe(element)
        return () => observer.disconnect()
    }, [target, duration, shouldReduce])

    return { value, ref }
}
