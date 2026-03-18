import type { BlockMeta, BlockType } from './types'
import type { ZodSchema } from 'zod'

// ── Block Components ─────────────────────────────────────────────────────────
import { NavigationBlock } from './navigation'
import { HeroBlock } from './hero'
import { FeaturesBlock } from './features'
import { AboutBlock } from './about'
import { TestimonialsBlock } from './testimonials'
import { FAQBlock } from './faq'
import { ContactBlock } from './contact'
import { GalleryBlock } from './gallery'
import { FooterBlock } from './footer'
import { PricingBlock } from './pricing'
import { CTABlock } from './cta'
import { StatsBlock } from './stats'
import { TeamBlock } from './team'
import { NewsletterBlock } from './newsletter'
import { VideoBlock } from './video'
import { LogoCloudBlock } from './logo-cloud'
import { BlogListBlock } from './blog-list'
import { ProductsGridBlock } from './products-grid'
import { ProductsFeaturedBlock } from './products-featured'
import { CustomHtmlBlock } from './custom-html'

// ── Block Configs (Schemas + Meta) ───────────────────────────────────────────
import { NavigationConfigSchema, navigationMeta } from './navigation/config'
import { HeroConfigSchema, heroMeta } from './hero/config'
import { FeaturesConfigSchema, featuresMeta } from './features/config'
import { AboutConfigSchema, aboutMeta } from './about/config'
import { TestimonialsConfigSchema, testimonialsMeta } from './testimonials/config'
import { FAQConfigSchema, faqMeta } from './faq/config'
import { ContactConfigSchema, contactMeta } from './contact/config'
import { GalleryConfigSchema, galleryMeta } from './gallery/config'
import { FooterConfigSchema, footerMeta } from './footer/config'
import { PricingConfigSchema, pricingMeta } from './pricing/config'
import { CTAConfigSchema, ctaMeta } from './cta/config'
import { StatsConfigSchema, statsMeta } from './stats/config'
import { TeamConfigSchema, teamMeta } from './team/config'
import { NewsletterConfigSchema, newsletterMeta } from './newsletter/config'
import { VideoConfigSchema, videoMeta } from './video/config'
import { LogoCloudConfigSchema, logoCloudMeta } from './logo-cloud/config'
import { BlogListConfigSchema, blogListMeta } from './blog-list/config'
import { ProductsGridConfigSchema, productsGridMeta } from './products-grid/config'
import { ProductsFeaturedConfigSchema, productsFeaturedMeta } from './products-featured/config'
import { CustomHtmlConfigSchema, customHtmlMeta } from './custom-html/config'

// ── Registry ─────────────────────────────────────────────────────────────────

type BlockRegistryEntry = {
    component: React.ComponentType<any>
    schema: ZodSchema
    meta: BlockMeta
}

const REGISTRY: Record<string, BlockRegistryEntry> = {
    navigation: { component: NavigationBlock, schema: NavigationConfigSchema, meta: navigationMeta },
    hero: { component: HeroBlock, schema: HeroConfigSchema, meta: heroMeta },
    features: { component: FeaturesBlock, schema: FeaturesConfigSchema, meta: featuresMeta },
    about: { component: AboutBlock, schema: AboutConfigSchema, meta: aboutMeta },
    testimonials: { component: TestimonialsBlock, schema: TestimonialsConfigSchema, meta: testimonialsMeta },
    faq: { component: FAQBlock, schema: FAQConfigSchema, meta: faqMeta },
    contact: { component: ContactBlock, schema: ContactConfigSchema, meta: contactMeta },
    gallery: { component: GalleryBlock, schema: GalleryConfigSchema, meta: galleryMeta },
    footer: { component: FooterBlock, schema: FooterConfigSchema, meta: footerMeta },
    pricing: { component: PricingBlock, schema: PricingConfigSchema, meta: pricingMeta },
    cta: { component: CTABlock, schema: CTAConfigSchema, meta: ctaMeta },
    stats: { component: StatsBlock, schema: StatsConfigSchema, meta: statsMeta },
    team: { component: TeamBlock, schema: TeamConfigSchema, meta: teamMeta },
    newsletter: { component: NewsletterBlock, schema: NewsletterConfigSchema, meta: newsletterMeta },
    video: { component: VideoBlock, schema: VideoConfigSchema, meta: videoMeta },
    'logo-cloud': { component: LogoCloudBlock, schema: LogoCloudConfigSchema, meta: logoCloudMeta },
    'blog-list': { component: BlogListBlock, schema: BlogListConfigSchema, meta: blogListMeta },
    'products-grid': { component: ProductsGridBlock, schema: ProductsGridConfigSchema, meta: productsGridMeta },
    'products-featured': { component: ProductsFeaturedBlock, schema: ProductsFeaturedConfigSchema, meta: productsFeaturedMeta },
    'custom-html': { component: CustomHtmlBlock, schema: CustomHtmlConfigSchema, meta: customHtmlMeta },
}

// ── Public API ───────────────────────────────────────────────────────────────

export const blockRegistry = {
    /** Get the React component for a block type */
    getComponent(blockType: string): React.ComponentType<any> | null {
        return REGISTRY[blockType]?.component ?? null
    },

    /** Get the Zod validation schema for a block type */
    getSchema(blockType: string): ZodSchema | null {
        return REGISTRY[blockType]?.schema ?? null
    },

    /** Get AI metadata for a block type */
    getBlockMeta(blockType: string): BlockMeta | null {
        return REGISTRY[blockType]?.meta ?? null
    },

    /** Get list of all supported block types */
    getBlockTypes(): BlockType[] {
        return Object.keys(REGISTRY) as BlockType[]
    },

    /** Get all metadata (for AI prompt context) */
    getAllMeta(): BlockMeta[] {
        return Object.values(REGISTRY).map(entry => entry.meta)
    },

    /** Validate a block config against its schema */
    validate(blockType: string, config: unknown): { success: boolean; data?: unknown; error?: string } {
        const schema = REGISTRY[blockType]?.schema
        if (!schema) return { success: false, error: `Unknown block type: ${blockType}` }

        const result = schema.safeParse(config)
        if (result.success) return { success: true, data: result.data }
        return { success: false, error: result.error.message }
    },

    /** Check if a block type is registered */
    has(blockType: string): boolean {
        return blockType in REGISTRY
    },

    /** Get total number of registered blocks */
    get count(): number {
        return Object.keys(REGISTRY).length
    },
}
