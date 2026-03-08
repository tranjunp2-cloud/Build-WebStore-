'use client'

/**
 * Shared Framer Motion animation presets for block renderers.
 * Provides consistent, premium animations across all blocks.
 */

import { motion, type Variants } from 'framer-motion'
import type { ComponentProps } from 'react'

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

/** Animated section that fades in when scrolled into view */
export function AnimatedSection({ children, delay = 0, ...props }: MotionSectionProps) {
    return (
        <motion.section
            initial="hidden"
            whileInView="visible"
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

/** Animated grid/list container with staggered children */
export function StaggerGrid({ children, className, ...props }: ComponentProps<typeof motion.div>) {
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

/** Individual stagger item */
export function StaggerItem({ children, className, ...props }: ComponentProps<typeof motion.div>) {
    return (
        <motion.div variants={staggerItem} className={className} {...props}>
            {children}
        </motion.div>
    )
}

/** Hover lift effect for cards */
export function HoverCard({ children, className, style, ...props }: ComponentProps<typeof motion.div>) {
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
