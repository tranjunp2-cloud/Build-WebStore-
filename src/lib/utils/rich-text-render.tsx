/**
 * Render inline-formatted text (from WYSIWYG editor).
 * Allows safe formatting tags + heading tags for block-level changes.
 * Strips all other HTML to prevent XSS.
 */

const ALLOWED_TAGS = ['b', 'i', 'u', 'strong', 'em', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']

export function sanitizeInlineHtml(html: string): string {
    if (!html || !html.includes('<')) return html
    // Strip all tags except allowed formatting + heading tags
    return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
        if (ALLOWED_TAGS.includes(tag.toLowerCase())) return match
        return ''
    })
}

export function hasInlineFormatting(text: string): boolean {
    if (!text) return false
    return /<\/?(?:b|i|u|strong|em|span|h[1-6])\b/i.test(text)
}

/** Extract heading wrapper if content is <hN>...</hN> */
export function extractHeadingWrapper(html: string): { tag: string; content: string } | null {
    const match = html.match(/^<(h[1-6])>([\s\S]*)<\/\1>$/i)
    if (match) return { tag: match[1].toLowerCase(), content: match[2] }
    return null
}
