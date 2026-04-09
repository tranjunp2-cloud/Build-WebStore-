'use client'

import React from 'react'
import { sanitizeInlineHtml, hasInlineFormatting, extractHeadingWrapper } from '@/lib/utils/rich-text-render'

interface RichTextProps {
    text: string | undefined | null
    as?: React.ElementType
    className?: string
    style?: React.CSSProperties
}

// Block-level tags that should NOT have heading children (prevents invalid nesting)
const BLOCK_LEVEL_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'])

/**
 * Renders text that may contain inline formatting from WYSIWYG editor.
 * Detects heading wrappers (e.g., <h4>content</h4>) and renders with correct tag.
 * Avoids invalid nesting (e.g., <h2><h4>...</h4></h2>) by skipping heading unwrap
 * when parent is already a block-level element.
 */
export function RichText({ text, as: Tag = 'span', className, style }: RichTextProps) {
    if (!text) return null

    if (hasInlineFormatting(text)) {
        const sanitized = sanitizeInlineHtml(text)
        const parentIsBlock = typeof Tag === 'string' && BLOCK_LEVEL_TAGS.has(Tag.toLowerCase())
        const heading = extractHeadingWrapper(sanitized)
        if (heading) {
            if (parentIsBlock) {
                // Parent is block-level — strip heading wrapper, render only inner content
                return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: heading.content }} />
            }
            // Parent is inline (span) — unwrap and use heading tag
            const HeadingTag = heading.tag as React.ElementType
            return <HeadingTag className={className} style={style} dangerouslySetInnerHTML={{ __html: heading.content }} />
        }
        return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitized }} />
    }

    return <Tag className={className} style={style}>{text}</Tag>
}
