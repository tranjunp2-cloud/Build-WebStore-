import { PW1_EMPTY_CTA_URL } from '@/lib/navigation-url'
import { WebsiteCategoryMappingsSchema, resolveWebsiteCategoryMappings } from './pw1-website-category-mapping'
import { mapPageFilters, type FilterMapping } from './pw1-filter-mapping'
import { getSiteSocialWidgetLinks } from '@/lib/site-settings'
import { SourceProductSelectionSchema } from './pw1-product-selection'
import type { VerifiedCategoryMapping } from './pw1-destination'
import { SourceOriginsSchema, isSourceHost, normalizeSourcePath, type SourceLinkFinding, LinkCorrectionsSchema, createSourceLinkResolver, rewriteSourceHtmlLinks } from './pw1-links'
import { SiteSettingsSchema } from './pw1-site-settings'
import { z } from 'zod'
import { ContractSchema } from './pw1-contract'
const Id = z.string().regex(/^\d+$/)
const Url = z.string().refine(v => /^https?:\/\/[^\s]+$/i.test(v), 'Expected HTTP(S) URL')
type ResolvedLink = { label: string; url: string; imageUrl?: string; children?: ResolvedLink[] }
type InputLink = { label: string; pageId?: string; url?: string; imageUrl?: string; children?: InputLink[] }
const Link: z.ZodType<InputLink> = z.lazy(() => z.object({ label: z.string(), pageId: Id.optional(), url: z.string().optional(), imageUrl: Url.optional(), children: z.array(Link).optional() }).strict().refine(v => Boolean(v.pageId) !== Boolean(v.url), 'Use pageId or url'))
const Config = z.object({ productSelection: SourceProductSelectionSchema.optional(), aspectRatio: z.number().min(0.2).max(10).optional(), imageFit: z.enum(['cover','contain','scale-down']).optional(), slidesPerView: z.number().int().min(1).max(6).optional(), size: z.enum(['hero','small']).optional(), autoplay: z.boolean().optional(), intervalMs: z.number().min(1000).max(30000).optional(), paddingY: z.number().min(0).max(240).optional(), limit: z.number().int().min(1).max(20).optional(), showCategoryFilter: z.boolean().optional(), criteria: z.record(z.union([z.number(),z.boolean()])).optional(), sourceSettings: z.record(z.unknown()).optional() }).strict()
const Component = z.object({ sourceId: Id, type: z.enum(['banner','rich_text','category_listing','product_listing','article_listing','product_filter','product_sort','article_filter','article_sort']), enabled: z.boolean().default(true), content: z.record(z.unknown()), config: Config.default({}), binding: z.object({ source: z.literal('pw2.database'), collection: z.enum(['products','blogs']), scope: z.enum(['site','tenant']), emptyBehavior: z.literal('native-empty-state') }).strict().optional(), mappingStatus: z.literal('pending').optional() }).strict()
export const WebsiteInputSchema = z.object({ categoryMappings: WebsiteCategoryMappingsSchema, linkCorrections: LinkCorrectionsSchema.optional(), format: z.literal('pw2-website-input'), version: z.literal('1.0.0'), source: z.object({ storeId: Id, websiteUrl: Url, origins: SourceOriginsSchema, capturedAt: z.string().optional() }).strict(), website: z.object({ publication: z.literal('keep-draft').optional(), settings: SiteSettingsSchema.optional(), name: z.string().min(1), locale: z.enum(['en', 'ms']), branding: z.object({ logoUrl: z.string().url().refine(v => /^https?:\/\//i.test(v)).optional().catch(undefined) }).strict(), features: z.object({ cart: z.boolean(), orderTracking: z.boolean() }).strict().optional(), navigation: z.array(Link), footer: z.object({ socials: z.array(z.object({ platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']), url: Url }).strict()).optional(), copyright: z.string(), tagline: z.string().optional(), storeDescription: z.string().optional(), showContactInfo: z.boolean().optional(), columns: z.array(z.object({ title: z.string(), text: z.string().optional(), links: z.array(Link) }).strict()) }).strict() }).strict(), pages: z.array(z.object({ sourceId: Id, title: z.string().min(1), aliases: z.array(z.string().regex(/^\/(?!\/)[^?#]*$/)).optional(), path: z.string().regex(/^\/(?!\/)[^?#\\\r\n]*$/), components: z.array(Component) }).strict()).min(1) }).strict()
const Slide = z.object({ imageUrl: Url, alt: z.string().default(''), heading: z.string().default(''), description: z.string().default(''), cta: z.object({ label: z.string(), url: z.string() }).nullable().optional() }).strict()
const Categories = z.object({ heading: z.string(), items: z.array(z.object({ sourceId: Id, title: z.string(), imageUrl: Url, alt: z.string().optional(), url: Url.optional(), pageId: Id.optional(), ctaLabel: z.string().optional() }).strict()) }).strict()
/** Normalize routing only; content and source identity remain untouched. */
export function pw1PageSlug(path: string, sourceId: string) {
    let decoded = path
    try { decoded = decodeURIComponent(path) } catch { /* Malformed legacy escapes become separators below. */ }
    const slug = decoded.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
        .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    return slug || `page-pw1-${sourceId}`
}
/** Adapt the compact public contract only; never read a previous export or live DB. */
export function adaptWebsiteInput(input: unknown, verifiedCategories: VerifiedCategoryMapping[] = [], brokenSourceUrls: readonly string[] = []) {
    const data = WebsiteInputSchema.parse(input)
    const ids = new Set<string>(), paths = new Set<string>(), componentIds = new Set<string>()
    for (const page of data.pages) {
        if (ids.has(page.sourceId)) throw new Error('Duplicate page identity')
        ids.add(page.sourceId); paths.add(page.path)
        for (const component of page.components) {
            if (componentIds.has(component.sourceId)) throw new Error('Duplicate component identity')
            componentIds.add(component.sourceId)
        }
    }
    if (!paths.has('/')) throw new Error('Homepage is required')
    // Preserve every source identity while satisfying PW2's per-site slug index.
    const reserved = new Set([...data.pages.map(p => p.path === '/' ? 'home' : pw1PageSlug(p.path, p.sourceId)), '404'])
    const used = new Set<string>(['404'])
    const homepageId = data.pages.find(p => p.path === '/')!.sourceId
    const pageRoutes = new Map<string, { slug: string; path: string; isHomepage: boolean }>()
    const routeChanges: Array<{ sourceId: string; sourcePath: string; destinationPath: string }> = []
    // Reserve homepage's internal slug even if a /home page precedes it.
    used.add('home')
    for (const page of data.pages) {
        const isHomepage = page.sourceId === homepageId
        const base = page.path === '/' ? 'home' : pw1PageSlug(page.path, page.sourceId)
        let slug = base
        if (!isHomepage && used.has(slug)) {
            slug = `${base}-pw1-${page.sourceId}`
            let suffix = 2
            while (used.has(slug) || reserved.has(slug)) slug = `${base}-pw1-${page.sourceId}-${suffix++}`
        }
        used.add(slug)
        const path = isHomepage ? '/' : `/${slug}`
        pageRoutes.set(page.sourceId, {slug, path, isHomepage})
        if (path !== page.path) routeChanges.push({sourceId:page.sourceId, sourcePath:page.path, destinationPath:path})
    }
    const categoryMappings = resolveWebsiteCategoryMappings(data.categoryMappings, verifiedCategories)
    const categoryLinks = verifiedCategories.map(category => {
        const page = data.pages.find(p => p.sourceId === category.listingPageId)
        if (!page?.components.some(c => c.enabled && c.type === 'product_listing')) throw new Error('Mapped category target must contain a product listing')
        return { ...category, destinationPath: pageRoutes.get(category.listingPageId)!.path }
    })
    const linkWarnings: string[] = []
    const linkFindings: SourceLinkFinding[] = []
    const resolveSourceLink = createSourceLinkResolver(data.source.websiteUrl, [...data.pages.map(page => ({ sourcePath: page.path, destinationPath: pageRoutes.get(page.sourceId)!.path })), { sourcePath: '/checkout', destinationPath: '/checkout' }], linkWarnings, categoryLinks, (data.linkCorrections ?? []).map(correction => {
        const route = pageRoutes.get(correction.pageId)
        if (!route) throw new Error(`Reviewed link correction targets missing page ${correction.pageId}`)
        linkWarnings.push(`Reviewed source link correction: ${correction.from} -> ${route.path} (${correction.reason})`)
        return { from: correction.from, destinationPath: route.path }
    }), { unavailableCategories: categoryMappings.filter(row => row.status === 'unavailable'), brokenUrls: brokenSourceUrls, findings: linkFindings, sourceOrigins: data.source.origins, aliases: data.pages.flatMap(page => (page.aliases ?? []).map(sourcePath => ({sourcePath, destinationPath: pageRoutes.get(page.sourceId)!.path}))) })
    const link = (value: InputLink, location = 'navigation'): ResolvedLink => {
        const url = value.pageId ? pageRoutes.get(value.pageId)?.path : value.url ? resolveSourceLink(value.url, location) : undefined
        if (url === '') return { label: value.label, url: '' }
        if (!url || !/^(https?:\/\/|\/(?!\/)|#|(mailto|tel|sms|whatsapp):\S)/i.test(url)) throw new Error('Invalid navigation target')
        return { label: value.label, url, ...(value.imageUrl ? {imageUrl:value.imageUrl} : {}), ...(value.children?.length ? { children: value.children.flatMap(child => menuLink(child, location)) } : {}) }
    }
    const menuLink = (value: InputLink, location: string): ResolvedLink[] => {
        const resolved = link(value, `${location}/${value.label}`)
        return resolved.url ? [resolved] : (value.children ?? []).flatMap(child => menuLink(child, location))
    }
    // Recognize only same-origin legacy system routes; external links stay ordinary links.
    const systemFeature = (value: z.infer<typeof Link>) => {
        if (!value.url) return undefined
        try {
            const url = new URL(value.url, data.source.websiteUrl)
            if (!isSourceHost(url, data.source.websiteUrl, data.source.origins)) return undefined
            const path = normalizeSourcePath(url.pathname)
            return path === '/cart' ? 'cart' : path === '/order-tracking' ? 'orderTracking' : undefined
        } catch { return undefined }
    }
    const legacyFeatures = data.website.navigation.map(systemFeature)
    const features = data.website.features ?? {
        cart: legacyFeatures.includes('cart') || legacyFeatures.includes('orderTracking'), orderTracking: legacyFeatures.includes('orderTracking'),
    }
    // PW2 order lookup is enabled by the native cart system.
    if (features.orderTracking && !features.cart) throw new Error('PW2 order tracking requires cart to be enabled')
    const navigation = data.website.navigation.filter(value => !systemFeature(value)).flatMap(value => menuLink(value, 'navigation'))
    const pending: Array<{ pageId: string; sourceId: string; type: string; config: unknown; reason: string }> = []
    const filterMappings: FilterMapping[] = data.pages.flatMap(page => mapPageFilters(page).mappings)
    const excluded: string[] = []
    const warnings: string[] = routeChanges.map(p => `Store ${data.source.storeId}: page ${p.sourceId} URL normalized to ${p.destinationPath} (source URL ${p.sourcePath}); source content retained`)
    for (const path of paths) {
        const matches = data.pages.filter(page => page.path === path)
        if (matches.length > 1) warnings.push(`Store ${data.source.storeId}: URL ${path} is shared by source pages ${matches.map(page => page.sourceId).join(', ')}; all pages retained`)
    }
    const pages = data.pages.map(page => ({ sourceId: page.sourceId, title: page.title, slug: pageRoutes.get(page.sourceId)!.slug, isHomepage: pageRoutes.get(page.sourceId)!.isHomepage, components: page.components.flatMap((component, index) => {
        if (!component.enabled) { excluded.push(component.sourceId); return [] }
        if (component.type.endsWith('_filter') || component.type.endsWith('_sort')) {
            const mapping = filterMappings.find(item => item.pageId === page.sourceId && item.sourceId === component.sourceId)!
            if (mapping.status === 'unsupported' || mapping.status === 'invalid-data') pending.push({ pageId: page.sourceId, sourceId: component.sourceId, type: component.type, config: component.config, reason: mapping.reason })
            return []
        }
        let block: Record<string, unknown>
        if (component.type === 'banner') {
            const content = z.object({ slides: z.array(Slide).min(1) }).strict().parse(component.content)
            block = { blockType: 'hero', headline: '', slides: content.slides.map((s, slideIndex) => { const url = s.cta?.url ? resolveSourceLink(s.cta.url, `page:${page.sourceId}/component:${component.sourceId}/slide:${slideIndex}`) : undefined; return { headline: s.heading, subheadline: s.cta?.url && url === '' ? [s.description, s.cta.label].filter(Boolean).join('\n') : s.description, image: { url: s.imageUrl, alt: s.alt }, ctaButtons: s.cta && (url || s.cta.url === '') ? [{ ...s.cta, url: url ?? PW1_EMPTY_CTA_URL }] : [] } }), sourceLayout: { ...(component.config.aspectRatio ? { aspectRatio: component.config.aspectRatio } : {}), ...(component.config.imageFit ? { imageFit: component.config.imageFit } : {}), ...(component.config.slidesPerView ? { slidesPerView: component.config.slidesPerView } : {}), sourceComponentId: component.sourceId, size: component.config.size ?? 'hero', autoplay: component.config.autoplay ?? false, interval: component.config.intervalMs ?? 5000 } }
        } else if (component.type === 'rich_text') {
            const content = z.object({ html: z.string() }).strict().parse(component.content)
            block = { blockType: 'rich-text', html: rewriteSourceHtmlLinks(content.html, url => resolveSourceLink(url, `page:${page.sourceId}/component:${component.sourceId}/html`)), paddingY: component.config.paddingY ?? 64 }
        } else if (component.type === 'category_listing') {
            const content = Categories.parse(component.content)
            block = { blockType: 'content-cards', variant: 'categories', headline: content.heading, sourceContent: { capturedAt: data.source.capturedAt ?? '', bindingStatus: 'captured-public-content', items: content.items.map(i => ({ sourceId: i.sourceId, title: i.title, image: { url: i.imageUrl, alt: i.alt ?? i.title }, url: i.pageId ? link({ label: i.ctaLabel ?? i.title, pageId: i.pageId }).url : i.url ? resolveSourceLink(i.url, `page:${page.sourceId}/component:${component.sourceId}/item:${i.sourceId}`) || undefined : undefined, ctaLabel: i.ctaLabel })) } }
        } else {
            const content = z.object({ heading: z.string() }).strict().parse(component.content)
            const product = component.type === 'product_listing'
            if (component.binding?.collection !== (product ? 'products' : 'blogs') || component.binding.scope !== (product ? 'site' : 'tenant')) throw new Error('Invalid database binding for listing')
            block = { ...(product && component.config.productSelection ? { sourceProductSelection: component.config.productSelection } : {}), blockType: 'content-cards', headline: content.heading, limit: component.config.limit ?? (product ? 12 : 3), showCategoryFilter: product && verifiedCategories.some(c => c.listingPageId === page.sourceId) ? true : component.config.showCategoryFilter ?? false }
            const filters = mapPageFilters(page)
            if (product && filters.product) { block.filterControls = filters.product; block.showCategoryFilter = Object.values(filters.product).some(Boolean) }
            if (!product && filters.articleCategory !== undefined) block.showCategoryFilter = filters.articleCategory && filters.mappings.some(m => m.type === 'article_filter' && m.targetIds.includes(component.sourceId))
            if (component.config.sourceSettings) warnings.push(`${component.sourceId}: sourceSettings retained in adapter report only; legacy sorting is not mapped; product selections are resolved through verified BE mappings before generation.`)
        }
        return [{ sourceId: component.sourceId, position: index, kind: component.type, block }]
    }) }))
    const footerColumns = data.website.footer.columns.map(c => ({ title: c.title, ...(c.text ? {text:c.text} : {}), links: c.links.flatMap(value => menuLink(value, `footer/${c.title}`)) }))
    warnings.push(...linkWarnings)
    const contract = ContractSchema.parse({ format: 'pw2-reconstruction-contract', version: '1.0.0', source: { storeId: data.source.storeId, url: data.source.websiteUrl, capturedAt: data.source.capturedAt ?? '', dumpHash: '' }, site: { publication: data.website.publication, settings: data.website.settings, name: data.website.name, locale: data.website.locale, features, navigation: { blockType: 'navigation', logoText: data.website.name, ...(data.website.branding.logoUrl ? { logo: { url: data.website.branding.logoUrl, alt: data.website.name } } : {}), links: navigation }, footer: { blockType: 'footer', logoText: data.website.name, ...(data.website.branding.logoUrl ? { logo: { url: data.website.branding.logoUrl, alt: data.website.name } } : {}), socials: data.website.footer.socials ?? getSiteSocialWidgetLinks(data.website.settings?.socialLinks).map(({ platform, url }) => ({ platform, url })), copyrightText: data.website.footer.copyright, tagline: data.website.footer.tagline, ...(data.website.footer.storeDescription ? { storeDescription: data.website.footer.storeDescription } : {}), ...(data.website.footer.showContactInfo ? { showContactInfo: true } : {}), columns: footerColumns } }, pages, reconciliation: [...warnings, ...pending.map(p => `${p.sourceId}: ${p.reason}`), ...excluded.map(id => `${id}: disabled component excluded`)] })
    return { contract, report: { categoryMappings, inputFormat: data.format, locale: data.website.locale, sourceComponents: data.pages.reduce((sum,p) => sum+p.components.length,0), mappedComponents: pages.reduce((sum,p) => sum+p.components.length,0), pending, filterMappings, excluded, warnings, linkFindings, routeChanges, sourceConfigs: data.pages.flatMap(p=>p.components.map(c=>({ pageId:p.sourceId, sourceId:c.sourceId, config:c.config }))) } }
}
