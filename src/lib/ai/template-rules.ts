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

// GH-960: restaurant/fnb used menu-display; ecommerce used pricing-table; tech used pricing-table;
// realestate used property-card — all now replaced/substituted via GH-1024.
// GH-1024: menu-display → menu-food (restaurant/fnb); property-card → features (realestate);
// pricing-table removed from dnaMandatoryGroups (ecommerce/tech) — use pricing as sole representative.
// On re-enable, restore: EDITOR_HIDDEN_BLOCKS, BLOCKS_TEMP_HIDDEN,
// SUPPORTED_BLOCK_IDS, category-recipes, system-prompt VARIETY RULES, and entries below.
export const TEMPLATE_RULES: Readonly<Record<string, CategoryRule>> = {
    restaurant: {
        minBlocks: 11,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        dnaMandatoryGroups: [['menu-food', 'booking-widget'], ['gallery', 'gallery-masonry']], // GH-1024: menu-display → menu-food
        signatureBlocks: ['menu-food', 'booking-widget', 'review-cards'], // GH-1024: menu-display → menu-food
        recommendedBlocks: ['stats', 'team', 'cta', 'faq'],
        industryBlocks: ['menu-food', 'booking-widget', 'review-cards'], // GH-1024: menu-display → menu-food
        ctaIsMandatory: false,
    },
    fnb: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'cta', 'footer'],
        dnaMandatoryGroups: [['menu-food', 'features'], ['gallery', 'gallery-masonry']], // GH-1024: menu-display → menu-food
        signatureBlocks: ['menu-food', 'gallery', 'review-cards'], // GH-1024: menu-display → menu-food
        recommendedBlocks: ['stats', 'faq', 'team'],
        industryBlocks: ['menu-food', 'review-cards'], // GH-1024: menu-display → menu-food
        ctaIsMandatory: true,
    },
    ecommerce: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'newsletter', 'cta', 'footer'],
        dnaMandatoryGroups: [['product-quick-view', 'features'], ['pricing']], // GH-1024: pricing-table removed
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
        dnaMandatoryGroups: [['pricing'], ['features']], // GH-1024: pricing-table removed
        signatureBlocks: ['pricing', 'features', 'feature-comparison', /* 'video-showcase' */], // temporarily hidden (aiVisible: false, archived)
        recommendedBlocks: ['about', 'stats', 'team', 'logo-cloud'],
        industryBlocks: ['feature-comparison', /* 'pricing-table', */ /* 'video-showcase' */], // GH-1024: pricing-table hidden
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
        dnaMandatoryGroups: [['gallery', 'gallery-masonry'], ['stats', 'features']], // GH-1024: property-card removed; restored independent invariants
        signatureBlocks: ['features', 'gallery'], // GH-1024: property-card → features
        recommendedBlocks: ['about', 'team', 'features', 'cta', 'faq'],
        industryBlocks: ['features', 'review-cards'], // GH-1024: property-card → features
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
