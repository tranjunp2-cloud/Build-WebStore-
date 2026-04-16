/**
 * Category Requirements — structural minimums per category.
 *
 * Used by structure-enforcer.ts to inject missing mandatory blocks and pad item
 * counts after AI response. Ensures every gen meets a minimum quality bar:
 * ≥10 blocks, mandatory industry blocks present, testimonials/team ≥ min items.
 *
 * Fixes the sparse-layout problem where AI defaults to 5-6 block safe layout.
 *
 * Plan: 260414-1400-ai-gen-unsplash-pipeline phase-05
 */

export interface CategoryRequirement {
    /** Minimum total blocks per homepage (enforced via gap-filler). */
    minBlocks: number
    /** Block types that MUST appear (inject if missing). */
    mandatoryBlocks: readonly string[]
    /** Block types that CAN fill gaps to reach minBlocks (in priority order). */
    recommendedBlocks: readonly string[]
    /** Per-block minimum item counts. Padded from content library if below. */
    minItems: Readonly<Partial<Record<string, number>>>
}

/** Default fallback for unknown categories. */
const DEFAULT_REQUIREMENT: CategoryRequirement = {
    minBlocks: 9,
    mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'cta', 'footer'],
    recommendedBlocks: ['about', 'stats', 'faq', 'team', 'gallery'],
    minItems: { testimonials: 3, features: 4 },
}

export const CATEGORY_REQUIREMENTS: Readonly<Record<string, CategoryRequirement>> = {
    beauty: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'gallery', 'cta', 'footer'],
        recommendedBlocks: ['about', 'faq', 'stats'],
        minItems: { team: 3, testimonials: 4, features: 4, gallery: 6 },
    },
    restaurant: {
        minBlocks: 11,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['stats', 'team', 'cta', 'faq'],
        minItems: { testimonials: 4, features: 4, gallery: 8 },
    },
    fnb: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['stats', 'faq', 'team'],
        minItems: { testimonials: 4, features: 4, gallery: 6 },
    },
    tech: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'team', 'logo-cloud'],
        minItems: { features: 6, testimonials: 3, pricing: 3, faq: 5 },
    },
    health: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'faq', 'contact', 'footer'],
        recommendedBlocks: ['about', 'stats', 'cta', 'features'],
        minItems: { team: 3, testimonials: 4, features: 4, faq: 5 },
    },
    education: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'faq', 'cta', 'footer'],
        recommendedBlocks: ['about', 'team', 'stats', 'pricing', 'gallery'],
        minItems: { testimonials: 3, features: 4, faq: 5 },
    },
    realestate: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'stats', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['about', 'team', 'features', 'cta', 'faq'],
        minItems: { testimonials: 3, gallery: 8 },
    },
    fitness: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'team', 'testimonials', 'pricing', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'gallery', 'faq'],
        minItems: { team: 3, testimonials: 4, features: 4 },
    },
    creative: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['stats', 'features', 'cta', 'team'],
        minItems: { testimonials: 3, gallery: 6 },
    },
    business: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'features', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['about', 'team', 'stats', 'faq', 'logo-cloud'],
        minItems: { features: 6, testimonials: 3 },
    },
    ecommerce: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'newsletter', 'cta', 'footer'],
        recommendedBlocks: ['about', 'faq', 'stats', 'gallery', 'logo-cloud'],
        minItems: { features: 6, testimonials: 4 },
    },
    events: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['about', 'stats', 'team', 'cta', 'faq'],
        minItems: { testimonials: 3, features: 4, gallery: 6 },
    },
    blog: {
        minBlocks: 9,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'newsletter', 'cta', 'footer'],
        recommendedBlocks: ['about', 'testimonials', 'stats', 'faq'],
        minItems: { features: 4, testimonials: 3 },
    },
    travel: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'features', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'faq', 'team'],
        minItems: { testimonials: 3, features: 4, gallery: 8 },
    },
}

export function getCategoryRequirement(category: string | undefined): CategoryRequirement {
    if (!category) return DEFAULT_REQUIREMENT
    return CATEGORY_REQUIREMENTS[category] ?? DEFAULT_REQUIREMENT
}

/**
 * Recommended navigation variants per category (2-3 per category). Overrides
 * AI's default choice (which often picks bland "simple" or "transparent").
 * Seed-picked in structure-enforcer so businesses within the same category
 * rotate through the pool instead of locking to one variant.
 * All variants: simple | centered | mega-menu | transparent | sidebar | pill
 *
 * Plan 2253 Phase 01 — fixes R9 (single nav variant per category).
 */
export const NAV_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['pill', 'centered', 'transparent'],
    restaurant: ['centered', 'pill', 'mega-menu'],
    fnb: ['pill', 'centered', 'transparent'],
    tech: ['centered', 'pill', 'mega-menu'],
    health: ['centered', 'pill', 'transparent'],
    education: ['centered', 'mega-menu', 'pill'],
    realestate: ['centered', 'mega-menu', 'transparent'],
    fitness: ['pill', 'centered', 'transparent'],
    creative: ['pill', 'transparent', 'centered'],
    business: ['centered', 'mega-menu', 'pill'],
    ecommerce: ['mega-menu', 'pill', 'centered'],
    events: ['centered', 'transparent', 'pill'],
    blog: ['centered', 'pill', 'transparent'],
    travel: ['pill', 'transparent', 'centered'],
}

/**
 * Plan 260415 — contact variant rotation per category. Mirror of
 * NAV_VARIANT_BY_CATEGORY so enforcer + composer can spread contact
 * block styles across same-category businesses instead of every site
 * landing on the default `form` layout.
 *
 * All listed variant ids must exist in `src/blocks/contact/config.ts`.
 * Supported set: form / info-only / split / card-float / map-split / minimal-inline.
 */
export const CONTACT_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['card-float', 'form', 'map-split'],
    restaurant: ['map-split', 'split', 'form'],
    fnb: ['map-split', 'card-float', 'split'],
    tech: ['form', 'split', 'card-float'],
    health: ['map-split', 'form', 'split'],
    education: ['split', 'form', 'card-float'],
    realestate: ['map-split', 'form', 'split'],
    fitness: ['split', 'card-float', 'form'],
    creative: ['card-float', 'split', 'form'],
    business: ['form', 'split', 'map-split'],
    ecommerce: ['form', 'card-float', 'split'],
    events: ['map-split', 'split', 'card-float'],
    blog: ['form', 'info-only', 'split'],
    travel: ['map-split', 'card-float', 'split'],
}

/**
 * Plan 260415 — footer variant rotation per category. Supported set:
 * simple / expanded / minimal / centered-stack / mega-footer / dark-gradient.
 */
export const FOOTER_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['centered-stack', 'expanded', 'minimal'],
    restaurant: ['expanded', 'dark-gradient', 'mega-footer'],
    fnb: ['expanded', 'centered-stack', 'minimal'],
    tech: ['mega-footer', 'expanded', 'dark-gradient'],
    health: ['expanded', 'minimal', 'centered-stack'],
    education: ['expanded', 'mega-footer', 'centered-stack'],
    realestate: ['expanded', 'dark-gradient', 'mega-footer'],
    fitness: ['dark-gradient', 'expanded', 'centered-stack'],
    creative: ['centered-stack', 'minimal', 'dark-gradient'],
    business: ['expanded', 'mega-footer', 'minimal'],
    ecommerce: ['mega-footer', 'expanded', 'centered-stack'],
    events: ['dark-gradient', 'expanded', 'centered-stack'],
    blog: ['minimal', 'centered-stack', 'expanded'],
    travel: ['dark-gradient', 'expanded', 'mega-footer'],
}

/** Maps block type → the array field where items live (for padding). */
export const ITEM_FIELD_BY_BLOCK: Readonly<Record<string, string>> = {
    features: 'features',
    testimonials: 'testimonials',
    team: 'members',
    faq: 'items',
    pricing: 'plans',
    gallery: 'images',
    'service-cards': 'services',
    'logo-cloud': 'logos',
    stats: 'stats',
}
