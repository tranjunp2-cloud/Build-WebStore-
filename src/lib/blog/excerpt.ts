import { decodeHtmlEntities } from '@/lib/utils/rich-text-render'

function nodeText(value: unknown): string {
    if (!value || typeof value !== 'object') return ''
    const node = value as { text?: unknown; children?: unknown[]; root?: unknown; type?: string }
    if (node.root) return nodeText(node.root)
    if (typeof node.text === 'string') return node.text
    if (node.type === 'linebreak') return ' '
    return Array.isArray(node.children) ? node.children.map(nodeText).join(node.type === 'root' ? ' ' : '') : ''
}

/** Plain text only: callers render this as React text, never as HTML. */
export function blogExcerpt(content: unknown, limit = 160): string {
    const source = typeof content === 'string' ? content : nodeText(content)
    const text = decodeHtmlEntities(source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/(?:p|div|h[1-6]|li)>|<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ').trim()
    return text.length > limit ? text.slice(0, limit - 3) + '...' : text
}
