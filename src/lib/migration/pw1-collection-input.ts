import { z } from 'zod'
import { load } from 'cheerio'
import { parseBatchInput, type BatchEntry } from './pw1-batch-input'

type Row = Record<string, unknown>
type Link = { label: string; url?: string; pageId?: string; children?: Link[] }
export type CollectionReport = { sourceStoreId: string; excluded: Array<{ id: string; kind: string; reason: string }>; warnings: string[] }
const rows = (value: unknown): Row[] => z.array(z.record(z.unknown())).parse(value ?? [])
const str = (value: unknown) => value == null ? '' : String(value)
const active = (r: Row) => !r.deleted_at && (r.status == null || str(r.status) === '1')
const ordered = (value: unknown) => rows(value).slice().sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || str(a.id).localeCompare(str(b.id), 'en', { numeric: true }))
function object(value: unknown): Row {
    if (value == null || value === '') return {}
    return z.record(z.unknown()).parse(typeof value === 'string' ? JSON.parse(value) : value)
}
function settings(value: unknown): Row {
    return Object.fromEntries(rows(value).filter(active).map(r => [str(r.key), r.value]))
}
function textContent(html: string) {
    const $ = load(html)
    return Boolean($.text().replace(/\u00a0/g, ' ').trim() || $('img,iframe,video,audio,table,hr').length)
}

/** Project website data only. Commerce/customer/order records never enter the AI contract. */
export function parseMigrationInput(input: unknown): { entries: BatchEntry[]; reports: CollectionReport[] } {
    if (!Array.isArray(input) || !input.length || !input[0] || !('tenants' in input[0])) return { entries: parseBatchInput(input), reports: [] }
    const reports: CollectionReport[] = []
    const entries: unknown[] = []
    for (const bundle of rows(input)) {
        for (const site of rows(bundle.sites)) {
            const tenants = rows(bundle.tenants).filter(t => t._ref === site.tenant)
            if (tenants.length !== 1) throw new Error('Site must resolve exactly one tenant')
            const tenant = tenants[0], storeId = str(object(tenant.metaData).pw1StoreId)
            if (!/^\d+$/.test(storeId)) throw new Error('Missing PW1 store identity')
            const report: CollectionReport = { sourceStoreId: storeId, excluded: [], warnings: [] }
            reports.push(report)
            const exclude = (id: unknown, kind: string, reason: string) => report.excluded.push({ id: str(id), kind, reason })
            const owners = rows(bundle.users).filter(u => rows(u.tenants).some(m => m.tenant === tenant._ref && m.role === 'owner' && m.status === 'active'))
            if (owners.length !== 1) throw new Error(`Store ${storeId}: expected exactly one active owner`)
            const owner = owners[0], ownerMatch = /^@users:users:(\d+)$/.exec(str(owner._ref))
            if (!ownerMatch) throw new Error('Missing source owner reference')
            const locale = z.enum(['en', 'ms']).parse(site.locale)
            const localized = (r: Row, key = 'name') => str(locale === 'ms' && r[`${key}_ms`] ? r[`${key}_ms`] : r[key])
            const base = new URL(/^https?:\/\//.test(str(site.domain)) ? str(site.domain) : `https://${str(site.domain)}`)
            if (!site.domain) throw new Error(`Store ${storeId}: missing website domain`)
            const pageRows = ordered(bundle.pages).filter(p => str(p.store_id) === storeId)
            if (new Set(pageRows.map(p => str(p.id))).size !== pageRows.length) throw new Error('Duplicate source page ID')
            const validPages = pageRows.filter(p => {
                if (!active(p)) { exclude(p.id, 'page', 'disabled-or-deleted'); return false }
                return true
            })
            if (!validPages.length) throw new Error(`Store ${storeId}: no active pages to migrate`)
            const pageById = new Map(pageRows.map(p => [str(p.id), p]))
            const pagePath = (p: Row) => str(p.type) === '1' ? '/' : '/' + str(p.slug).replace(/^\/+/, '')
            const resolveTarget = (model: unknown, id: unknown, url: unknown, context: string): Omit<Link, 'label'> | undefined => {
                if (model) {
                    const kind = str(model).split('\\').filter(Boolean).at(-1)
                    if (kind === 'Page') {
                        const target = pageById.get(str(id))
                        if (!target || !active(target)) { exclude(context, 'link', `missing-or-deleted-page:${str(id)}`); return }
                        if (['4', '5', '6'].includes(str(target.type))) return { url: new URL(pagePath(target), base).href }
                        return { pageId: str(id) }
                    }
                    if (kind === 'Brand') { report.warnings.push(`${context}: Brand ${str(id)} CTA deferred`); return }
                    const collection = kind === 'Category' ? 'categories' : kind === 'BlogCategory' ? 'blog_categories' : undefined
                    if (collection) {
                        const target = rows(bundle[collection]).find(r => str(r._ref).endsWith(`:${str(id)}`) && r.tenant === tenant._ref)
                        if (!target) { report.warnings.push(`${context}: missing ${kind} ${str(id)}`); return }
                        report.warnings.push(`${context}: category CTA retains source URL until destination ID mapping is available`)
                        return { url: new URL(`${kind === 'Category' ? '/products' : '/articles'}?category=${encodeURIComponent(str(id))}`, base).href }
                    }
                    throw new Error(`${context}: unsupported link model ${kind}`)
                }
                if (!url) return
                const target = new URL(str(url), base)
                if (!['https:', 'http:'].includes(target.protocol)) throw new Error(`${context}: unsupported URL protocol`)
                if (target.origin === base.origin) {
                    const page = pageRows.find(p => pagePath(p) === target.pathname)
                    if (page && !active(page)) { exclude(context, 'link', 'deleted-page-url'); return }
                }
                return { url: target.href }
            }
            const menus = ordered(site.menus).filter(active)
            const menuLinks = (item: Row): Link[] => {
                const values = { ...item, ...settings(item.model_settings) }
                const target = resolveTarget(values.model_type, values.model_id, values.url, `menu:${str(item.id)}`)
                const children = ordered(item.menu_lines).filter(active).flatMap(line => {
                    const v = settings(line.model_settings)
                    const dest = resolveTarget(v.model_type, v.model_id, v.url, `menu-line:${str(line.id)}`)
                    if (!dest) {
                        if (v.content || v.content_ms) report.warnings.push(`menu-line:${str(line.id)}: formatted footer content flattened to tagline`)
                        return []
                    }
                    return [{ label: localized(v), ...dest }]
                })
                // Deleted parent destination is removed; valid child links are promoted.
                return target ? [{ label: localized(values), ...target, ...(children.length ? { children } : {}) }] : children
            }
            const header = menus.find(m => str(m.type) === '1'), footer = menus.find(m => str(m.type) === '2')
            const headerConfig = object(header?.config)
            if (Number(headerConfig.search_status) === 1) report.warnings.push('Header product search setting is retained in source only; native navigation search mapping is pending')
            const pages = validPages.filter(p => {
                if (['4', '5', '6'].includes(str(p.type))) { exclude(p.id, 'page', 'native-commerce-runtime'); return false }
                return true
            }).map(p => ({ sourceId: str(p.id), title: localized(p) || str(p.title), path: pagePath(p), components: ordered(p.components).flatMap<unknown>(c => {
                if (str(c.page_id) !== str(p.id)) throw new Error('Component/page ownership mismatch')
                if (!active(c)) { exclude(c.id, 'component', 'disabled-or-deleted'); return [] }
                for (const row of [...rows(c.model_settings), ...rows(c.shortlist_items)]) {
                    if (row.store_id != null && str(row.store_id) !== storeId) throw new Error('Component data belongs to another store')
                    if (row.page_component_id != null && str(row.page_component_id) !== str(c.id)) throw new Error('Item/component ownership mismatch')
                }
                const definition = object(c.frontend_component)
                const config = { ...object(definition.default_config_values), ...settings(c.model_settings) }
                const type = str(definition.name) || str(c.tag_name).replace('pa101-', '').replaceAll('-', '_')
                const common = { sourceId: str(c.id), type, enabled: true }
                const sourceSettings = { ...config, selectedItems: rows(c.shortlist_items).filter(active).map(i => ({ sourceId: str(i.model_id), modelType: str(i.model_type), position: i.position })) }
                if (type === 'banner') {
                    const slides = ordered(c.banners).filter(b => {
                        if (str(b.page_component_id) !== str(c.id) || str(b.store_id) !== storeId) throw new Error('Banner ownership mismatch')
                        if (!active(b)) { exclude(b.id, 'slide', 'disabled-or-deleted'); return false }
                        if (!b.image) { exclude(b.id, 'slide', 'missing-image'); return false }
                        return true
                    }).map(b => {
                        const h = object(b.header), sub = object(b.subheader), button = object(b.button)
                        const dest = resolveTarget(undefined, undefined, b.url, `banner:${str(b.id)}`)
                        const label = str(object(object(button.mode).default).text)
                        return { imageUrl: str(b.image), alt: str(b.name), heading: str(h.status) === '1' ? str(h.text) : '', description: str(sub.status) === '1' ? str(sub.text) : '', cta: str(button.status) === '1' && label && dest?.url ? { label, url: dest.url } : null }
                    })
                    if (!slides.length) { exclude(c.id, 'component', 'empty-banner'); return [] }
                    return [{ ...common, content: { slides }, config: { size: config.size ?? 'hero', autoplay: config.animation === 'auto', intervalMs: Number(config.timing_animation ?? 5) * 1000, sourceSettings } }]
                }
                if (type === 'rich_text') {
                    const html = str(config.content)
                    if (!textContent(html)) { exclude(c.id, 'component', 'empty-rich-text'); return [] }
                    return [{ ...common, content: { html }, config: { sourceSettings } }]
                }
                if (type === 'category_listing') {
                    const items = ordered(c.shortlist_items).filter(active).map(i => {
                        const dest = resolveTarget(i.model_type, i.model_id, '', `component:${str(c.id)}/item:${str(i.id)}`)
                        return { sourceId: str(i.id), title: str(i.name), imageUrl: str(i.image), alt: str(i.name), ...(dest?.url ? { url: dest.url, ctaLabel: str(i.cta_button_text) } : {}) }
                    })
                    if (!items.length) { exclude(c.id, 'component', 'empty-category-list'); return [] }
                    return [{ ...common, content: { heading: str(config.header), items }, config: { autoplay: config.animation === 'auto', intervalMs: Number(config.timing_animation ?? 5) * 1000, sourceSettings } }]
                }
                if (['product_listing', 'article_listing'].includes(type)) return [{ ...common, content: { heading: str(config.header) }, config: { limit: Number(config.per_page ?? (type === 'product_listing' ? 12 : 3)), sourceSettings }, binding: { source: 'pw2.database', collection: type === 'product_listing' ? 'products' : 'blogs', scope: type === 'product_listing' ? 'site' : 'tenant', emptyBehavior: 'native-empty-state' } }]
                if (['product_filter', 'product_sort', 'article_filter', 'article_sort'].includes(type)) return [{ ...common, content: { heading: str(config.header) }, config: { sourceSettings }, mappingStatus: 'pending' }]
                throw new Error(`Component ${str(c.id)}: unsupported type ${type}`)
            }) }))
            const footerItems = ordered(footer?.menu_items).filter(active)
            const tagline = footerItems.flatMap(i => ordered(i.menu_lines).filter(active).map(l => {
                const v = settings(l.model_settings), html = str(locale === 'ms' ? v.content_ms || v.content : v.content)
                return html ? load(html).text() : ''
            })).filter(Boolean).join('\n')
            const columns = footerItems.map(i => ({ title: localized(i), links: menuLinks(i) })).filter(c => c.links.length > 0)
            if (columns.length > 4) throw new Error(`Store ${storeId}: native footer supports at most 4 nonempty link columns`)
            const pickStrings = (value: unknown, keys: string[]) => {
                const data = object(value)
                return Object.fromEntries(keys.filter(key => data[key] != null).map(key => [key, str(data[key])]))
            }
            const assetUrl = (value: unknown): string | undefined => {
                if (!value) return undefined
                if (!str(value).startsWith('@')) return str(value)
                const matches = rows(bundle.media).filter(m => m._ref === value)
                if (matches.length !== 1) throw new Error(`Store ${storeId}: unresolved site media ${str(value)}`)
                const url = str(matches[0].sourceUrl || matches[0].url)
                if (!url) throw new Error(`Store ${storeId}: site media has no URL`)
                return url
            }
            const branding = object(site.branding), seo = object(site.seo)
            const siteSettings = {
                branding: { logo: assetUrl(branding.logo), favicon: assetUrl(branding.favicon) },
                contactInfo: pickStrings(site.contactInfo, ['phone', 'email', 'address']),
                socialLinks: pickStrings(site.socialLinks, ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']),
                seo: { ...pickStrings(site.seo, ['metaTitle', 'metaDescription']), ogImage: assetUrl(seo.ogImage) },
            }
            entries.push({ sourceUserId: ownerMatch[1], sourceStoreId: storeId, owner: { email: owner.email, firstName: owner.firstName }, source: { websiteUrl: base.origin }, website: {
                settings: siteSettings, name: str(site.name), locale, branding: { logoUrl: str(object(site.branding).logo) },
                features: { cart: Number(headerConfig.cart_status) === 1, orderTracking: Number(headerConfig.cart_status) === 1 && validPages.some(p => str(p.type) === '6') },
                navigation: ordered(header?.menu_items).filter(active).flatMap(menuLinks),
                footer: { copyright: Number(footer?.copyright_status) === 1 ? str(footer?.copyright_content) : '', tagline, columns }, pages,
            } })
        }
    }
    return { entries: parseBatchInput(entries), reports }
}
