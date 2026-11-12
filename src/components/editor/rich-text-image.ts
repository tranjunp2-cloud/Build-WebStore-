import Image from '@tiptap/extension-image'
import { sanitizeRichHtml } from '@/blocks/custom-html/html-safety'
import { mergeAttributes, ResizableNodeView, type Attribute } from '@tiptap/core'

export const IMAGE_LAYOUTS = ['inline', 'left', 'right', 'standalone'] as const
export type ImageLayout = typeof IMAGE_LAYOUTS[number]
const imageElement = (el: HTMLElement) => el.matches('img') ? el : el.querySelector('img') || el
const layoutOf = (value: unknown): ImageLayout => IMAGE_LAYOUTS.includes(value as ImageLayout) ? value as ImageLayout : 'inline'
const gapOf = (value: unknown) => Math.min(64, Math.max(0, Number(value) || 0))

export const RichTextImage = Image.extend({
    parseHTML() { return [{ tag: 'span[data-pw2-image]', priority: 1100 }, { tag: 'img[src]' }] },
    addAttributes() {
        const parent: Record<string, Attribute> = this.parent?.() || {}
        const attrs = Object.fromEntries(Object.entries(parent).map(([key, attr]) => [key, { ...attr,
            parseHTML: (el: HTMLElement) => attr.parseHTML ? attr.parseHTML(imageElement(el)) : ['width', 'height'].includes(key) ? Number(imageElement(el).getAttribute(key)) || null : imageElement(el).getAttribute(key),
        }]))
        return {
            ...attrs,
            captionHtml: { default: '', rendered: false, parseHTML: el => el.getAttribute('data-caption-html') || '' },
            caption: { default: '', rendered: false, parseHTML: el => el.getAttribute('data-caption') || '' },
            showCaption: { default: false, rendered: false, parseHTML: el => el.getAttribute('data-show-caption') === 'true' },
            cssWidth: { default: null, rendered: false, parseHTML: el => el.style.width || imageElement(el).style.width || null },
            imageLayout: {
                default: 'inline', rendered: false,
                parseHTML: el => {
                    const explicit = el.getAttribute('data-image-layout')
                    if (explicit) return layoutOf(explicit)
                    if (el.style.cssFloat === 'left' || el.style.cssFloat === 'right') return el.style.cssFloat
                    return el.style.display === 'block' ? 'standalone' : 'inline'
                },
            },
            imageGap: { default: 16, rendered: false, parseHTML: el => {
                const value = el.getAttribute('data-image-gap')
                if (value !== null) return gapOf(value)
                return parseFloat(el.style.marginRight || el.style.marginLeft) || 16
            } },
        }
    },
    renderHTML({ node, HTMLAttributes }) {
        const layout = layoutOf(node.attrs.imageLayout)
        const gap = gapOf(node.attrs.imageGap)
        const style = layout === 'left' ? `float:left;margin:0 ${gap}px ${gap}px 0` :
            layout === 'right' ? `float:right;margin:0 0 ${gap}px ${gap}px` :
            layout === 'standalone' ? `display:block;float:none;clear:both;margin:${gap}px auto` : 'float:none;display:inline-block;vertical-align:middle;margin:0'
        const imgAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            'data-image-layout': layout, 'data-image-gap': gap,
            style: `${style};max-width:100%;height:auto${node.attrs.cssWidth ? `;width:${node.attrs.cssWidth}` : ''}`,
        })
        if (node.attrs.showCaption || node.attrs.caption) {
            const containerStyle = String(imgAttributes.style || '')
            const captionElement = document.createElement('span')
            captionElement.dataset.imageCaption = ''
            if (node.attrs.captionHtml) captionElement.innerHTML = sanitizeRichHtml(node.attrs.captionHtml)
            else captionElement.textContent = node.attrs.caption || ''
            return ['span', { 'data-pw2-image': '', 'data-caption-html': node.attrs.captionHtml || '', 'data-caption': node.attrs.caption || '', 'data-show-caption': String(Boolean(node.attrs.showCaption)),
                'data-image-layout': layout, 'data-image-gap': gap, style: `${containerStyle};${node.attrs.cssWidth ? '' : node.attrs.width ? `width:${node.attrs.width}px;` : ''}` },
                ['img', { ...imgAttributes, style: 'display:block;float:none;margin:0;width:100%;height:auto;max-width:100%' }],
                ...(node.attrs.showCaption ? [captionElement] : []),
            ]
        }
        return ['img', imgAttributes]
    },
    addNodeView() {
        return ({ node, editor, getPos }) => {
            const img = document.createElement('img')
            const syncImage = (attrs: typeof node.attrs) => {
                img.src = attrs.src
                img.alt = attrs.alt || ''
                img.title = attrs.title || ''
                img.style.cssText = attrs.style || ''
                img.style.cssFloat = 'none'
                img.style.margin = '0'
                img.style.maxWidth = '100%'
                img.style.height = 'auto'
                if (attrs.cssWidth) img.style.width = '100%'
                else if (attrs.width) img.style.width = `${attrs.width}px`
                if (attrs.class) img.className = attrs.class
            }
            syncImage(node.attrs)
            const caption = document.createElement('span')
            caption.dataset.imageCaption = ''
            const syncLayout = (attrs: typeof node.attrs) => {
                const wrapper = view.dom as HTMLElement
                wrapper.style.width = attrs.cssWidth || ''
                if (attrs.captionHtml) caption.innerHTML = sanitizeRichHtml(attrs.captionHtml)
                else caption.textContent = attrs.caption || ''
                caption.hidden = !attrs.showCaption
                caption.style.display = attrs.showCaption ? 'block' : 'none'
                wrapper.dataset.imageLayout = layoutOf(attrs.imageLayout)
                wrapper.style.setProperty('--rich-image-gap', `${gapOf(attrs.imageGap)}px`)
            }
            const view = new ResizableNodeView({
                element: img, node, editor, getPos,
                options: { min: { width: 24, height: 24 }, preserveAspectRatio: true },
                onResize: (width, height) => { img.style.width = `${width}px`; img.style.height = `${height}px` },
                onCommit: (width, height) => {
                    const pos = getPos()
                    if (typeof pos === 'number') editor.chain().setNodeSelection(pos).updateAttributes('image', { width, height, cssWidth: null }).run()
                },
                onUpdate: updated => {
                    if (updated.type !== node.type) return false
                    syncImage(updated.attrs)
                    syncLayout(updated.attrs)
                    return true
                },
            })
            view.dom.querySelector('[data-resize-wrapper]')?.appendChild(caption)
            syncLayout(node.attrs)
            return view
        }
    },
})
