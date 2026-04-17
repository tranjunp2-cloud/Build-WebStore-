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
    minItems: { testimonials: 3, features: 4, faq: 4, 'service-cards': 3, stats: 3, 'logo-cloud': 5, team: 3, pricing: 3, gallery: 6 },
}

export const CATEGORY_REQUIREMENTS: Readonly<Record<string, CategoryRequirement>> = {
    beauty: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'gallery', 'cta', 'footer'],
        recommendedBlocks: ['about', 'faq', 'stats'],
        minItems: { team: 3, testimonials: 4, features: 4, gallery: 6, 'service-cards': 3, faq: 4, stats: 3, 'logo-cloud': 6 },
    },
    restaurant: {
        minBlocks: 11,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['stats', 'team', 'cta', 'faq'],
        minItems: { testimonials: 4, features: 4, gallery: 8, faq: 5, stats: 3 },
    },
    fnb: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'about', 'features', 'gallery', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['stats', 'faq', 'team'],
        minItems: { testimonials: 4, features: 4, gallery: 6, faq: 4, stats: 3 },
    },
    tech: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'team', 'logo-cloud'],
        minItems: { features: 6, testimonials: 3, pricing: 3, faq: 5, stats: 4, 'logo-cloud': 6 },
    },
    health: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'team', 'testimonials', 'faq', 'contact', 'footer'],
        recommendedBlocks: ['about', 'stats', 'cta', 'features'],
        minItems: { team: 3, testimonials: 4, features: 4, faq: 5, 'service-cards': 4, stats: 4 },
    },
    education: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'faq', 'cta', 'footer'],
        recommendedBlocks: ['about', 'team', 'stats', 'pricing', 'gallery'],
        minItems: { testimonials: 3, features: 4, faq: 5, stats: 3 },
    },
    realestate: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'stats', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['about', 'team', 'features', 'cta', 'faq'],
        minItems: { testimonials: 3, gallery: 8, stats: 4, faq: 4 },
    },
    fitness: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'team', 'testimonials', 'pricing', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'gallery', 'faq'],
        minItems: { team: 3, testimonials: 4, features: 4, pricing: 3, stats: 3 },
    },
    creative: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['stats', 'features', 'cta', 'team'],
        minItems: { testimonials: 3, gallery: 6, stats: 3 },
    },
    business: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'service-cards', 'features', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['about', 'team', 'stats', 'faq', 'logo-cloud'],
        minItems: { features: 6, testimonials: 3, 'service-cards': 4, stats: 4, 'logo-cloud': 6 },
    },
    ecommerce: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'testimonials', 'newsletter', 'cta', 'footer'],
        recommendedBlocks: ['about', 'faq', 'stats', 'gallery', 'logo-cloud'],
        minItems: { features: 6, testimonials: 4, faq: 4, 'logo-cloud': 6, stats: 3 },
    },
    events: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
        recommendedBlocks: ['about', 'stats', 'team', 'cta', 'faq'],
        minItems: { testimonials: 3, features: 4, gallery: 6, stats: 3 },
    },
    blog: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'features', 'newsletter', 'cta', 'footer'],
        recommendedBlocks: ['about', 'testimonials', 'stats', 'faq'],
        minItems: { features: 4, testimonials: 3, faq: 4 },
    },
    travel: {
        minBlocks: 10,
        mandatoryBlocks: ['navigation', 'hero', 'gallery', 'features', 'testimonials', 'cta', 'footer'],
        recommendedBlocks: ['about', 'stats', 'faq', 'team'],
        minItems: { testimonials: 3, features: 4, gallery: 8, stats: 3, faq: 4 },
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

/**
 * Plan 260415 session — variant rotation pools for 11 remaining block types.
 * Same pattern as NAV/CONTACT/FOOTER pools above. 14 categories × 3 variants.
 * Variant ids must match Zod enum in each block's config.ts.
 */
export const FEATURES_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['icon-left', 'zigzag', 'carousel'],
    restaurant: ['grid-3', 'icon-left', 'zigzag'],
    fnb: ['icon-top', 'grid-3', 'carousel'],
    tech: ['grid-4', 'zigzag', 'icon-left'],
    health: ['icon-left', 'grid-3', 'list'],
    education: ['grid-3', 'icon-top', 'zigzag'],
    realestate: ['grid-3', 'zigzag', 'list'],
    fitness: ['icon-top', 'grid-3', 'carousel'],
    creative: ['carousel', 'zigzag', 'icon-left'],
    business: ['grid-4', 'icon-left', 'list'],
    ecommerce: ['grid-4', 'icon-top', 'carousel'],
    events: ['carousel', 'grid-3', 'icon-top'],
    blog: ['list', 'icon-left', 'grid-2'],
    travel: ['carousel', 'zigzag', 'grid-3'],
}

export const TESTIMONIALS_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['spotlight', 'masonry', 'carousel'],
    restaurant: ['cards', 'minimal-quote', 'carousel'],
    fnb: ['minimal-quote', 'carousel', 'cards'],
    tech: ['carousel', 'spotlight', 'avatar-row'],
    health: ['cards', 'spotlight', 'simple'],
    education: ['simple', 'cards', 'carousel'],
    realestate: ['spotlight', 'cards', 'masonry'],
    fitness: ['avatar-row', 'carousel', 'spotlight'],
    creative: ['masonry', 'spotlight', 'video-text'],
    business: ['cards', 'carousel', 'spotlight'],
    ecommerce: ['carousel', 'avatar-row', 'masonry'],
    events: ['spotlight', 'masonry', 'cards'],
    blog: ['simple', 'minimal-quote', 'cards'],
    travel: ['masonry', 'carousel', 'spotlight'],
}

export const ABOUT_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['split', 'story', 'simple'],
    restaurant: ['story', 'split', 'simple'],
    fnb: ['story', 'simple', 'split'],
    tech: ['split', 'simple', 'story'],
    health: ['split', 'story', 'simple'],
    education: ['story', 'split', 'simple'],
    realestate: ['split', 'story', 'simple'],
    fitness: ['split', 'story', 'simple'],
    creative: ['story', 'split', 'simple'],
    business: ['split', 'story', 'simple'],
    ecommerce: ['split', 'simple', 'story'],
    events: ['story', 'split', 'simple'],
    blog: ['simple', 'story', 'split'],
    travel: ['story', 'split', 'simple'],
}

export const CTA_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['inline', 'card', 'banner'],
    restaurant: ['banner', 'inline', 'card'],
    fnb: ['banner', 'card', 'inline'],
    tech: ['card', 'inline', 'banner'],
    health: ['inline', 'banner', 'card'],
    education: ['banner', 'inline', 'card'],
    realestate: ['card', 'banner', 'inline'],
    fitness: ['banner', 'card', 'inline'],
    creative: ['card', 'inline', 'banner'],
    business: ['inline', 'card', 'banner'],
    ecommerce: ['banner', 'card', 'inline'],
    events: ['banner', 'inline', 'card'],
    blog: ['inline', 'card', 'banner'],
    travel: ['banner', 'card', 'inline'],
}

export const STATS_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['highlight', 'grid', 'row'],
    restaurant: ['row', 'highlight', 'grid'],
    fnb: ['row', 'grid', 'highlight'],
    tech: ['grid', 'highlight', 'row'],
    health: ['highlight', 'row', 'grid'],
    education: ['grid', 'row', 'highlight'],
    realestate: ['highlight', 'grid', 'row'],
    fitness: ['row', 'highlight', 'grid'],
    creative: ['grid', 'highlight', 'row'],
    business: ['grid', 'row', 'highlight'],
    ecommerce: ['row', 'grid', 'highlight'],
    events: ['highlight', 'row', 'grid'],
    blog: ['row', 'grid', 'highlight'],
    travel: ['highlight', 'grid', 'row'],
}

export const NEWSLETTER_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['popup', 'inline', 'banner'],
    restaurant: ['inline', 'banner', 'popup'],
    fnb: ['inline', 'popup', 'banner'],
    tech: ['banner', 'inline', 'popup'],
    health: ['inline', 'banner', 'popup'],
    education: ['inline', 'popup', 'banner'],
    realestate: ['banner', 'inline', 'popup'],
    fitness: ['inline', 'banner', 'popup'],
    creative: ['popup', 'banner', 'inline'],
    business: ['banner', 'inline', 'popup'],
    ecommerce: ['popup', 'banner', 'inline'],
    events: ['inline', 'popup', 'banner'],
    blog: ['banner', 'inline', 'popup'],
    travel: ['inline', 'banner', 'popup'],
}

export const TEAM_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['list', 'grid'],
    restaurant: ['grid', 'list'],
    fnb: ['grid', 'list'],
    tech: ['grid', 'list'],
    health: ['list', 'grid'],
    education: ['grid', 'list'],
    realestate: ['grid', 'list'],
    fitness: ['grid', 'list'],
    creative: ['list', 'grid'],
    business: ['grid', 'list'],
    ecommerce: ['grid', 'list'],
    events: ['grid', 'list'],
    blog: ['list', 'grid'],
    travel: ['grid', 'list'],
}

export const FAQ_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['simple', 'accordion', 'grid'],
    restaurant: ['accordion', 'simple', 'grid'],
    fnb: ['accordion', 'grid', 'simple'],
    tech: ['grid', 'accordion', 'simple'],
    health: ['accordion', 'simple', 'grid'],
    education: ['accordion', 'grid', 'simple'],
    realestate: ['simple', 'accordion', 'grid'],
    fitness: ['accordion', 'simple', 'grid'],
    creative: ['grid', 'simple', 'accordion'],
    business: ['accordion', 'grid', 'simple'],
    ecommerce: ['grid', 'accordion', 'simple'],
    events: ['accordion', 'grid', 'simple'],
    blog: ['simple', 'grid', 'accordion'],
    travel: ['accordion', 'simple', 'grid'],
}

export const GALLERY_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['masonry', 'lightbox', 'carousel'],
    restaurant: ['grid', 'masonry', 'carousel'],
    fnb: ['masonry', 'grid', 'carousel'],
    tech: ['grid', 'justified', 'carousel'],
    health: ['lightbox', 'grid', 'masonry'],
    education: ['grid', 'carousel', 'masonry'],
    realestate: ['masonry', 'lightbox', 'filmstrip'],
    fitness: ['carousel', 'masonry', 'grid'],
    creative: ['masonry', 'justified', 'filmstrip'],
    business: ['grid', 'carousel', 'masonry'],
    ecommerce: ['carousel', 'grid', 'masonry'],
    events: ['masonry', 'carousel', 'lightbox'],
    blog: ['grid', 'masonry', 'carousel'],
    travel: ['filmstrip', 'masonry', 'carousel'],
}

export const PRICING_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['cards', 'horizontal', 'toggle'],
    restaurant: ['cards', 'table', 'horizontal'],
    fnb: ['cards', 'horizontal', 'table'],
    tech: ['toggle', 'comparison', 'cards'],
    health: ['cards', 'tiered', 'table'],
    education: ['tiered', 'toggle', 'cards'],
    realestate: ['cards', 'comparison', 'table'],
    fitness: ['toggle', 'cards', 'comparison'],
    creative: ['minimal', 'cards', 'horizontal'],
    business: ['comparison', 'toggle', 'cards'],
    ecommerce: ['toggle', 'comparison', 'tiered'],
    events: ['tiered', 'cards', 'table'],
    blog: ['minimal', 'cards', 'toggle'],
    travel: ['cards', 'tiered', 'horizontal'],
}

export const SERVICE_CARDS_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['featured', 'grid', 'list'],
    restaurant: ['grid', 'featured', 'list'],
    fnb: ['grid', 'list', 'featured'],
    tech: ['grid', 'featured', 'list'],
    health: ['list', 'grid', 'featured'],
    education: ['grid', 'list', 'featured'],
    realestate: ['featured', 'grid', 'list'],
    fitness: ['featured', 'grid', 'list'],
    creative: ['featured', 'list', 'grid'],
    business: ['grid', 'featured', 'list'],
    ecommerce: ['grid', 'list', 'featured'],
    events: ['grid', 'featured', 'list'],
    blog: ['list', 'grid', 'featured'],
    travel: ['featured', 'grid', 'list'],
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
