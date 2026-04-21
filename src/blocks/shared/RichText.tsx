'use client'

import React from 'react'
import { sanitizeInlineHtml, hasInlineFormatting, extractHeadingWrapper } from '@/lib/utils/rich-text-render'

interface RichTextProps {
    text: string | undefined | null
    as?: React.ElementType
    className?: string
    style?: React.CSSProperties
}

const HEADING_SIZES: Record<string, string> = {
    h1: 'text-4xl md:text-6xl',
    h2: 'text-3xl md:text-4xl',
    h3: 'text-2xl md:text-3xl',
    h4: 'text-xl md:text-2xl',
    h5: 'text-lg md:text-xl',
    h6: 'text-base md:text-lg',
    p: 'text-base',
}

const SIZE_CLASS_REGEX = /\b(md:)?text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g

export function RichText({ text, as: Tag = 'span', className, style }: RichTextProps) {
    if (!text) return null

    if (!hasInlineFormatting(text)) {
        if (Tag === 'span' && !className && !style) return <>{text}</>
        return <Tag className={className} style={style}>{text}</Tag>
    }

    console.log("ALL RichText text prop:", text);
    const sanitized = sanitizeInlineHtml(text)
    const heading = extractHeadingWrapper(sanitized)

    if (heading) {
        const HeadingTag = heading.tag as React.ElementType
        const defaultTag = typeof Tag === 'string' ? Tag : 'span'

        let finalClassName = className || ''
        if (heading.tag !== defaultTag && HEADING_SIZES[heading.tag]) {
            finalClassName = finalClassName.replace(SIZE_CLASS_REGEX, '').trim()
            finalClassName = `${finalClassName} ${HEADING_SIZES[heading.tag]}`.trim()
        }

        // Merge all inline styles from heading wrapper (color, fontSize, fontFamily, textAlign)
        const mergedStyle = heading.inlineStyle
            ? { ...heading.inlineStyle, ...style }
            : style

        return <HeadingTag className={finalClassName} style={mergedStyle} dangerouslySetInnerHTML={{ __html: heading.content }} />
    }

    if (Tag === 'span' && !className && !style) {
        return <span dangerouslySetInnerHTML={{ __html: sanitized }} />
    }
    return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitized }} />
}
