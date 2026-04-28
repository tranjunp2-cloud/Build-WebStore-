/**
 * Render inline-formatted text (from WYSIWYG editor).
 * Allows safe formatting tags + heading tags.
 * STRIPS ALL ATTRIBUTES except a safe allowlist of style properties.
 */
import type React from 'react'

const ALLOWED_TAGS = new Set(['b', 'i', 'u', 'strong', 'em', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 's', 'del'])

// Each entry: [regex to match the property declaration, CSS property name]
const SAFE_STYLE_RULES: Array<RegExp> = [
    /text-align:\s*(left|center|right|justify)/,
    /color:\s*(#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\))/,
    /font-size:\s*(?:\d+(?:\.\d+)?(?:px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)/,
    /font-family:\s*[A-Za-z0-9 ,'\-]+/,
    /display:\s*block/,
    /list-style-type:\s*(disc|circle|square|decimal|lower-alpha|upper-alpha|lower-roman|upper-roman|none)/,
    /padding-left:\s*\d+(?:\.\d+)?(?:px|em|rem)/,
]

const SAFE_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_TARGETS = new Set(['_blank', '_self', '_parent', '_top'])

function isSafeHref(href: string): boolean {
    try { return SAFE_HREF_PROTOCOLS.has(new URL(href, 'https://x').protocol) }
    catch { return false }
}

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
    // Normalize block-level wrappers that may appear in stored data (backward compat with older saves)
    html = html
        .replace(/<(?:div|p)[^>]*>/gi, '<br>')
        .replace(/<\/(?:div|p)>/gi, '')
        .replace(/^<br>/, '')
    return html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
        const t = tag.toLowerCase()
        if (!ALLOWED_TAGS.has(t)) return ''
        if (match.startsWith('</')) return `</${t}>`
        const attrStr = attrs as string
        const styleMatch = attrStr.match(/style="([^"]*)"/)
        const hrefMatch = t === 'a' ? attrStr.match(/href="([^"]*)"/) : null
        const targetMatch = t === 'a' ? attrStr.match(/target="([^"]*)"/) : null
        const relMatch = t === 'a' ? attrStr.match(/rel="([^"]*)"/) : null
        const safeParts: string[] = []
        if (styleMatch) {
            const safe = sanitizeStyleAttr(styleMatch[1])
            if (safe) safeParts.push(`style="${safe}"`)
        }
        if (hrefMatch && isSafeHref(hrefMatch[1])) safeParts.push(`href="${hrefMatch[1]}"`)
        if (targetMatch && SAFE_TARGETS.has(targetMatch[1])) safeParts.push(`target="${targetMatch[1]}"`)
        if (relMatch) safeParts.push(`rel="${relMatch[1]}"`)
        return safeParts.length > 0 ? `<${t} ${safeParts.join(' ')}>` : `<${t}>`
    })
}

export function hasInlineFormatting(text: string): boolean {
    if (!text) return false
    return /<\/?(?:b|i|u|strong|em|span|h[1-6]|ul|ol|li|a|s|del|br|p|div)\b/i.test(text)
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
