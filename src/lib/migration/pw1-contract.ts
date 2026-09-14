import { SiteSettingsSchema } from './pw1-site-settings'
import { z } from 'zod'

const ComponentSchema = z.object({
    sourceId: z.string().regex(/^\d+$/), position: z.number().int().min(0),
    kind: z.enum(['banner', 'rich_text', 'category_listing', 'article_listing', 'product_listing']),
    block: z.record(z.unknown()),
}).strict()
export const ContractSchema = z.object({
    format: z.literal('pw2-reconstruction-contract'), version: z.literal('1.0.0'),
    source: z.object({ url: z.string().url(), storeId: z.string().regex(/^\d+$/), capturedAt: z.string(), dumpHash: z.string() }).strict(),
    site: z.object({ settings: SiteSettingsSchema.optional(), name: z.string(), locale: z.enum(['en', 'ms']).optional(), features: z.object({ cart: z.boolean(), orderTracking: z.boolean() }).strict().optional(), navigation: z.record(z.unknown()), footer: z.record(z.unknown()) }).strict(),
    pages: z.array(z.object({ sourceId: z.string().regex(/^\d+$/), title: z.string(), slug: z.string().regex(/^[a-z0-9-]+$/), isHomepage: z.boolean(), components: z.array(ComponentSchema) }).strict()).min(1),
    reconciliation: z.array(z.string()),
}).strict()

/** Internal source contract for the native generator; never a pre-generated website. */
export interface WebsiteBlueprint {
    nativeContract: z.infer<typeof ContractSchema>
    storeId: string
    siteName: string
    description: string
    pages: Array<{ sourceId: string; title: string; slug: string; isHomepage: boolean; kind: 'content' }>
}

export function createNativeBlueprint(input: unknown): WebsiteBlueprint {
    const contract = ContractSchema.parse(input)
    if (contract.pages.filter(page => page.isHomepage).length !== 1) throw new Error('Exactly one homepage is required')
    const slugs = new Set<string>(), pageIds = new Set<string>(), componentIds = new Set<string>()
    for (const page of contract.pages) {
        if (slugs.has(page.slug) || pageIds.has(page.sourceId)) throw new Error('Duplicate source page')
        slugs.add(page.slug); pageIds.add(page.sourceId)
        let previous = -1
        for (const component of page.components) {
            if (componentIds.has(component.sourceId) || component.position <= previous) throw new Error('Duplicate component or invalid source order')
            componentIds.add(component.sourceId); previous = component.position
        }
    }
    return {
        nativeContract: contract, storeId: contract.source.storeId,
        siteName: contract.site.name, description: 'Website generated from PW1 source components using native PW2 blocks',
        pages: contract.pages.map(page => ({ sourceId: page.sourceId, title: page.title, slug: page.slug, isHomepage: page.isHomepage, kind: 'content' })),
    }
}
