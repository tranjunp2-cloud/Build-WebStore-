import { Node } from '@tiptap/core'
import { sanitizeRichHtml } from '@/blocks/custom-html/html-safety'

/** Atomic media preserves PW1 preview markup, including nested responsive wrappers. */
export const RichTextMedia = Node.create({
    name: 'richTextMedia', group: 'block', atom: true, draggable: true, priority: 1100,
    addAttributes: () => ({ html: { default: '', rendered: false } }),
    parseHTML: () => [
        { tag: 'figure.media', getAttrs: el => ({ html: sanitizeRichHtml(el.outerHTML) }) },
        { tag: 'iframe', getAttrs: el => ({ html: sanitizeRichHtml(el.outerHTML) }) },
        { tag: 'oembed', getAttrs: el => ({ html: sanitizeRichHtml(el.outerHTML) }) },
        { tag: 'video', getAttrs: el => ({ html: sanitizeRichHtml(el.outerHTML) }) },
        { tag: 'audio', getAttrs: el => ({ html: sanitizeRichHtml(el.outerHTML) }) },
    ],
    renderHTML: ({ node }) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = sanitizeRichHtml(node.attrs.html)
        return { dom: wrapper.firstElementChild as HTMLElement || document.createElement('div') }
    },
    addNodeView: () => ({ node }) => {
        const dom = document.createElement('div')
        dom.className = 'pw2-rich-media'
        dom.contentEditable = 'false'
        dom.innerHTML = sanitizeRichHtml(node.attrs.html)
        // Keep media selectable instead of letting an iframe steal editing focus.
        dom.querySelectorAll('iframe,video,audio').forEach(el => { (el as HTMLElement).style.pointerEvents = 'none' })
        if (!dom.textContent?.trim() && !dom.querySelector('iframe,video,audio')) dom.hidden = true
        return { dom }
    },
})
