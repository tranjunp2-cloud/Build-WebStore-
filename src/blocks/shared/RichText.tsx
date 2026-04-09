'use client'

import React from 'react'
import { sanitizeInlineHtml, hasInlineFormatting, extractHeadingWrapper } from '@/lib/utils/rich-text-render'

interface RichTextProps {
    text: string | undefined | null
    as?: React.ElementType
    className?: string
    style?: React.CSSProperties
}

/**
 * Renders text that may contain inline formatting from WYSIWYG editor.
 * Detects heading wrappers (e.g., <h4>content</h4>) and renders with correct tag.
 * Falls back to plain text rendering when no formatting detected.
 */
export function RichText({ text, as: Tag = 'span', className, style }: RichTextProps) {
    if (!text) return null

    if (hasInlineFormatting(text)) {
        const sanitized = sanitizeInlineHtml(text)
        // If content is wrapped in a heading tag, use that as the element
        const heading = extractHeadingWrapper(sanitized)
        if (heading) {
            const HeadingTag = heading.tag as React.ElementType
            return <HeadingTag className={className} style={style} dangerouslySetInnerHTML={{ __html: heading.content }} />
        }
        return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitized }} />
    }

    return <Tag className={className} style={style}>{text}</Tag>
}
