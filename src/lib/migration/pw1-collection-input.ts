import { extractFooterSocials } from './pw1-footer-socials'
import { SourceOriginsSchema, isSourceHost, normalizeSourcePath } from './pw1-links'
import { PW1_PLACEHOLDER_URL } from './pw1-placeholder'
import { z } from 'zod'
import { load } from 'cheerio'
import { parseBatchInput, type BatchEntry } from './pw1-batch-input'

type Row = Record<string, unknown>
const FOOTER_CONTACT_URL = /^(mailto|tel|sms|whatsapp):\S+$/i
type Link = { label: string; url?: string; pageId?: string; children?: Link[] }
export type CollectionReport = { sourceStoreId: string; excluded: Array<{ id: string; kind: string; reason: string }>; warnings: string[] }
const rows = (value: unknown): Row[] => z.array(z.record(z.unknown())).parse(value ?? [])
const str = (value: unknown) => value == null ? '' : String(value)
const active = (r: Row) => !r.deleted_at && (r.status == null || str(r.status) === '1')
/** Legacy exports may omit the scheme from an otherwise absolute image URL. */
function bannerImageUrl(value: unknown): string {
    const url = str(value).trim().replace(/ /g, '%20')
    if (url.startsWith('//')) return `https:${url}`
    if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(url)) return `https://${url}`
    return url
}
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
            // BE exports default site.locale to ms independently of the PW1 storefront.
            // PW1's unprefixed public routes use English; sourceLocale explicitly selects /ms content.
            const locale = z.enum(['en', 'ms']).parse(site.sourceLocale ?? 'en')
            const localized = (r: Row, key = 'name') => str(locale === 'ms' && r[`${key}_ms`] ? r[`${key}_ms`] : r[key])
            const origins = SourceOriginsSchema.parse(rows(bundle.store_domains).filter(row => str(row.store_id) === storeId && active(row)).map(row => {
                const domain = str(row.domain).trim()
                const url = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`)
                if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Store ${storeId}: invalid source domain`)
                return url.origin
            })) ?? []
            const destinationBase = new URL(/^https?:\/\//.test(str(site.domain)) ? str(site.domain) : `https://${str(site.domain)}`)
            const base = destinationBase
            const recognizedOrigins = [...new Set([...origins, destinationBase.origin])]
            if (!site.domain) throw new Error(`Store ${storeId}: missing website domain`)
            const pageRows = ordered(bundle.pages).filter(p => str(p.store_id) === storeId)
            if (new Set(pageRows.map(p => str(p.id))).size !== pageRows.length) throw new Error('Duplicate source page ID')
            const disabledHomepage = !pageRows.some(p => str(p.type) === '1' && active(p))
                ? pageRows.find(p => str(p.type) === '1' && !p.deleted_at && str(p.status) === '0')
                : undefined
            if (disabledHomepage) report.warnings.push(`Homepage ${str(disabledHomepage.id)} is disabled in PW1; preserve content as draft and do not auto-publish this website`)
            const validPages = pageRows.filter(p => {
                if (p === disabledHomepage) return true
                if (!active(p)) { exclude(p.id, 'page', 'disabled-or-deleted'); return false }
                return true
            })
            if (!validPages.length) throw new Error(`Store ${storeId}: no active pages to migrate`)
            const hasCommerceComponent = (p: Row) => rows(p.components).some(c => active(c) && ['cart', 'checkout'].includes(str(object(c.frontend_component).name)))
            const isNativeCommercePage = (p: Row) => ['/cart', '/checkout'].includes(pagePath(p)) && hasCommerceComponent(p)
            const pageById = new Map(pageRows.map(p => [str(p.id), p]))
            const pagePath = (p: Row) => {
                if (str(p.type) === '1') return '/'
                const fallback = '/' + (str(p.slug).replace(/^\/+/, '') || `page-pw1-${str(p.id)}`)
                const raw = str(p.url).trim()
                if (!raw) return fallback.toLowerCase()
                const url = new URL(raw, base)
                // Some PW1 page records use an external destination or homepage
                // anchor as their URL. Keep the page content under its own slug.
                if (!isSourceHost(url, base.origin, recognizedOrigins) || url.pathname === '/') return fallback.toLowerCase()
                return url.pathname.toLowerCase()
            }
            const categoryMappings = new Map<string, {sourceId:string;sourcePath:string;status:'pending'|'unavailable'}>()
            const resolveTarget = (model: unknown, id: unknown, url: unknown, context: string, preserveLabel = false): Omit<Link, 'label'> | undefined => {
                if (model) {
                    const kind = str(model).split('\\').filter(Boolean).at(-1)
                    if (kind === 'Page') {
                        const target = pageById.get(str(id))
                        if (!target || !active(target)) { exclude(context, 'link', `missing-or-deleted-page:${str(id)}`); return }
                        if (['4', '5', '6'].includes(str(target.type)) || isNativeCommercePage(target)) return { url: new URL(pagePath(target), base).href }
                        return { pageId: str(id) }
                    }
                    if (kind === 'Brand') { report.warnings.push(`${context}: Brand ${str(id)} CTA deferred`); return }
                    const collection = kind === 'Category' ? 'categories' : kind === 'BlogCategory' ? 'blog_categories' : undefined
                    if (collection) {
                        const target = rows(bundle[collection]).find(r => str(r._ref).endsWith(`:${str(id)}`) && r.tenant === tenant._ref)
                        if (kind === 'Category') categoryMappings.set(str(id), {sourceId:str(id),sourcePath:'/products',status:target ? 'pending' : 'unavailable'})
                        if (!target) {
                            if (!/^\d+$/.test(str(id))) throw new Error(`${context}: invalid ${kind} source identity`)
                            report.warnings.push(`${context}: missing ${kind} ${str(id)}; destination unavailable`)
                            // Preserve the Products route with an explicit empty selection; never reuse a PW1 ID as a PW2 ID.
                            return preserveLabel && kind === 'Category' ? { url: new URL(`/products?category=${encodeURIComponent(str(id))}`, base).href } : undefined
                        }
                        report.warnings.push(`${context}: category CTA retains source URL until destination ID mapping is available`)
                        return { url: new URL(`${kind === 'Category' ? '/products' : '/articles'}?category=${encodeURIComponent(str(id))}`, base).href }
                    }
                    throw new Error(`${context}: unsupported link model ${kind}`)
                }
                if (!url) return
                // Footer-only (preserveLabel): click-to-call/mail links render natively, so keep them instead of rejecting the store.
                if (preserveLabel && FOOTER_CONTACT_URL.test(str(url).trim())) return { url: str(url).trim() }
                const target = new URL(str(url), base)
                if (!['https:', 'http:'].includes(target.protocol)) throw new Error(`${context}: unsupported URL protocol`)
                if (isSourceHost(target, base.origin, recognizedOrigins)) {
                    const page = pageRows.find(p => normalizeSourcePath(pagePath(p)) === normalizeSourcePath(target.pathname))
                    if (page && !active(page)) { exclude(context, 'link', 'deleted-page-url'); return }
                    if (page) target.pathname = pagePath(page)
                }
                return { url: target.href }
            }
            const menus = ordered(site.menus).filter(active)
            const menuLinks = (item: Row, preserveLabel = false): Link[] => {
                const values = { ...item, ...settings(item.model_settings) }
                const target = resolveTarget(values.model_type, values.model_id, values.url, `menu:${str(item.id)}`, preserveLabel)
                const children = ordered(item.menu_lines).filter(active).flatMap(line => {
                    const v = settings(line.model_settings)
                    const dest = resolveTarget(v.model_type, v.model_id, v.url, `menu-line:${str(line.id)}`, preserveLabel)
                    if (!dest) {
                        if (v.content || v.content_ms) report.warnings.push(`menu-line:${str(line.id)}: footer text retained in its source column`)
                        return []
                    }
                    return [{ label: localized(v), ...dest }]
                })
                // Deleted parent destination is removed; valid child links are promoted.
                return target ? [{ label: localized(values), ...target, ...(children.length ? { children } : {}) }] : children
            }
            const header = menus.find(m => str(m.type) === '1'), footer = menus.find(m => str(m.type) === '2')
            const headerConfig = object(header?.config)
            // Explicit visibility takes priority over PW1's pre-created system pages.
            // Do not coerce null/empty/missing values to zero.
            const cartHidden = headerConfig.cart_status === 0 || headerConfig.cart_status === '0' || headerConfig.cart_status === false
            const cartEnabled = !cartHidden && (str(headerConfig.cart_status) === '1' || validPages.some(p => ['4','5'].includes(str(p.type)) || hasCommerceComponent(p)))
            if (Number(headerConfig.search_status) === 1) report.warnings.push('Header product search setting is retained in source only; native navigation search mapping is pending')
            const pages = validPages.filter(p => {
                if (['4', '5', '6'].includes(str(p.type)) || isNativeCommercePage(p)) { exclude(p.id, 'page', 'native-commerce-runtime'); return false }
                return true
            }).map(p => ({ sourceId: str(p.id), title: localized(p) || str(p.title), path: pagePath(p), ...(str(p.slug).trim() ? { aliases: ['/' + str(p.slug).replace(/^\/+/, '')] } : {}), components: ordered(p.components).flatMap<unknown>(c => {
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
                if (['cart', 'checkout'].includes(type)) { exclude(c.id, 'component', 'native-commerce-runtime'); return [] }
                if (type === 'banner') {
                    const slides = ordered(c.banners).filter(b => {
                        if (str(b.page_component_id) !== str(c.id) || str(b.store_id) !== storeId) throw new Error('Banner ownership mismatch')
                        if (!active(b)) { exclude(b.id, 'slide', 'disabled-or-deleted'); return false }
                        if (!b.image || str(b.image).trim().toLowerCase() === 'undefined') { exclude(b.id, 'slide', 'missing-image'); return false }
                        return true
                    }).map(b => {
                        const h = object(b.header), sub = object(b.subheader), button = object(b.button)
                        const buttonEnabled = str(button.status) === '1'
                        const dest = buttonEnabled ? resolveTarget(undefined, undefined, b.url, `banner:${str(b.id)}`) : undefined
                        const label = buttonEnabled ? str(object(object(button.mode).default).text) : ''
                        return { imageUrl: bannerImageUrl(b.image), alt: str(b.name), heading: str(h.status) === '1' ? str(h.text) : '', description: str(sub.status) === '1' ? str(sub.text) : '', cta: buttonEnabled && label ? { label, url: dest?.url ?? '' } : null }
                    })
                    if (!slides.length) { exclude(c.id, 'component', 'empty-banner'); return [] }
                    return [{ ...common, content: { slides }, config: { size: config.size ?? 'hero', autoplay: config.animation === 'auto', intervalMs: Math.max(1000, Number(config.timing_animation ?? 5) * 1000), sourceSettings } }]
                }
                if (type === 'rich_text') {
                    const contentSetting = rows(c.model_settings).find(r => active(r) && r.key === 'content')
                    if (contentSetting && !Object.prototype.hasOwnProperty.call(contentSetting, 'value')) {
                        throw new Error(`Store ${storeId}, page ${str(p.id)}, component ${str(c.id)}: source rich-text setting ${str(contentSetting.id)} is missing value; re-export source content`)
                    }
                    const html = str(config.content)
                    if (!textContent(html)) { exclude(c.id, 'component', 'empty-rich-text'); return [] }
                    return [{ ...common, content: { html }, config: { sourceSettings } }]
                }
                if (type === 'category_listing') {
                    const items = ordered(c.shortlist_items).filter(active).map(i => {
                        const dest = resolveTarget(i.model_type, i.model_id, '', `component:${str(c.id)}/item:${str(i.id)}`)
                        return { sourceId: str(i.id), title: str(i.name), imageUrl: str(i.image).trim() || PW1_PLACEHOLDER_URL, alt: str(i.name), ...(dest ? { ...dest, ctaLabel: str(i.cta_button_text) } : {}) }
                    })
                    if (!items.length) { exclude(c.id, 'component', 'empty-category-list'); return [] }
                    return [{ ...common, content: { heading: str(config.header), items }, config: { autoplay: config.animation === 'auto', intervalMs: Math.max(1000, Number(config.timing_animation ?? 5) * 1000), sourceSettings } }]
                }
                if (['product_listing', 'article_listing'].includes(type)) return [{ ...common, content: { heading: str(config.header) }, config: { limit: Number(config.per_page ?? (type === 'product_listing' ? 12 : 3)), sourceSettings,
                    ...(type === 'product_listing' ? { productSelection: {
                        mode: str(config.list_type || 'all'),
                        ...(config.product_category && str(config.product_category) !== '0' ? { sourceCategoryId: str(config.product_category) } : {}),
                        sourceProductIds: ordered(c.shortlist_items).filter(active).map(item => {
                            if (!str(item.model_type).endsWith('\\Product')) throw new Error(`Component ${str(c.id)}: unsupported product selection model`)
                            return str(item.model_id)
                        }),
                        includeOutOfStock: ![0, '0', false].includes(object(config.others).display_out_of_stock as string | number | boolean),
                    } } : {}),
                }, binding: { source: 'pw2.database', collection: type === 'product_listing' ? 'products' : 'blogs', scope: type === 'product_listing' ? 'site' : 'tenant', emptyBehavior: 'native-empty-state' } }]
                if (['product_filter', 'product_sort', 'article_filter', 'article_sort'].includes(type)) return [{ ...common, content: { heading: str(config.header) }, config: { sourceSettings }, mappingStatus: 'pending' }]
                throw new Error(`Component ${str(c.id)}: unsupported type ${type}`)
            }) }))
            const footerItems = ordered(footer?.menu_items).filter(active)
            const footerSocials = extractFooterSocials(footerItems.flatMap(i => ordered(i.menu_lines).filter(active)), message => report.warnings.push(message))
            // PW1 footer columns contain ordinary links, rich text and arbitrary icon links.
            // Preserve their column ownership; icon links are not necessarily social networks.
            const columns = footerItems.map(item => {
                const lines = ordered(item.menu_lines).filter(active)
                const links = menuLinks(item, true)
                // Rich-text lines may hold hyperlinks (e.g. an "Our Services" list pointing at /services).
                // A line made only of anchors becomes a column link; anchors mixed into prose stay in the
                // text and are also kept as links so no destination is lost. Anchors may be http(s), relative,
                // mailto:/tel:/sms:/whatsapp: or image-only (kept as an image link); other schemes stay text.
                const richLinks: Link[] = []
                const text = lines.map(line => {
                    const v = settings(line.model_settings)
                    const html = str(locale === 'ms' ? v.content_ms || v.content : v.content)
                    if (!html) return ''
                    const document = load(html)
                    const where = `footer-richtext:${str(line.id)}`
                    const anchors: (Link & { imageUrl?: string })[] = []
                    document('a[href]').each((_, el) => {
                        const anchor = document(el)
                        const href = str(anchor.attr('href')).trim()
                        const image = anchor.find('img[src]').first()
                        let imageUrl: string | undefined
                        const rawSrc = str(image.attr('src')).trim()
                        try { const src = rawSrc ? new URL(rawSrc, base) : undefined; if (src && ['https:', 'http:'].includes(src.protocol)) imageUrl = src.href } catch { imageUrl = undefined }
                        const label = anchor.text().replace(/\s+/g, ' ').trim() || str(image.attr('alt')).trim()
                        let target: Omit<Link, 'label'> | undefined
                        try {
                            const parsed = new URL(href, base)
                            if (FOOTER_CONTACT_URL.test(href)) target = { url: href }
                            else if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) target = resolveTarget(undefined, undefined, parsed.href, where, true)
                            if (target && !label && !imageUrl) target = undefined
                            if (target && !label) report.warnings.push(`${where}: image link without alt text`)
                        } catch { target = undefined }
                        if (!target) return
                        anchors.push({ label: label || new URL(target.url ?? base.href).hostname, ...target, ...(imageUrl ? { imageUrl } : {}) })
                        anchor.replaceWith(`\u0001${anchors.length - 1}\u0001`)
                    })
                    // Adjacent inline tags ("<b>Phone:</b><span>0123</span>") render with CSS spacing in PW1 but
                    // concatenate once flattened, so restore the space after a trailing colon.
                    document('span, strong, b, em, i, u, font, label').each((_, el) => {
                        const next = el.next
                        const following = next?.type === 'text' ? (next as { data?: string }).data ?? '' : next ? document(next).text() : ''
                        if (document(el).text().trimEnd().endsWith(':') && following && !/^\s/.test(following)) document(el).append(' ')
                    })
                    document('br').replaceWith('\n')
                    document('p, div, li, h1, h2, h3, h4, h5, h6').append('\n')
                    const kept = document.root().text().replace(/:(?=\u0001)/g, ': ').replace(/\n{3,}/g, '\n\n').trim().split('\n').flatMap(raw => {
                        const row = raw.trim()
                        const tokens = [...row.matchAll(/\u0001(\d+)\u0001/g)].map(m => anchors[Number(m[1])])
                        // "Phone: <a href=tel:...>0123</a>" is one clickable item, not a text line plus a duplicate link.
                        const labelled = tokens.length === 1 && /^[^\u0001]*:\s*\u0001\d+\u0001$/.test(row)
                        if (labelled) {
                            richLinks.push({ ...tokens[0], label: row.replace(/\u0001(\d+)\u0001/g, (_, i) => anchors[Number(i)].label) })
                            return []
                        }
                        richLinks.push(...tokens)
                        if (tokens.length && !row.replace(/\u0001\d+\u0001/g, '').trim()) return []
                        if (tokens.length) report.warnings.push(`${where}: inline link kept as text and as column link`)
                        return [row.replace(/\u0001(\d+)\u0001/g, (_, i) => anchors[Number(i)].label)]
                    })
                    if (document('img').length) report.warnings.push(`${where}: image outside a link omitted`)
                    return kept.join('\n')
                }).filter(Boolean).join('\n')
                const iconLinks = lines.flatMap(line => {
                    const v = settings(line.model_settings)
                    return Object.keys(v).filter(key => /^items\.\d+\.url$/.test(key)).sort((a,b) => Number(a.split('.')[1]) - Number(b.split('.')[1])).flatMap(key => {
                        const url = str(v[key]).trim()
                        if (!url) return []
                        let parsedUrl: URL
                        try { parsedUrl = new URL(url) } catch { report.warnings.push(`footer-icon:${str(line.id)}: invalid URL omitted`); return [] }
                        if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) { report.warnings.push(`footer-icon:${str(line.id)}: unsafe URL omitted`); return [] }
                        const target = resolveTarget(undefined, undefined, url, `footer-icon:${str(line.id)}`)
                        if (!target?.url) throw new Error(`Footer icon target could not be preserved: ${str(line.id)}`)
                        const host = new URL(url).hostname.replace(/^www\./, '')
                        const label = host.includes('whatsapp') || host === 'wa.me' ? 'WhatsApp'
                            : host.includes('google') ? 'Google Maps'
                            : host.includes('grab') ? 'GrabMart'
                            : host.includes('foodpanda') ? 'Foodpanda'
                            : host.includes('facebook') ? 'Facebook' : host
                        const imageUrl = str(v[key.replace(/\.url$/, '.image')]).trim()
                        return [{label, ...target, ...( /^https?:\/\//.test(imageUrl) ? {imageUrl} : {})}]
                    })
                })
                return { title: localized(item), links: [...links, ...richLinks, ...iconLinks], ...(text ? {text} : {}) }
            }).filter(column => column.links.length > 0 || column.text)
            const tagline = ''
            // PW1 footers show the store description (PW2 keeps it as the SEO description) and contact details under the
            // logo. Only the dark-gradient footer renders them, so the binder applies them once the variant is known.
            const storeDescription = str(object(site.seo).metaDescription).trim()
            // Native footer renders at most 4 columns. Fold overflow columns into the 4th so every
            // source link and text survives instead of rejecting the whole store.
            if (columns.length > 4) {
                const [last, ...overflow] = columns.splice(3)
                const text = [last.text, ...overflow.filter(c => c.text).map(c => [c.title, c.text].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n')
                columns.push({ title: last.title, links: [...last.links, ...overflow.flatMap(c => c.links)], ...(text ? { text } : {}) })
                report.warnings.push(`footer: ${overflow.length} column(s) beyond 4 merged into "${last.title}"`)
            }
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
            let logo: string | undefined
            try {
                const resolved = assetUrl(branding.logo)
                if (resolved && z.string().url().refine(v => /^https?:\/\//i.test(v)).safeParse(resolved).success) logo = resolved
            } catch {
                // An unresolved optional logo must not block the store's website migration.
                report.warnings.push('Logo media reference could not be resolved; migrating without logo')
            }
            if (!logo) report.warnings.push('Logo missing or invalid; using website name without logo')
            let favicon: string | undefined
            try {
                const resolved = assetUrl(branding.favicon)
                if (resolved && z.string().url().refine(v => /^https?:\/\//i.test(v)).safeParse(resolved).success) favicon = resolved
            } catch {
                report.warnings.push('Favicon media reference could not be resolved; migrating without favicon')
            }
            const siteSettings = {
                branding: { logo, favicon },
                contactInfo: pickStrings(site.contactInfo, ['phone', 'email', 'address']),
                socialLinks: pickStrings(site.socialLinks, ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']),
                seo: { ...pickStrings(site.seo, ['metaTitle', 'metaDescription']), ogImage: assetUrl(seo.ogImage) },
            }
            entries.push({ categoryMappings: [...categoryMappings.values()], ...(bundle.linkCorrections ? { linkCorrections: bundle.linkCorrections } : {}), ...(bundle.destination ? { destination: bundle.destination } : {}), sourceUserId: ownerMatch[1], sourceStoreId: storeId, owner: { email: owner.email, firstName: owner.firstName }, source: { websiteUrl: base.origin, ...(origins.length ? { origins: recognizedOrigins } : {}) }, website: {
                ...(disabledHomepage ? { publication: 'keep-draft' } : {}), settings: siteSettings, name: str(site.name), locale, branding: { logoUrl: logo },
                features: { cart: cartEnabled, orderTracking: cartEnabled && validPages.some(p => str(p.type) === '6' || rows(p.components).some(c => active(c) && str(object(c.frontend_component).name) === 'order_tracking')) },
                navigation: ordered(header?.menu_items).filter(active).flatMap(item => menuLinks(item)),
                footer: { copyright: Number(footer?.copyright_status) === 1 ? str(footer?.copyright_content) : '', tagline, ...(storeDescription ? { storeDescription } : {}), ...(Object.values(siteSettings.contactInfo).some(Boolean) ? { showContactInfo: true } : {}), columns, ...(footerSocials.length ? { socials: footerSocials } : {}) }, pages,
            } })
        }
    }
    return { entries: parseBatchInput(entries), reports }
}
