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
        mandatoryBlocks: ['navigation', 'hero', 'about', 'gallery', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['stats', 'team', 'cta', 'faq', 'features'],
        minItems: { testimonials: 4, features: 4, gallery: 8 },
    },
    fnb: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'gallery', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['stats', 'features', 'faq', 'team'],
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
 * Recommended navigation variant per category. Overrides AI's default choice
 * (which often picks bland "simple" or "transparent"). Applied in sanitizer.
 * All variants: simple | centered | mega-menu | transparent | sidebar | pill
 */
export const NAV_VARIANT_BY_CATEGORY: Readonly<Record<string, string>> = {
    beauty: 'pill',
    restaurant: 'centered',
    fnb: 'pill',
    tech: 'centered',
    health: 'centered',
    education: 'centered',
    realestate: 'centered',
    fitness: 'pill',
    creative: 'pill',
    business: 'centered',
    ecommerce: 'mega-menu',
    events: 'centered',
    blog: 'centered',
    travel: 'pill',
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
