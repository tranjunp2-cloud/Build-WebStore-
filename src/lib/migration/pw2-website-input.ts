import { z } from 'zod'
import { ContractSchema } from './pw1-contract'
const Id = z.string().regex(/^\d+$/)
const Url = z.string().refine(v => /^https?:\/\/[^\s]+$/i.test(v), 'Expected HTTP(S) URL')
const Link = z.object({ label: z.string(), pageId: Id.optional(), url: z.string().optional() }).strict().refine(v => Boolean(v.pageId) !== Boolean(v.url), 'Use pageId or url')
const Config = z.object({ size: z.enum(['hero','small']).optional(), autoplay: z.boolean().optional(), intervalMs: z.number().min(1000).max(30000).optional(), paddingY: z.number().min(0).max(240).optional(), limit: z.number().int().min(1).max(20).optional(), showCategoryFilter: z.boolean().optional(), criteria: z.record(z.union([z.number(),z.boolean()])).optional(), sourceSettings: z.record(z.unknown()).optional() }).strict()
const Component = z.object({ sourceId: Id, type: z.enum(['banner','rich_text','category_listing','product_listing','article_listing','product_filter','product_sort','article_filter','article_sort']), enabled: z.boolean().default(true), content: z.record(z.unknown()), config: Config.default({}), binding: z.object({ source: z.literal('pw2.database'), collection: z.enum(['products','blogs']), scope: z.enum(['site','tenant']), emptyBehavior: z.literal('native-empty-state') }).strict().optional(), mappingStatus: z.literal('pending').optional() }).strict()
export const WebsiteInputSchema = z.object({ format: z.literal('pw2-website-input'), version: z.literal('1.0.0'), source: z.object({ storeId: Id, websiteUrl: Url, capturedAt: z.string().optional() }).strict(), website: z.object({ name: z.string().min(1), locale: z.literal('en'), branding: z.object({ logoUrl: Url }).strict(), features: z.object({ cart: z.boolean(), orderTracking: z.boolean() }).strict().optional(), navigation: z.array(Link), footer: z.object({ copyright: z.string(), tagline: z.string().optional(), columns: z.array(z.object({ title: z.string(), links: z.array(Link) }).strict()) }).strict() }).strict(), pages: z.array(z.object({ sourceId: Id, title: z.string().min(1), path: z.string().regex(/^\/(?:[a-z0-9-]+)?$/), components: z.array(Component) }).strict()).min(1) }).strict()
const Slide = z.object({ imageUrl: Url, alt: z.string().default(''), heading: z.string().default(''), description: z.string().default(''), cta: z.object({ label: z.string(), url: z.string() }).nullable().optional() }).strict()
const Categories = z.object({ heading: z.string(), items: z.array(z.object({ sourceId: Id, title: z.string(), imageUrl: Url, alt: z.string().optional(), url: Url, ctaLabel: z.string().optional() }).strict()) }).strict()
/** Adapt the compact public contract only; never read a previous export or live DB. */
export function adaptWebsiteInput(input: unknown) {
    const data = WebsiteInputSchema.parse(input)
    const ids = new Set<string>(), paths = new Set<string>(), componentIds = new Set<string>()
    for (const page of data.pages) {
        if (ids.has(page.sourceId) || paths.has(page.path)) throw new Error('Duplicate page identity/path')
        ids.add(page.sourceId); paths.add(page.path)
        for (const component of page.components) {
            if (componentIds.has(component.sourceId)) throw new Error('Duplicate component identity')
            componentIds.add(component.sourceId)
        }
    }
    if (!paths.has('/')) throw new Error('Homepage is required')
    const link = (value: z.infer<typeof Link>) => {
        const url = value.pageId ? data.pages.find(p => p.sourceId === value.pageId)?.path : value.url
        if (!url || !/^(https?:\/\/|\/(?!\/)|#)/.test(url)) throw new Error('Invalid navigation target')
        return { label: value.label, url }
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
    const warnings: string[] = []
    const pages = data.pages.map(page => ({ sourceId: page.sourceId, title: page.title, slug: page.path === '/' ? 'home' : page.path.slice(1), isHomepage: page.path === '/', components: page.components.flatMap((component, index) => {
        if (!component.enabled) { excluded.push(component.sourceId); return [] }
        if (component.type.endsWith('_filter') || component.type.endsWith('_sort')) {
            pending.push({ pageId: page.sourceId, sourceId: component.sourceId, type: component.type, config: component.config, reason: 'Separate filter/sort control mapping is pending; no synthetic control emitted.' }); return []
        }
        let block: Record<string, unknown>
        if (component.type === 'banner') {
            const content = z.object({ slides: z.array(Slide).min(1) }).strict().parse(component.content)
            block = { blockType: 'hero', headline: '', slides: content.slides.map(s => ({ headline: s.heading, subheadline: s.description, image: { url: s.imageUrl, alt: s.alt }, ctaButtons: s.cta ? [s.cta] : [] })), sourceLayout: { sourceComponentId: component.sourceId, size: component.config.size ?? 'hero', autoplay: component.config.autoplay ?? false, interval: component.config.intervalMs ?? 5000 } }
        } else if (component.type === 'rich_text') {
            const content = z.object({ html: z.string() }).strict().parse(component.content)
            block = { blockType: 'rich-text', ...content, paddingY: component.config.paddingY ?? 64 }
        } else if (component.type === 'category_listing') {
            const content = Categories.parse(component.content)
            block = { blockType: 'content-cards', variant: 'categories', headline: content.heading, sourceContent: { capturedAt: data.source.capturedAt ?? '', bindingStatus: 'captured-public-content', items: content.items.map(i => ({ sourceId: i.sourceId, title: i.title, image: { url: i.imageUrl, alt: i.alt ?? i.title }, url: i.url, ctaLabel: i.ctaLabel })) } }
        } else {
            const content = z.object({ heading: z.string() }).strict().parse(component.content)
            const product = component.type === 'product_listing'
            if (component.binding?.collection !== (product ? 'products' : 'blogs') || component.binding.scope !== (product ? 'site' : 'tenant')) throw new Error('Invalid database binding for listing')
            block = { blockType: 'content-cards', headline: content.heading, limit: component.config.limit ?? (product ? 12 : 3), showCategoryFilter: component.config.showCategoryFilter ?? false }
            if (component.config.sourceSettings) warnings.push(`${component.sourceId}: sourceSettings retained in adapter report only; source IDs, selection and sort semantics are not mapped to PW2 database queries.`)
        }
        return [{ sourceId: component.sourceId, position: index, kind: component.type, block }]
    }) }))
    const contract = ContractSchema.parse({ format: 'pw2-reconstruction-contract', version: '1.0.0', source: { storeId: data.source.storeId, url: data.source.websiteUrl, capturedAt: data.source.capturedAt ?? '', dumpHash: '' }, site: { name: data.website.name, features, navigation: { blockType: 'navigation', logoText: data.website.name, logo: { url: data.website.branding.logoUrl, alt: data.website.name }, links: navigation }, footer: { blockType: 'footer', logoText: data.website.name, copyrightText: data.website.footer.copyright, tagline: data.website.footer.tagline, columns: data.website.footer.columns.map(c => ({ title: c.title, links: c.links.map(link) })) } }, pages, reconciliation: [...warnings, ...pending.map(p => `${p.sourceId}: ${p.reason}`), ...excluded.map(id => `${id}: disabled component excluded`)] })
    return { contract, report: { inputFormat: data.format, locale: data.website.locale, sourceComponents: data.pages.reduce((sum,p) => sum+p.components.length,0), mappedComponents: pages.reduce((sum,p) => sum+p.components.length,0), pending, excluded, warnings, sourceConfigs: data.pages.flatMap(p=>p.components.map(c=>({ pageId:p.sourceId, sourceId:c.sourceId, config:c.config }))) } }
}
