import { sanitizeRichHtml } from '@/blocks/custom-html/html-safety'

/** Convert CKEditor image wrappers to the image attributes understood by PW2. */
export function normalizePw1RichHtml(html: string): string {
    const doc = new DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html')
    doc.querySelectorAll('figure.media').forEach(figure => {
        if (!figure.querySelector('iframe,video,audio,oembed') && !figure.textContent?.trim()) figure.remove()
    })
    doc.querySelectorAll('figure.image, span.image-inline').forEach(wrapper => {
        const img = wrapper.querySelector('img')
        if (!img || wrapper.querySelectorAll('img').length !== 1) return
        const classes = wrapper.classList
        const floating = (wrapper as HTMLElement).style.cssFloat || img.style.cssFloat
        const layout = classes.contains('image-style-align-left') || floating === 'left' ? 'left' :
            classes.contains('image-style-align-right') || classes.contains('image-style-side') || floating === 'right' ? 'right' :
            wrapper.tagName === 'FIGURE' ? 'standalone' : 'inline'
        const caption = wrapper.querySelector('figcaption')
        const span = doc.createElement('span')
        span.dataset.pw2Image = ''
        span.dataset.imageLayout = layout
        span.dataset.imageGap = '16'
        span.dataset.caption = caption?.textContent || ''
        span.dataset.captionHtml = caption?.innerHTML || ''
        span.dataset.showCaption = String(Boolean(caption))
        const width = (wrapper as HTMLElement).style.width || img.style.width
        if (width) span.style.width = width
        span.appendChild(img)
        wrapper.replaceWith(span)
    })
    return doc.body.innerHTML
}
