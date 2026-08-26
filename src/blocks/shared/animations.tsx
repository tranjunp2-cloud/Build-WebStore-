'use client'

/**
 * Shared Framer Motion animation presets for block renderers.
 * Provides consistent, premium animations across all blocks.
 */

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ComponentProps, ReactNode } from 'react'

// ── Animation Variants ──────────────────────────────────────────────────────

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
}

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export const slideInRight: Variants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

// Stagger children — parent container variant
export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
}

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

// ── Motion Components (pre-configured) ──────────────────────────────────────

type MotionSectionProps = ComponentProps<typeof motion.section> & {
    delay?: number
}

/** Animated section that fades in when scrolled into view. Respects prefers-reduced-motion.
 *
 *  Reduced motion must still render the SAME motion.section (just with initial={false}),
 *  NOT a plain <section>. SSR can't read the media query so it always emits the motion
 *  branch with the hidden state baked in (opacity:0). A plain <section> on the client would
 *  hydrate onto that node WITHOUT framer-motion to clear the inline opacity:0 → content stays
 *  invisible. Keeping motion.section + initial={false} lets framer-motion own the node and
 *  reset it to the visible state on mount. */
export function AnimatedSection({ children, delay = 0, ...props }: MotionSectionProps) {
    const shouldReduce = useReducedMotion()

    return (
        <motion.section
            initial={shouldReduce ? false : 'hidden'}
            animate={shouldReduce ? 'visible' : undefined}
            whileInView={shouldReduce ? undefined : 'visible'}
            viewport={{ once: true, margin: '-80px' }}
            variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
                },
            }}
            {...props}
        >
            {children}
        </motion.section>
    )
}

/** Animated grid/list container with staggered children. Respects prefers-reduced-motion.
 *  Keeps motion.div under reduced motion (initial={false}) so framer-motion clears the
 *  SSR-baked opacity:0 — see AnimatedSection note. */
export function StaggerGrid({ children, className, ...props }: ComponentProps<typeof motion.div>) {
    const shouldReduce = useReducedMotion()

    return (
        <motion.div
            initial={shouldReduce ? false : 'hidden'}
            animate={shouldReduce ? 'visible' : undefined}
            whileInView={shouldReduce ? undefined : 'visible'}
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

/** Individual stagger item. Keeps motion.div under reduced motion (initial={false}) so the
 *  SSR-baked opacity:0 from the parent's hidden state gets cleared — see AnimatedSection note. */
export function StaggerItem({ children, className, ...props }: ComponentProps<typeof motion.div>) {
    const shouldReduce = useReducedMotion()

    return (
        <motion.div
            initial={shouldReduce ? false : undefined}
            animate={shouldReduce ? 'visible' : undefined}
            variants={staggerItem}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

/** Hover lift effect for cards. Respects prefers-reduced-motion. */
export function HoverCard({ children, className, style, ...props }: ComponentProps<typeof motion.div>) {
    const shouldReduce = useReducedMotion()

    if (shouldReduce) {
        return <div className={className} style={style as React.CSSProperties}>{children as ReactNode}</div>
    }

    return (
        <motion.div
            className={className}
            style={style}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            {...props}
        >
            {children}
        </motion.div>
    )
}
