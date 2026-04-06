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
import { SocialWidgetBlock } from './social-widget'
import { CartWidgetBlock } from './cart-widget'
// v1.1 — New Block Components
import { PricingTableBlock } from './pricing-table'
import { GalleryMasonryBlock } from './gallery-masonry'
import { WhatsappButtonBlock } from './whatsapp-button'
import { GoogleMapsBlock } from './google-maps'
import { SocialProofBlock } from './social-proof'
import { CountdownTimerBlock } from './countdown-timer'
import { BeforeAfterBlock } from './before-after'
import { FeatureComparisonBlock } from './feature-comparison'
import { DownloadCTABlock } from './download-cta'
import { VideoBackgroundBlock } from './video-background'
import { BreadcrumbBlock } from './breadcrumb'
import { DividerBlock } from './divider'
import { AnnouncementBarBlock } from './announcement-bar'
import { ClientLogosBlock } from './client-logos'
import { AccordionBlock } from './accordion'
import { StepProcessBlock } from './step-process'
import { PortfolioGridBlock } from './portfolio-grid'
import { MenuFoodBlock } from './menu-food'
import { ServiceCardsBlock } from './service-cards'
import { CarouselBlock } from './carousel'
// v2.0 — Industry Block Components
import { MenuDisplayBlock } from './menu-display'
import { BookingWidgetBlock } from './booking-widget'
import { ClassScheduleBlock } from './class-schedule'
import { ReviewCardsBlock } from './review-cards'
import { VideoShowcaseBlock } from './video-showcase'
import { DoctorProfileBlock } from './doctor-profile'
import { PropertyCardBlock } from './property-card'
import { ProductQuickViewBlock } from './product-quick-view'

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
import { SocialWidgetConfigSchema, socialWidgetMeta } from './social-widget/config'
import { CartWidgetConfigSchema, cartWidgetMeta } from './cart-widget/config'
// v1.1 — New Block Configs
import { PricingTableConfigSchema, pricingTableMeta } from './pricing-table/config'
import { GalleryMasonryConfigSchema, galleryMasonryMeta } from './gallery-masonry/config'
import { WhatsappButtonConfigSchema, whatsappButtonMeta } from './whatsapp-button/config'
import { GoogleMapsConfigSchema, googleMapsMeta } from './google-maps/config'
import { SocialProofConfigSchema, socialProofMeta } from './social-proof/config'
import { CountdownTimerConfigSchema, countdownTimerMeta } from './countdown-timer/config'
import { BeforeAfterConfigSchema, beforeAfterMeta } from './before-after/config'
import { FeatureComparisonConfigSchema, featureComparisonMeta } from './feature-comparison/config'
import { DownloadCTAConfigSchema, downloadCTAMeta } from './download-cta/config'
import { VideoBackgroundConfigSchema, videoBackgroundMeta } from './video-background/config'
import { BreadcrumbConfigSchema, breadcrumbMeta } from './breadcrumb/config'
import { DividerConfigSchema, dividerMeta } from './divider/config'
import { AnnouncementBarConfigSchema, announcementBarMeta } from './announcement-bar/config'
import { ClientLogosConfigSchema, clientLogosMeta } from './client-logos/config'
import { AccordionConfigSchema, accordionMeta } from './accordion/config'
import { StepProcessConfigSchema, stepProcessMeta } from './step-process/config'
import { PortfolioGridConfigSchema, portfolioGridMeta } from './portfolio-grid/config'
import { MenuFoodConfigSchema, menuFoodMeta } from './menu-food/config'
import { ServiceCardsConfigSchema, serviceCardsMeta } from './service-cards/config'
import { CarouselConfigSchema, carouselMeta } from './carousel/config'
// v2.0 — Industry Block Configs
import { MenuDisplayConfigSchema, menuDisplayMeta } from './menu-display/config'
import { BookingWidgetConfigSchema, bookingWidgetMeta } from './booking-widget/config'
import { ClassScheduleConfigSchema, classScheduleMeta } from './class-schedule/config'
import { ReviewCardsConfigSchema, reviewCardsMeta } from './review-cards/config'
import { VideoShowcaseConfigSchema, videoShowcaseMeta } from './video-showcase/config'
import { DoctorProfileConfigSchema, doctorProfileMeta } from './doctor-profile/config'
import { PropertyCardConfigSchema, propertyCardMeta } from './property-card/config'
import { ProductQuickViewConfigSchema, productQuickViewMeta } from './product-quick-view/config'

// ── Registry ─────────────────────────────────────────────────────────────────

type BlockRegistryEntry = {
    // Required 'any' because block components have highly varied generic prop signatures
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
    socialWidget: { component: SocialWidgetBlock, schema: SocialWidgetConfigSchema, meta: socialWidgetMeta },
    cartWidget: { component: CartWidgetBlock, schema: CartWidgetConfigSchema, meta: cartWidgetMeta },
    // v1.1 — New Blocks
    'pricing-table': { component: PricingTableBlock, schema: PricingTableConfigSchema, meta: pricingTableMeta },
    'gallery-masonry': { component: GalleryMasonryBlock, schema: GalleryMasonryConfigSchema, meta: galleryMasonryMeta },
    'whatsapp-button': { component: WhatsappButtonBlock, schema: WhatsappButtonConfigSchema, meta: whatsappButtonMeta },
    'google-maps': { component: GoogleMapsBlock, schema: GoogleMapsConfigSchema, meta: googleMapsMeta },
    'social-proof': { component: SocialProofBlock, schema: SocialProofConfigSchema, meta: socialProofMeta },
    'countdown-timer': { component: CountdownTimerBlock, schema: CountdownTimerConfigSchema, meta: countdownTimerMeta },
    'before-after': { component: BeforeAfterBlock, schema: BeforeAfterConfigSchema, meta: beforeAfterMeta },
    'feature-comparison': { component: FeatureComparisonBlock, schema: FeatureComparisonConfigSchema, meta: featureComparisonMeta },
    'download-cta': { component: DownloadCTABlock, schema: DownloadCTAConfigSchema, meta: downloadCTAMeta },
    'video-background': { component: VideoBackgroundBlock, schema: VideoBackgroundConfigSchema, meta: videoBackgroundMeta },
    breadcrumb: { component: BreadcrumbBlock, schema: BreadcrumbConfigSchema, meta: breadcrumbMeta },
    divider: { component: DividerBlock, schema: DividerConfigSchema, meta: dividerMeta },
    'announcement-bar': { component: AnnouncementBarBlock, schema: AnnouncementBarConfigSchema, meta: announcementBarMeta },
    'client-logos': { component: ClientLogosBlock, schema: ClientLogosConfigSchema, meta: clientLogosMeta },
    accordion: { component: AccordionBlock, schema: AccordionConfigSchema, meta: accordionMeta },
    'step-process': { component: StepProcessBlock, schema: StepProcessConfigSchema, meta: stepProcessMeta },
    'portfolio-grid': { component: PortfolioGridBlock, schema: PortfolioGridConfigSchema, meta: portfolioGridMeta },
    'menu-food': { component: MenuFoodBlock, schema: MenuFoodConfigSchema, meta: menuFoodMeta },
    'service-cards': { component: ServiceCardsBlock, schema: ServiceCardsConfigSchema, meta: serviceCardsMeta },
    carousel: { component: CarouselBlock, schema: CarouselConfigSchema, meta: carouselMeta },
    // v2.0 — Industry Blocks
    'menu-display': { component: MenuDisplayBlock, schema: MenuDisplayConfigSchema, meta: menuDisplayMeta },
    'booking-widget': { component: BookingWidgetBlock, schema: BookingWidgetConfigSchema, meta: bookingWidgetMeta },
    'class-schedule': { component: ClassScheduleBlock, schema: ClassScheduleConfigSchema, meta: classScheduleMeta },
    'review-cards': { component: ReviewCardsBlock, schema: ReviewCardsConfigSchema, meta: reviewCardsMeta },
    'video-showcase': { component: VideoShowcaseBlock, schema: VideoShowcaseConfigSchema, meta: videoShowcaseMeta },
    'doctor-profile': { component: DoctorProfileBlock, schema: DoctorProfileConfigSchema, meta: doctorProfileMeta },
    'property-card': { component: PropertyCardBlock, schema: PropertyCardConfigSchema, meta: propertyCardMeta },
    'product-quick-view': { component: ProductQuickViewBlock, schema: ProductQuickViewConfigSchema, meta: productQuickViewMeta },
}

// ── Public API ───────────────────────────────────────────────────────────────

export const blockRegistry = {
    /** Get the React component for a block type */
    // Required 'any' because block components have highly varied generic prop signatures
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
