/**
 * Typography — Shared text components enforcing the type scale.
 *
 * Blocks MUST use <Heading>, <Body>, <Caption>, <Display> instead of raw
 * <h1-h4>/<p> tags with arbitrary text-* classes. This guarantees:
 *   - Modular 1.25 scale consistency
 *   - Body text ≥ 16px (a11y minimum)
 *   - Correct heading font + line-height + weight per level
 *
 * Reference: plans/260412-2300-design-quality-rules/phase-02-typography.md
 */

import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import {
    TYPE_SCALE,
    LINE_HEIGHT,
    FONT_WEIGHT,
} from '@/lib/design-tokens'

// ── Heading ─────────────────────────────────────────────────────────────────

export type HeadingLevel = 1 | 2 | 3 | 4

type HeadingProps = {
    level: HeadingLevel
    as?: ElementType
    className?: string
    children: ReactNode
} & Omit<HTMLAttributes<HTMLHeadingElement>, 'className' | 'children'>

const HEADING_CLASSES: Record<HeadingLevel, string> = {
    1: `${TYPE_SCALE.h1} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.heading}`,
    2: `${TYPE_SCALE.h2} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.heading}`,
    3: `${TYPE_SCALE.h3} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.subheading}`,
    4: `${TYPE_SCALE.h4} ${LINE_HEIGHT.heading} ${FONT_WEIGHT.subheading}`,
}

export function Heading({
    level,
    as,
    className = '',
    children,
    ...rest
}: HeadingProps) {
    const Tag: ElementType = as ?? (`h${level}` as const)
    const classes = HEADING_CLASSES[level]
    return (
        <Tag className={`${classes} font-heading ${className}`.trim()} {...rest}>
            {children}
        </Tag>
    )
}

// ── Display ─────────────────────────────────────────────────────────────────
// Larger than H1 — hero headlines only. Renders as <h1> semantically.

type DisplayProps = {
    className?: string
    children: ReactNode
} & Omit<HTMLAttributes<HTMLHeadingElement>, 'className' | 'children'>

export function Display({ className = '', children, ...rest }: DisplayProps) {
    const classes = `${TYPE_SCALE.display} ${LINE_HEIGHT.display} ${FONT_WEIGHT.heading} font-heading`
    return (
        <h1 className={`${classes} ${className}`.trim()} {...rest}>
            {children}
        </h1>
    )
}

// ── Body ────────────────────────────────────────────────────────────────────

type BodySize = 'base' | 'lg' | 'small'

type BodyProps = {
    size?: BodySize
    as?: ElementType
    className?: string
    children: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>

const BODY_CLASSES: Record<BodySize, string> = {
    base: `${TYPE_SCALE.body} ${LINE_HEIGHT.body} ${FONT_WEIGHT.body}`,
    lg: `${TYPE_SCALE.bodyLg} ${LINE_HEIGHT.body} ${FONT_WEIGHT.body}`,
    small: `${TYPE_SCALE.small} ${LINE_HEIGHT.small} ${FONT_WEIGHT.body}`,
}

export function Body({
    size = 'base',
    as: Tag = 'p',
    className = '',
    children,
    ...rest
}: BodyProps) {
    const classes = BODY_CLASSES[size]
    return (
        <Tag className={`${classes} font-body ${className}`.trim()} {...rest}>
            {children}
        </Tag>
    )
}

// ── Caption ─────────────────────────────────────────────────────────────────
// Small meta text (dates, tags, image credits). Uses 'small' body class.

type CaptionProps = {
    className?: string
    children: ReactNode
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>

export function Caption({ className = '', children, ...rest }: CaptionProps) {
    const classes = `${TYPE_SCALE.small} ${LINE_HEIGHT.small} ${FONT_WEIGHT.body}`
    return (
        <span className={`${classes} font-body ${className}`.trim()} {...rest}>
            {children}
        </span>
    )
}
