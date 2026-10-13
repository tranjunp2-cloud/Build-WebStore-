import DOMPurify from 'isomorphic-dompurify'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from 'lexical'

/** Accept editor HTML and legacy PW1 HTML wrapped in a Lexical text node. */
export function renderBlogContent(content: unknown): string {
    if (typeof content === 'string') return DOMPurify.sanitize(content)
    if (!content || typeof content !== 'object' || !('root' in content)) return ''
    const data = content as SerializedEditorState
    if (!Array.isArray(data.root?.children)) return ''
    const paragraph = data.root.children[0] as { type?: string; children?: Array<{ type?: string; text?: string }> } | undefined
    const text = paragraph?.children?.[0]
    if (data.root.children.length === 1 && paragraph?.type === 'paragraph' && paragraph.children?.length === 1
        && text?.type === 'text' && typeof text.text === 'string' && /^\s*<(?:p|h[1-6]|div|ul|ol|table|blockquote)\b/i.test(text.text)) {
        return DOMPurify.sanitize(text.text)
    }
    return DOMPurify.sanitize(convertLexicalToHTML({ data }))
}
