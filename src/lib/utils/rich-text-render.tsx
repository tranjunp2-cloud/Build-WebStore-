/**
 * Render inline-formatted text (from WYSIWYG editor).
 * Allows safe formatting tags + heading tags.
 * STRIPS ALL ATTRIBUTES except a safe allowlist of style properties.
 */
import type React from 'react'

const ALLOWED_TAGS = new Set(['b', 'i', 'u', 'strong', 'em', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

// Each entry: [regex to match the property declaration, CSS property name]
const SAFE_STYLE_RULES: Array<RegExp> = [
    /text-align:\s*(left|center|right|justify)/,
    /color:\s*(#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\))/,
    /font-size:\s*\d+(?:\.\d+)?px/,
    /font-family:\s*[A-Za-z0-9 ,'\-]+/,
    /display:\s*block/,
]

function sanitizeStyleAttr(styleStr: string): string {
    const parts: string[] = []
    for (const re of SAFE_STYLE_RULES) {
        const m = styleStr.match(re)
        if (m) parts.push(m[0].trim().replace(/\s*:\s*/, ':'))
    }
    return parts.join(';')
}

export function sanitizeInlineHtml(html: string): string {
    if (!html || !html.includes('<')) return html
    return html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
        const t = tag.toLowerCase()
        if (!ALLOWED_TAGS.has(t)) return ''
        if (match.startsWith('</')) return `</${t}>`
        const styleMatch = (attrs as string).match(/style="([^"]*)"/)
        if (styleMatch) {
            const safe = sanitizeStyleAttr(styleMatch[1])
            if (safe) return `<${t} style="${safe}">`
        }
        return `<${t}>`
    })
}

export function hasInlineFormatting(text: string): boolean {
    if (!text) return false
    return /<\/?(?:b|i|u|strong|em|span|h[1-6])\b/i.test(text)
}

export interface HeadingWrapper {
    tag: string
    content: string
    inlineStyle?: React.CSSProperties
}

/** Extract heading wrapper if content is <hN ...>...</hN> */
export function extractHeadingWrapper(html: string): HeadingWrapper | null {
    const match = html.match(/^<(h[1-6])(\s[^>]*)?>([\s\S]+)<\/\1>$/i)
    if (!match) return null

    const attrs = match[2] || ''
    const styleMatch = attrs.match(/style="([^"]*)"/)
    let inlineStyle: React.CSSProperties | undefined

    if (styleMatch) {
        const s = styleMatch[1]
        const css: React.CSSProperties = {}

        const align = s.match(/text-align:\s*(left|center|right|justify)/)
        if (align) css.textAlign = align[1] as React.CSSProperties['textAlign']

        const color = s.match(/color:\s*(#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\))/)
        if (color) css.color = color[1]

        const fontSize = s.match(/font-size:\s*(\d+(?:\.\d+)?px)/)
        if (fontSize) css.fontSize = fontSize[1]

        const fontFamily = s.match(/font-family:\s*([A-Za-z0-9 ,'\-]+)/)
        if (fontFamily) css.fontFamily = fontFamily[1].trim()

        if (Object.keys(css).length > 0) inlineStyle = css
    }

    return {
        tag: match[1].toLowerCase(),
        content: match[3],
        inlineStyle,
    }
}
