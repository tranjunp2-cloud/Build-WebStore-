import { Extension, Node, mergeAttributes } from '@tiptap/core'

/** Preserve PW1 layout wrappers and HTML styling during an edit round trip. */
export const LegacyContainer = Node.create({
    name: 'legacyContainer', group: 'block', content: 'block+', defining: true,
    parseHTML: () => [{ tag: 'div' }, { tag: 'figure' }],
    addAttributes: () => ({ tag: { default: 'div', parseHTML: el => el.tagName.toLowerCase(), rendered: false } }),
    renderHTML: ({ node, HTMLAttributes }) => [node.attrs.tag === 'figure' ? 'figure' : 'div', mergeAttributes(HTMLAttributes), 0],
})
export const LegacyCaption = Node.create({
    name: 'legacyCaption', group: 'block', content: 'inline*',
    parseHTML: () => [{ tag: 'figcaption' }],
    renderHTML: ({ HTMLAttributes }) => ['figcaption', HTMLAttributes, 0],
})
export const LegacyAttributes = Extension.create({
    name: 'legacyAttributes',
    addGlobalAttributes() {
        return [{
            types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem',
                'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'legacyContainer', 'legacyCaption', 'textStyle'],
            attributes: {
                style: { default: null, parseHTML: el => {
                    const copy = el.cloneNode(false) as HTMLElement
                    // Dedicated extensions own these properties so toolbar changes can replace them.
                    if (el.tagName === 'IMG') {
                        for (const key of ['float', 'display', 'clear', 'vertical-align', 'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom']) copy.style.removeProperty(key)
                    }
                    if (el.tagName === 'SPAN') {
                        for (const key of ['font-family', 'font-size', 'color', 'background-color', 'line-height']) copy.style.removeProperty(key)
                    }
                    if (/^(P|H[1-6])$/.test(el.tagName)) copy.style.removeProperty('text-align')
                    return copy.getAttribute('style') || null
                }, renderHTML: attrs => attrs.style ? { style: attrs.style } : {} },
                class: { default: null, parseHTML: el => el.getAttribute('class'), renderHTML: attrs => attrs.class ? { class: attrs.class } : {} },
            },
        }]
    },
})
