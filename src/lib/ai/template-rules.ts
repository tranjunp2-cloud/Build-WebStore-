/**
 * Template Rules — single source of truth for per-category structural requirements.
 *
 * Reconciles three previously separate sources:
 *   1. category-requirements.ts  → minBlocks, mandatoryBlocks, recommendedBlocks
 *   2. template-composer.ts      → industryBlocks (was CATEGORY_INDUSTRY_BLOCKS)
 *   3. rubric/evaluators.ts      → dnaMandatoryGroups, signatureBlocks (was CATEGORY_DNA_MAP)
 *
 * Consumers should import from this file and NOT maintain their own copies.
 * category-requirements.ts re-exports CATEGORY_REQUIREMENTS as a mapped view.
 *
 * Reconciliation rule: mandatoryBlocks MUST have ≥1 representative from each
 * dnaMandatoryGroup. The cheapest/most common representative wins.
 *
 * Plan: 260429-0948-gen-template-harness-rules-overhaul
 */

export interface CategoryRule {
    /** Minimum total blocks per homepage (enforced via gap-filler). */
    minBlocks: number
    /** Block types that MUST appear (inject if missing). Structure enforcer floor. */
    mandatoryBlocks: readonly string[]
    /** Rubric DNA — ≥1 block from each group must be present across all pages. */
    dnaMandatoryGroups: readonly (readonly string[])[]
    /** Industry-defining signature blocks for rubric signature-variety check. */
    signatureBlocks: readonly string[]
    /** Nice-to-have blocks that fill gaps to reach minBlocks (in priority order). */
    recommendedBlocks: readonly string[]
    /** Composer slot fillers — extra industry-specific blocks injected per tier. */
    industryBlocks: readonly string[]
    /** Whether CTA block is mandatory for this category. */
    ctaIsMandatory: boolean
}

// GH-960: restaurant/fnb reference menu-display; ecommerce references product-quick-view + pricing-table;
// tech references pricing-table; realestate references property-card — all hidden until #961 ships.
// Structure-enforcer and template-composer guard these at runtime via isUnsupportedBlock / TEMP_HIDDEN_BLOCK_TYPES.
// On re-enable, restore: block configs (aiVisible, category), EDITOR_HIDDEN_BLOCKS, BLOCKS_TEMP_HIDDEN,
// TEMP_HIDDEN_BLOCK_TYPES, SECTION_TYPE_MATCHERS, Pages.ts layout.blocks, PAGES_BLOCK_WHITELIST/SCHEMA/FIELDS,
// SUPPORTED_BLOCK_IDS, category-recipes, system-prompt VARIETY RULES 8-10.
export const TEMPLATE_RULES: Readonly<Record<string, CategoryRule>> = {
    restaurant: {
        minBlocks: 11,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        dnaMandatoryGroups: [['menu-display', 'booking-widget'], ['gallery', 'gallery-masonry']],
        signatureBlocks: ['menu-display', 'booking-widget', 'review-cards'],
        recommendedBlocks: ['stats', 'team', 'cta', 'faq'],
        industryBlocks: ['menu-display', 'booking-widget', 'review-cards'],
        ctaIsMandatory: false,
    },
    fnb: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'cta', 'footer'],
        dnaMandatoryGroups: [['menu-display', 'features'], ['gallery', 'gallery-masonry']],
        signatureBlocks: ['menu-display', 'gallery', 'review-cards'],
        recommendedBlocks: ['stats', 'faq', 'team'],
        industryBlocks: ['menu-display', 'review-cards'],
        ctaIsMandatory: true,
    },
    ecommerce: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'newsletter', 'cta', 'footer'],
        dnaMandatoryGroups: [['product-quick-view', 'features'], ['pricing', 'pricing-table']],
        signatureBlocks: ['product-quick-view', 'pricing'],
        recommendedBlocks: ['about', 'faq', 'stats', 'gallery', 'logo-cloud'],
        industryBlocks: ['product-quick-view', 'review-cards'],
        ctaIsMandatory: true,
    },
    beauty: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'gallery', 'cta', 'footer'],
        dnaMandatoryGroups: [['service-cards', 'features'], ['gallery', 'gallery-masonry', 'before-after']],
        signatureBlocks: ['service-cards', 'booking-widget', 'before-after'],
        recommendedBlocks: ['about', 'faq', 'stats'],
        industryBlocks: ['booking-widget', 'review-cards', 'before-after'],
        ctaIsMandatory: true,
    },
    tech: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 'footer'],
        dnaMandatoryGroups: [['pricing', 'pricing-table'], ['features']],
        signatureBlocks: ['pricing', 'features', 'feature-comparison', /* 'video-showcase' */], // temporarily hidden (aiVisible: false, archived)
        recommendedBlocks: ['about', 'stats', 'team', 'logo-cloud'],
        industryBlocks: ['feature-comparison', 'pricing-table', /* 'video-showcase' */], // temporarily hidden
        ctaIsMandatory: true,
    },
    health: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'faq', 'contact', 'footer'],
        dnaMandatoryGroups: [['doctor-profile', 'service-cards', 'team'], ['faq']],
        signatureBlocks: ['doctor-profile', 'booking-widget'],
        recommendedBlocks: ['about', 'stats', 'cta', 'features'],
        industryBlocks: ['doctor-profile', 'booking-widget', 'review-cards'],
        ctaIsMandatory: false,
    },
    education: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'faq', 'cta', 'footer'],
        dnaMandatoryGroups: [['class-schedule', 'features', 'service-cards'], ['faq']],
        signatureBlocks: ['class-schedule', 'pricing'],
        recommendedBlocks: ['about', 'team', 'stats', 'pricing', 'gallery'],
        industryBlocks: ['class-schedule', /* 'video-showcase', */ 'review-cards'], // temporarily hidden
        ctaIsMandatory: true,
    },
    realestate: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'stats', 'testimonials', 'contact', 'footer'],
        dnaMandatoryGroups: [['property-card', 'gallery'], ['stats', 'features']],
        signatureBlocks: ['property-card', 'gallery'],
        recommendedBlocks: ['about', 'team', 'features', 'cta', 'faq'],
        industryBlocks: ['property-card', 'review-cards'],
        ctaIsMandatory: false,
    },
    fitness: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'team', 'testimonials', 'pricing', 'cta', 'footer'],
        dnaMandatoryGroups: [['class-schedule', 'features'], ['pricing', 'team']],
        signatureBlocks: ['class-schedule', 'team', 'pricing'],
        recommendedBlocks: ['about', 'stats', 'gallery', 'faq'],
        industryBlocks: ['class-schedule', 'booking-widget', 'review-cards'],
        ctaIsMandatory: true,
    },
    creative: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
        dnaMandatoryGroups: [['gallery', 'gallery-masonry', 'portfolio-grid'], ['testimonials']],
        signatureBlocks: ['portfolio-grid', 'gallery-masonry', /* 'video-showcase' */], // temporarily hidden (aiVisible: false, archived)
        recommendedBlocks: ['stats', 'features', 'cta', 'team'],
        industryBlocks: ['portfolio-grid', /* 'video-showcase', */ 'review-cards'], // temporarily hidden
        ctaIsMandatory: false,
    },
    business: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'features', 'testimonials', 'cta', 'footer'],
        dnaMandatoryGroups: [['team', 'features'], ['testimonials']],
        signatureBlocks: ['team', 'stats', 'features'],
        recommendedBlocks: ['about', 'team', 'stats', 'faq', 'logo-cloud'],
        industryBlocks: ['service-cards', 'review-cards', 'client-logos'],
        ctaIsMandatory: true,
    },
    events: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        dnaMandatoryGroups: [['booking-widget', 'contact'], ['gallery']],
        signatureBlocks: ['booking-widget', 'gallery'],
        recommendedBlocks: ['about', 'stats', 'team', 'cta', 'faq'],
        industryBlocks: ['countdown-timer', 'booking-widget', 'review-cards'],
        ctaIsMandatory: false,
    },
    blog: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'newsletter', 'cta', 'footer'],
        dnaMandatoryGroups: [['features', 'testimonials'], ['newsletter']],
        signatureBlocks: ['newsletter', 'features'],
        recommendedBlocks: ['about', 'testimonials', 'stats', 'faq'],
        industryBlocks: ['blog-list', 'social-proof', 'review-cards'],
        ctaIsMandatory: true,
    },
    travel: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'features', 'testimonials', 'cta', 'footer'],
        dnaMandatoryGroups: [['gallery', 'gallery-masonry'], ['features', 'service-cards']],
        signatureBlocks: ['gallery', 'features'],
        recommendedBlocks: ['about', 'stats', 'faq', 'team'],
        industryBlocks: ['booking-widget', 'review-cards', /* 'video-showcase' */], // temporarily hidden
        ctaIsMandatory: true,
    },
}
