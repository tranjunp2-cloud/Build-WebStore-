import { renderBlogContent } from '@/lib/blog/render-content'
import { decodeHtmlEntities } from '@/lib/utils/rich-text-render'

// Tags whose end (or `<br>`) separates words, so "<td>Size</td><td>M</td>" reads "Size M"
const BLOCK_END = /<\/(?:p|h[1-6]|div|li|ul|ol|tr|td|th|dd|dt|blockquote|table|caption|figcaption|section|article)>|<br\s*\/?>/gi
// A tag, allowing `>` inside quoted attribute values
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g

/** Plain text of a product `description` (Lexical JSON, PW1 HTML or string). '' when empty or unreadable. */
export function descriptionPlainText(description: unknown): string {
    let html: string
    try {
        html = renderBlogContent(description)
    } catch {
        return ''
    }
    // DOMPurify keeps <style>; its CSS must not reach the meta description
    const spaced = html
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(BLOCK_END, ' ')
        .replace(TAG, '')
    return decodeHtmlEntities(spaced).replace(/\s+/g, ' ').trim()
}

/** Short text for quick view / meta description / JSON-LD: `shortDescription` as is, else the description cut at a word. */
export function productSummaryText(
    product: { shortDescription?: unknown; description?: unknown },
    maxLength = 160,
): string {
    const short = typeof product.shortDescription === 'string' ? product.shortDescription.trim() : ''
    if (short) return short
    const text = descriptionPlainText(product.description)
    if (text.length <= maxLength) return text
    let room = text.slice(0, maxLength - 1)
    // never end on half an emoji (high surrogate)
    if (/[\uD800-\uDBFF]$/.test(room)) room = room.slice(0, -1)
    const lastSpace = room.lastIndexOf(' ')
    const cut = lastSpace >= maxLength * 0.5 ? room.slice(0, lastSpace) : room
    return `${cut.replace(/[\s.,;:!?-]+$/, '')}…`
}
