import { load } from 'cheerio'
import { z } from 'zod'

export const LinkCorrectionsSchema = z.array(z.object({ from: z.string().min(1), pageId: z.string().regex(/^\d+$/), reason: z.string().min(1) }).strict()).superRefine((items, ctx) => {
    if (new Set(items.map(item => item.from.trim())).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate reviewed link correction' })
})

export type VerifiedCategoryLink = { sourceId: string; destinationId: number; sourcePath: string; destinationPath: string }

/** Resolve only pages proven to exist in this store. Never reinterpret legacy entity IDs. */
export function createSourceLinkResolver(sourceUrl: string, pages: Array<{ sourcePath: string; destinationPath: string }>, warnings: string[], categories: readonly VerifiedCategoryLink[] = [], corrections: readonly { from: string; destinationPath: string }[] = []) {
    const source = new URL(sourceUrl)
    const normalize = (path: string) => path.replace(/\/+$/, '') || '/'
    const routes = new Map<string, string>()
    for (const page of pages) {
        const path = normalize(page.sourcePath)
        if (!routes.has(path)) routes.set(path, page.destinationPath)
    }
    return (value: string): string => {
        const correction = corrections.find(item => item.from.trim() === value.trim())
        if (correction) return correction.destinationPath
        if (!value || /^(#|mailto:|tel:|sms:|whatsapp:)/i.test(value)) return value
        let target: URL
        try { target = new URL(value, source) } catch { return value }
        if (!['http:', 'https:'].includes(target.protocol) || target.host !== source.host) return value
        const entityKeys = [...target.searchParams.keys()].filter(key => /^(category|category_id|product|product_id|article|article_id|brand|brand_id)$/i.test(key))
        if (entityKeys.length === 1 && ['category','category_id'].includes(entityKeys[0])) {
            const category = categories.find(c => c.sourceId === target.searchParams.get(entityKeys[0]) && normalize(c.sourcePath) === normalize(target.pathname))
            if (category && !target.searchParams.has('categoryId')) {
                const params = new URLSearchParams(target.search)
                params.delete(entityKeys[0]); params.set('categoryId', String(category.destinationId))
                return `${category.destinationPath}?${params}${target.hash}`
            }
        }
        const path = routes.get(normalize(target.pathname))
        const legacyEntity = [...target.searchParams.keys()].some(key => /^(category|category_id|product|product_id|article|article_id|brand|brand_id)$/i.test(key))
        if (path && !legacyEntity) return `${path}${target.search}${target.hash}`
        const warning = `Unresolved source link retained: ${target.href} (${legacyEntity ? 'destination entity mapping required' : 'no migrated page matches'})`
        if (!warnings.includes(warning)) warnings.push(warning)
        return value
    }
}

export function rewriteSourceHtmlLinks(html: string, resolve: (value: string) => string): string {
    const $ = load(html, {}, false)
    let changed = false
    $('a[href]').each((_, node) => {
        const old = $(node).attr('href')!
        const next = resolve(old)
        if (next !== old) { $(node).attr('href', next); changed = true }
    })
    // Empty anchors pasted by legacy editors are invisible keyboard stops. Preserve media and named anchors.
    $('a[href]').each((_, node) => {
        const anchor = $(node)
        if (!anchor.text().trim() && (anchor.find('img').length || anchor.attr('class') || anchor.attr('style')) && !anchor.find('svg title').text().trim() && !anchor.attr('aria-label') && !anchor.attr('aria-labelledby') && !anchor.attr('title') && !anchor.find('img[alt]').toArray().some(image => Boolean($(image).attr('alt')?.trim()))) {
            const href = anchor.attr('href') ?? ''
            try {
                const target = new URL(href)
                if (['https:', 'http:'].includes(target.protocol)) {
                    anchor.attr('aria-label', target.hostname === 'maps.app.goo.gl' || target.hostname === 'maps.google.com' ? 'View location on Google Maps' : `Open link to ${target.hostname}`)
                    changed = true
                }
            } catch { /* Relative destinations need a page title, supplied by the content author. */ }
        }
        if (!anchor.text().replace(/\u00a0/g, ' ').trim() && !anchor.find('img,svg,video,audio,iframe').length && !anchor.attr('aria-label') && !anchor.attr('aria-labelledby') && !anchor.attr('title') && !anchor.attr('id') && !anchor.attr('name') && !anchor.attr('style') && !anchor.attr('class')) { anchor.replaceWith(anchor.contents()); changed = true }
    })
    return changed ? $.html() : html
}
