import type { MigrationDestination } from './pw1-destination'
import { LinkCorrectionsSchema, createSourceLinkResolver, rewriteSourceHtmlLinks } from './pw1-links'
import { SiteSettingsSchema } from './pw1-site-settings'
import { z } from 'zod'
import { ContractSchema } from './pw1-contract'
const Id = z.string().regex(/^\d+$/)
const Url = z.string().refine(v => /^https?:\/\/[^\s]+$/i.test(v), 'Expected HTTP(S) URL')
type ResolvedLink = { label: string; url: string; children?: ResolvedLink[] }
type InputLink = { label: string; pageId?: string; url?: string; children?: InputLink[] }
const Link: z.ZodType<InputLink> = z.lazy(() => z.object({ label: z.string(), pageId: Id.optional(), url: z.string().optional(), children: z.array(Link).optional() }).strict().refine(v => Boolean(v.pageId) !== Boolean(v.url), 'Use pageId or url'))
const Config = z.object({ aspectRatio: z.number().min(0.2).max(10).optional(), imageFit: z.enum(['cover','contain','scale-down']).optional(), slidesPerView: z.number().int().min(1).max(6).optional(), size: z.enum(['hero','small']).optional(), autoplay: z.boolean().optional(), intervalMs: z.number().min(1000).max(30000).optional(), paddingY: z.number().min(0).max(240).optional(), limit: z.number().int().min(1).max(20).optional(), showCategoryFilter: z.boolean().optional(), criteria: z.record(z.union([z.number(),z.boolean()])).optional(), sourceSettings: z.record(z.unknown()).optional() }).strict()
const Component = z.object({ sourceId: Id, type: z.enum(['banner','rich_text','category_listing','product_listing','article_listing','product_filter','product_sort','article_filter','article_sort']), enabled: z.boolean().default(true), content: z.record(z.unknown()), config: Config.default({}), binding: z.object({ source: z.literal('pw2.database'), collection: z.enum(['products','blogs']), scope: z.enum(['site','tenant']), emptyBehavior: z.literal('native-empty-state') }).strict().optional(), mappingStatus: z.literal('pending').optional() }).strict()
export const WebsiteInputSchema = z.object({ linkCorrections: LinkCorrectionsSchema.optional(), format: z.literal('pw2-website-input'), version: z.literal('1.0.0'), source: z.object({ storeId: Id, websiteUrl: Url, capturedAt: z.string().optional() }).strict(), website: z.object({ settings: SiteSettingsSchema.optional(), name: z.string().min(1), locale: z.enum(['en', 'ms']), branding: z.object({ logoUrl: Url }).strict(), features: z.object({ cart: z.boolean(), orderTracking: z.boolean() }).strict().optional(), navigation: z.array(Link), footer: z.object({ copyright: z.string(), tagline: z.string().optional(), columns: z.array(z.object({ title: z.string(), links: z.array(Link) }).strict()) }).strict() }).strict(), pages: z.array(z.object({ sourceId: Id, title: z.string().min(1), path: z.string().regex(/^\/(?:[a-z0-9-]+)?$/), components: z.array(Component) }).strict()).min(1) }).strict()
const Slide = z.object({ imageUrl: Url, alt: z.string().default(''), heading: z.string().default(''), description: z.string().default(''), cta: z.object({ label: z.string(), url: z.string() }).nullable().optional() }).strict()
const Categories = z.object({ heading: z.string(), items: z.array(z.object({ sourceId: Id, title: z.string(), imageUrl: Url, alt: z.string().optional(), url: Url.optional(), pageId: Id.optional(), ctaLabel: z.string().optional() }).strict()) }).strict()
/** Adapt the compact public contract only; never read a previous export or live DB. */
export function adaptWebsiteInput(input: unknown, verifiedCategories: MigrationDestination['productCategories'] = []) {
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
    const reserved = new Set([...data.pages.map(p => p.path === '/' ? 'home' : p.path.slice(1)), '404'])
    const used = new Set<string>(['404'])
    const homepageId = data.pages.find(p => p.path === '/')!.sourceId
    const pageRoutes = new Map<string, { slug: string; path: string; isHomepage: boolean }>()
    const routeChanges: Array<{ sourceId: string; sourcePath: string; destinationPath: string }> = []
    // Reserve homepage's internal slug even if a /home page precedes it.
    used.add('home')
    for (const page of data.pages) {
        const isHomepage = page.sourceId === homepageId
        const base = page.path === '/' ? 'home' : page.path.slice(1)
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
    const categoryLinks = verifiedCategories.map(category => {
        const page = data.pages.find(p => p.sourceId === category.listingPageId)
        if (!page?.components.some(c => c.enabled && c.type === 'product_listing')) throw new Error('Mapped category target must contain a product listing')
        return { ...category, destinationPath: pageRoutes.get(category.listingPageId)!.path }
    })
    const linkWarnings: string[] = []
    const resolveSourceLink = createSourceLinkResolver(data.source.websiteUrl, [...data.pages.map(page => ({ sourcePath: page.path, destinationPath: pageRoutes.get(page.sourceId)!.path })), { sourcePath: '/checkout', destinationPath: '/checkout' }], linkWarnings, categoryLinks, (data.linkCorrections ?? []).map(correction => {
        const route = pageRoutes.get(correction.pageId)
        if (!route) throw new Error(`Reviewed link correction targets missing page ${correction.pageId}`)
        linkWarnings.push(`Reviewed source link correction: ${correction.from} -> ${route.path} (${correction.reason})`)
        return { from: correction.from, destinationPath: route.path }
    }))
    const link = (value: InputLink): ResolvedLink => {
        const url = value.pageId ? pageRoutes.get(value.pageId)?.path : value.url ? resolveSourceLink(value.url) : undefined
        if (!url || !/^(https?:\/\/|\/(?!\/)|#)/.test(url)) throw new Error('Invalid navigation target')
        return { label: value.label, url, ...(value.children?.length ? { children: value.children.map(link) } : {}) }
    }
    // Recognize only same-origin legacy system routes; external links stay ordinary links.
    const systemFeature = (value: z.infer<typeof Link>) => {
        if (!value.url) return undefined
        try {
            const url = new URL(value.url, data.source.websiteUrl)
            if (url.origin !== new URL(data.source.websiteUrl).origin) return undefined
            const path = url.pathname.replace(/\/$/, '')
            return path === '/cart' ? 'cart' : path === '/order-tracking' ? 'orderTracking' : undefined
        } catch { return undefined }
    }
    const legacyFeatures = data.website.navigation.map(systemFeature)
    const features = data.website.features ?? {
        cart: legacyFeatures.includes('cart') || legacyFeatures.includes('orderTracking'), orderTracking: legacyFeatures.includes('orderTracking'),
    }
    // PW2 order lookup is enabled by the native cart system.
    if (features.orderTracking && !features.cart) throw new Error('PW2 order tracking requires cart to be enabled')
    const navigation = data.website.navigation.filter(value => !systemFeature(value)).map(link)
    const pending: Array<{ pageId: string; sourceId: string; type: string; config: unknown; reason: string }> = []
    const excluded: string[] = []
    const warnings: string[] = routeChanges.map(p => `Store ${data.source.storeId}: page ${p.sourceId} retained at temporary URL ${p.destinationPath} (source URL ${p.sourcePath}); review duplicate page after migration`)
    for (const path of paths) {
        const matches = data.pages.filter(page => page.path === path)
        if (matches.length > 1) warnings.push(`Store ${data.source.storeId}: URL ${path} is shared by source pages ${matches.map(page => page.sourceId).join(', ')}; all pages retained`)
    }
    const pages = data.pages.map(page => ({ sourceId: page.sourceId, title: page.title, slug: pageRoutes.get(page.sourceId)!.slug, isHomepage: pageRoutes.get(page.sourceId)!.isHomepage, components: page.components.flatMap((component, index) => {
        if (!component.enabled) { excluded.push(component.sourceId); return [] }
        if (component.type.endsWith('_filter') || component.type.endsWith('_sort')) {
            pending.push({ pageId: page.sourceId, sourceId: component.sourceId, type: component.type, config: component.config, reason: 'Separate filter/sort control mapping is pending; no synthetic control emitted.' }); return []
        }
        let block: Record<string, unknown>
        if (component.type === 'banner') {
            const content = z.object({ slides: z.array(Slide).min(1) }).strict().parse(component.content)
            block = { blockType: 'hero', headline: '', slides: content.slides.map(s => ({ headline: s.heading, subheadline: s.description, image: { url: s.imageUrl, alt: s.alt }, ctaButtons: s.cta ? [{ ...s.cta, url: resolveSourceLink(s.cta.url) }] : [] })), sourceLayout: { ...(component.config.aspectRatio ? { aspectRatio: component.config.aspectRatio } : {}), ...(component.config.imageFit ? { imageFit: component.config.imageFit } : {}), ...(component.config.slidesPerView ? { slidesPerView: component.config.slidesPerView } : {}), sourceComponentId: component.sourceId, size: component.config.size ?? 'hero', autoplay: component.config.autoplay ?? false, interval: component.config.intervalMs ?? 5000 } }
        } else if (component.type === 'rich_text') {
            const content = z.object({ html: z.string() }).strict().parse(component.content)
            block = { blockType: 'rich-text', html: rewriteSourceHtmlLinks(content.html, resolveSourceLink), paddingY: component.config.paddingY ?? 64 }
        } else if (component.type === 'category_listing') {
            const content = Categories.parse(component.content)
            block = { blockType: 'content-cards', variant: 'categories', headline: content.heading, sourceContent: { capturedAt: data.source.capturedAt ?? '', bindingStatus: 'captured-public-content', items: content.items.map(i => ({ sourceId: i.sourceId, title: i.title, image: { url: i.imageUrl, alt: i.alt ?? i.title }, url: i.pageId ? link({ label: i.ctaLabel ?? i.title, pageId: i.pageId }).url : i.url ? resolveSourceLink(i.url) : undefined, ctaLabel: i.ctaLabel })) } }
        } else {
            const content = z.object({ heading: z.string() }).strict().parse(component.content)
            const product = component.type === 'product_listing'
            if (component.binding?.collection !== (product ? 'products' : 'blogs') || component.binding.scope !== (product ? 'site' : 'tenant')) throw new Error('Invalid database binding for listing')
            block = { blockType: 'content-cards', headline: content.heading, limit: component.config.limit ?? (product ? 12 : 3), showCategoryFilter: product && verifiedCategories.some(c => c.listingPageId === page.sourceId) ? true : component.config.showCategoryFilter ?? false }
            if (component.config.sourceSettings) warnings.push(`${component.sourceId}: sourceSettings retained in adapter report only; source IDs, selection and sort semantics are not mapped to PW2 database queries.`)
        }
        return [{ sourceId: component.sourceId, position: index, kind: component.type, block }]
    }) }))
    const footerColumns = data.website.footer.columns.map(c => ({ title: c.title, links: c.links.map(link) }))
    warnings.push(...linkWarnings)
    const contract = ContractSchema.parse({ format: 'pw2-reconstruction-contract', version: '1.0.0', source: { storeId: data.source.storeId, url: data.source.websiteUrl, capturedAt: data.source.capturedAt ?? '', dumpHash: '' }, site: { settings: data.website.settings, name: data.website.name, locale: data.website.locale, features, navigation: { blockType: 'navigation', logoText: data.website.name, logo: { url: data.website.branding.logoUrl, alt: data.website.name }, links: navigation }, footer: { blockType: 'footer', logoText: data.website.name, copyrightText: data.website.footer.copyright, tagline: data.website.footer.tagline, columns: footerColumns } }, pages, reconciliation: [...warnings, ...pending.map(p => `${p.sourceId}: ${p.reason}`), ...excluded.map(id => `${id}: disabled component excluded`)] })
    return { contract, report: { inputFormat: data.format, locale: data.website.locale, sourceComponents: data.pages.reduce((sum,p) => sum+p.components.length,0), mappedComponents: pages.reduce((sum,p) => sum+p.components.length,0), pending, excluded, warnings, routeChanges, sourceConfigs: data.pages.flatMap(p=>p.components.map(c=>({ pageId:p.sourceId, sourceId:c.sourceId, config:c.config }))) } }
}
