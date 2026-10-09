import { load } from 'cheerio'

/** Translate legacy editor layout markers into portable, block-local inline CSS. */
export function adaptPw1RichTextLayout(html: string): string {
    const $ = load(html, null, false)
    const appendStyle = (element: ReturnType<typeof $>, css: string) => element.attr('style', `${element.attr('style') ?? ''};${css}`)
    // A legacy two-image row can put alignment directly on img, with optional link wrappers.
    $('p').each((_, node) => {
        const paragraph = $(node)
        if (paragraph.text().trim()) return
        const children = paragraph.children()
        if (children.length !== 2) return
        const images = children.map((_, child) => {
            const el = $(child)
            if (el.is('img')) return child
            if (el.is('a') && el.children().length === 1 && el.children().first().is('img')) return el.children()[0]
            return null
        })
        if (images.length !== 2 || !$(images[0]).hasClass('image-style-align-left') || !$(images[1]).hasClass('image-style-align-right')) return
        const row = $('<div data-pw1-image-pair="true" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px;align-items:center;clear:both"></div>')
        // Retain the paragraph's classes, style and identity; only replace invalid p-as-layout semantics.
        for (const [key, value] of Object.entries(node.attribs)) row.attr(key, value)
        appendStyle(row, 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px;align-items:center;clear:both')
        row.append(paragraph.contents())
        paragraph.replaceWith(row)
        images.each((_, image) => {
            const el = $(image)
            appendStyle(el, 'float:none;display:block;max-width:100%;height:auto;margin:0')
            if (!el.attr('width') && !/(?:^|;)\s*width\s*:/i.test(el.attr('style') ?? '')) appendStyle(el, 'width:100%')
        })
        row.children('a').each((_, anchor) => { appendStyle($(anchor), 'display:block;min-width:0') })
    })
    $('img.image-style-align-left,img.image-style-align-right,img.image-style-align-center').each((_, node) => {
        const image = $(node)
        if (image.closest('figure,[data-pw1-image-pair]').length) return
        appendStyle(image, 'max-width:100%;height:auto')
        if (image.hasClass('image-style-align-center')) appendStyle(image, 'display:block;margin-left:auto;margin-right:auto')
        else if (image.hasClass('image-style-align-right')) appendStyle(image, 'float:right;margin-left:24px;margin-right:0')
        else appendStyle(image, 'float:left;margin-left:0;margin-right:24px')
    })
    const eligible = (element: ReturnType<typeof $>) => element.is('figure.image.image-style-align-left')
        && element.find('img').length === 1 && element.find('figcaption').text().trim().length > 0
        && !/\b(width|float|display)\s*:/i.test(element.attr('style') ?? '')
        && !element.attr('width')
    // Only contiguous legacy image/caption groups; prose, tables and other wrappers are boundaries.
    $('figure.image.image-style-align-left').each((_, node) => {
        const first = $(node)
        if (first.parent().attr('data-pw1-gallery') || !eligible(first)) return
        const group = [node]
        let next = first.next()
        while (next.length && eligible(next)) { group.push(next[0]); next = next.next() }
        if (group.length < 2) return
        const gallery = $('<div data-pw1-gallery="true" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:24px;align-items:start;clear:both"></div>')
        first.before(gallery)
        for (const figure of group) {
            const el = $(figure)
            appendStyle(el, 'float:none;width:auto;min-width:0;margin:0')
            gallery.append(el)
        }
    })
    $('figure.image').each((_, node) => {
        const figure = $(node)
        const inGallery = Boolean(figure.parent().attr('data-pw1-gallery'))
        appendStyle(figure, 'max-width:100%')
        if (!inGallery) {
            if (figure.hasClass('image-style-align-center')) appendStyle(figure, 'display:table;margin-left:auto;margin-right:auto')
            else if (figure.hasClass('image-style-align-left')) appendStyle(figure, 'float:left;margin-left:0;margin-right:24px')
            else if (figure.hasClass('image-style-align-right')) appendStyle(figure, 'float:right;margin-right:0;margin-left:24px')
        }
        figure.find('img').each((_, image) => { appendStyle($(image), `max-width:100%;height:auto;display:block${inGallery ? ';width:100%' : ''}`) })
        figure.find('figcaption').each((_, caption) => { appendStyle($(caption), 'text-align:center;overflow-wrap:anywhere') })
    })
    return $.html()
}
