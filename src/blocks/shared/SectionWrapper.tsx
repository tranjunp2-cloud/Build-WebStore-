/**
 * SectionWrapper — Unified section layout for all block components.
 *
 * Replaces ad-hoc `container mx-auto px-6` + `py-*` hardcoding (131 occurrences
 * across src/blocks/). Enforces consistent padding, container width, and
 * alternating backgrounds without each block reinventing the wheel.
 *
 * Usage:
 *   <SectionWrapper padding="default" container="default" background="default">
 *     {children}
 *   </SectionWrapper>
 *
 * Reference: plans/260412-2300-design-quality-rules/phase-01-design-tokens.md
 */

import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import {
    SECTION_PADDING,
    CONTAINER,
    SECTION_BACKGROUND,
    INNER_PADDING,
    type SectionPaddingToken,
    type ContainerToken,
    type SectionBackgroundToken,
} from '@/lib/design-tokens'

type SectionWrapperProps = {
    padding?: SectionPaddingToken
    container?: ContainerToken
    background?: SectionBackgroundToken
    as?: ElementType
    className?: string
    innerClassName?: string
    children: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>

export function SectionWrapper({
    padding = 'default',
    container = 'default',
    background = 'default',
    as: Tag = 'section',
    className = '',
    innerClassName = '',
    children,
    ...rest
}: SectionWrapperProps) {
    const paddingClass = SECTION_PADDING[padding]
    const containerClass = CONTAINER[container]
    const backgroundClass = SECTION_BACKGROUND[background]

    return (
        <Tag
            className={`${paddingClass} ${backgroundClass} ${className}`.trim()}
            {...rest}
        >
            <div className={`${containerClass} mx-auto ${INNER_PADDING} ${innerClassName}`.trim()}>
                {children}
            </div>
        </Tag>
    )
}
