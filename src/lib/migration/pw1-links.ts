import { load } from 'cheerio'
import { z } from 'zod'

export const LinkCorrectionsSchema = z.array(z.object({ from: z.string().min(1), pageId: z.string().regex(/^\d+$/), reason: z.string().min(1) }).strict()).superRefine((items, ctx) => {
    if (new Set(items.map(item => item.from.trim())).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate reviewed link correction' })
})

export type VerifiedCategoryLink = { sourceId: string; destinationId: number; sourcePath: string; destinationPath: string }

export type SourceLinkFinding = { url: string; location: string; reason: 'missing-page' | 'waiting-be' | 'confirmed-broken'; action: 'retained' | 'disabled' }
export const SourceOriginsSchema = z.array(z.string().url().refine(value => {
    try {
        const u = new URL(value)
        return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash
    } catch { return false }
}, 'Expected source origin')).optional()
export const normalizeSourcePath = (path: string) => path.replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase() || '/'
export function isSourceHost(target: URL, sourceUrl: string, origins: readonly string[] = []) {
    return ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password && [sourceUrl, ...origins].some(origin => new URL(origin).host === target.host)
}

export type SourceLinkPolicy = { unavailableCategories?: readonly {sourceId:string;sourcePath:string}[]; sourceOrigins?: readonly string[]; aliases?: readonly { sourcePath: string; destinationPath: string }[]; brokenUrls?: readonly string[]; findings?: SourceLinkFinding[] }

/** Resolve only pages proven to exist in this store. Never reinterpret legacy entity IDs. */
export function createSourceLinkResolver(sourceUrl: string, pages: Array<{ sourcePath: string; destinationPath: string }>, warnings: string[], categories: readonly VerifiedCategoryLink[] = [], corrections: readonly { from: string; destinationPath: string }[] = [], policy: SourceLinkPolicy = {}) {
    const source = new URL(sourceUrl)
    const normalize = normalizeSourcePath
    const routes = new Map<string, string>()
    for (const page of pages) {
        const path = normalize(new URL(page.sourcePath, source).pathname)
        if (!routes.has(path)) routes.set(path, page.destinationPath)
    }
    const aliases = new Map<string, Set<string>>()
    for (const alias of policy.aliases ?? []) {
        const path = normalize(new URL(alias.sourcePath, source).pathname)
        const destinations = aliases.get(path) ?? new Set<string>()
        destinations.add(alias.destinationPath); aliases.set(path, destinations)
    }
    for (const [path, destinations] of aliases) {
        if (routes.has(path)) continue
        if (destinations.size === 1) routes.set(path, [...destinations][0])
        else warnings.push(`Ambiguous source page alias retained: ${path}`)
    }
    return (value: string, location = 'unknown'): string => {
        const correction = corrections.find(item => item.from.trim() === value.trim())
        if (correction) return correction.destinationPath
        if (!value || /^(#|mailto:|tel:|sms:|whatsapp:)/i.test(value)) return value
        let target: URL
        try { target = new URL(value, source) } catch { return value }
        if (!isSourceHost(target, sourceUrl, policy.sourceOrigins)) return value
        const entityKeys = [...target.searchParams.keys()].filter(key => /^(category|category_id|product|product_id|article|article_id|brand|brand_id)$/i.test(key))
        if (entityKeys.length === 1 && ['category','category_id'].includes(entityKeys[0])) {
            const category = categories.find(c => c.sourceId === target.searchParams.get(entityKeys[0]) && normalize(c.sourcePath) === normalize(target.pathname))
            if (category && !target.searchParams.has('categoryId')) {
                const params = new URLSearchParams(target.search)
                params.delete(entityKeys[0]); params.set('categoryId', String(category.destinationId))
                return `${category.destinationPath}?${params}${target.hash}`
            }
        }
        if (entityKeys.length === 1 && ['category', 'category_id'].includes(entityKeys[0])) {
            const unavailable = policy.unavailableCategories?.find(row => row.sourceId === target.searchParams.get(entityKeys[0]) && normalize(row.sourcePath) === normalize(target.pathname))
            const destinationPath = routes.get(normalize(target.pathname))
            if (unavailable && destinationPath) {
                const params = new URLSearchParams(target.search)
                params.delete(entityKeys[0]); params.set('categoryId', '0')
                warnings.push(`Unavailable source category ${unavailable.sourceId}: migrated listing opens empty`)
                return `${destinationPath}?${params}${target.hash}`
            }
        }
        const path = routes.get(normalize(target.pathname))
        const legacyEntity = [...target.searchParams.keys()].some(key => /^(category|category_id|product|product_id|article|article_id|brand|brand_id)$/i.test(key))
        if (path && !legacyEntity) return `${path}${target.search}${target.hash}`
        const broken = !legacyEntity && policy.brokenUrls?.includes(target.href)
        policy.findings?.push({ url: target.href, location, reason: legacyEntity ? 'waiting-be' : broken ? 'confirmed-broken' : 'missing-page', action: broken ? 'disabled' : 'retained' })
        if (broken) {
            warnings.push(`Confirmed broken source link disabled: ${target.href} (${location})`)
            return ''
        }
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
        if (!next) { $(node).replaceWith($(node).contents()); changed = true }
        else if (next !== old) { $(node).attr('href', next); changed = true }
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
