/**
 * Render inline-formatted text (from WYSIWYG editor).
 * Allows safe formatting tags + heading tags.
 * STRIPS ALL ATTRIBUTES except safe style="text-align:..." to prevent XSS.
 */

const ALLOWED_TAGS = new Set(['b', 'i', 'u', 'strong', 'em', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const SAFE_ALIGN_RE = /text-align:\s*(left|center|right|justify)/

export function sanitizeInlineHtml(html: string): string {
    if (!html || !html.includes('<')) return html
    return html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
        const t = tag.toLowerCase()
        if (!ALLOWED_TAGS.has(t)) return ''
        if (match.startsWith('</')) return `</${t}>`
        // Allow only style="text-align:..." — strip everything else
        const styleMatch = (attrs as string).match(/style="([^"]*)"/)
        if (styleMatch) {
            const alignMatch = styleMatch[1].match(SAFE_ALIGN_RE)
            if (alignMatch) {
                return `<${t} style="text-align:${alignMatch[1]}">`
            }
        }
        return `<${t}>`
    })
}

export function hasInlineFormatting(text: string): boolean {
    if (!text) return false
    return /<\/?(?:b|i|u|strong|em|span|h[1-6])\b/i.test(text)
}

/** Extract heading wrapper if content is <hN ...>...</hN> */
export function extractHeadingWrapper(html: string): { tag: string; content: string; style?: string } | null {
    const match = html.match(/^<(h[1-6])(\s[^>]*)?>([\s\S]+)<\/\1>$/i)
    if (match) {
        const attrs = match[2] || ''
        const alignMatch = attrs.match(/style="text-align:\s*(left|center|right|justify)"/)
        return {
            tag: match[1].toLowerCase(),
            content: match[3],
            style: alignMatch ? alignMatch[1] : undefined,
        }
    }
    return null
}
