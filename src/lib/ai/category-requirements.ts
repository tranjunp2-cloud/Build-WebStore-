/**
 * Category Requirements — structural minimums per category.
 *
 * Used by structure-enforcer.ts to inject missing mandatory blocks and pad item
 * counts after AI response. Ensures every gen meets a minimum quality bar:
 * ≥10 blocks, mandatory industry blocks present, testimonials/team ≥ min items.
 *
 * Fixes the sparse-layout problem where AI defaults to 5-6 block safe layout.
 *
 * IMPORTANT: minBlocks, mandatoryBlocks, recommendedBlocks are now derived from
 * template-rules.ts (single source of truth). Only minItems lives here because
 * it is specific to the structure-enforcer padding logic and not part of the
 * shared rubric/composer schema.
 *
 * Plan: 260414-1400-ai-gen-unsplash-pipeline phase-05
 * Migrated: 260429-0948-gen-template-harness-rules-overhaul
 */

import { TEMPLATE_RULES } from './template-rules'

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

/** Per-category minimum item counts — used by structure-enforcer padding. Not part of shared TEMPLATE_RULES schema. */
const CATEGORY_MIN_ITEMS: Readonly<Record<string, Readonly<Partial<Record<string, number>>>>> = {
    beauty:     { team: 3, testimonials: 4, features: 4, gallery: 6, 'service-cards': 3, faq: 4, stats: 3, 'logo-cloud': 6 },
    restaurant: { testimonials: 4, features: 4, gallery: 8, faq: 5, stats: 3 },
    fnb:        { testimonials: 4, features: 4, gallery: 6, faq: 4, stats: 3 },
    tech:       { features: 6, testimonials: 3, pricing: 3, faq: 5, stats: 4, 'logo-cloud': 6 },
    health:     { team: 3, testimonials: 4, features: 4, faq: 5, 'service-cards': 4, stats: 4 },
    education:  { testimonials: 3, features: 4, faq: 5, stats: 3 },
    realestate: { testimonials: 3, gallery: 8, stats: 4, faq: 4 },
    fitness:    { team: 3, testimonials: 4, features: 4, pricing: 3, stats: 3 },
    creative:   { testimonials: 3, gallery: 6, stats: 3 },
    business:   { features: 6, testimonials: 3, 'service-cards': 4, stats: 4, 'logo-cloud': 6 },
    ecommerce:  { features: 6, testimonials: 4, faq: 4, 'logo-cloud': 6, stats: 3 },
    events:     { testimonials: 3, features: 4, gallery: 6, stats: 3 },
    blog:       { features: 4, testimonials: 3, faq: 4 },
    travel:     { testimonials: 3, features: 4, gallery: 8, stats: 3, faq: 4 },
}

/**
 * CATEGORY_REQUIREMENTS — derived from TEMPLATE_RULES + local minItems.
 * Shape is identical to the old hardcoded version for full backward compatibility.
 */
export const CATEGORY_REQUIREMENTS: Readonly<Record<string, CategoryRequirement>> = Object.fromEntries(
    Object.entries(TEMPLATE_RULES).map(([cat, rule]) => [
        cat,
        {
            minBlocks: rule.minBlocks,
            mandatoryBlocks: rule.mandatoryBlocks,
            recommendedBlocks: rule.recommendedBlocks,
            minItems: CATEGORY_MIN_ITEMS[cat] ?? {},
        } satisfies CategoryRequirement,
    ]),
)

export function getCategoryRequirement(category: string | undefined): CategoryRequirement {
    if (!category) return DEFAULT_REQUIREMENT
    return CATEGORY_REQUIREMENTS[category] ?? DEFAULT_REQUIREMENT
}

/**
 * Recommended navigation variants per category (2-3 per category). Overrides
 * AI's default choice (which often picks bland "simple" or "transparent").
 * Seed-picked in structure-enforcer so businesses within the same category
 * rotate through the pool instead of locking to one variant.
 * All variants: default | centered | mega | transparent | sidebar | floating
 *
 * Plan 2253 Phase 01 — fixes R9 (single nav variant per category).
 * Renamed in nav refactor plan 260424: simple→default, mega-menu→mega, pill→floating.
 */
export const NAV_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['floating', 'centered', 'transparent'],
    restaurant: ['centered', 'floating'],
    fnb: ['floating', 'centered', 'transparent'],
    tech: ['centered', 'floating'],
    health: ['centered', 'floating', 'transparent'],
    education: ['centered', 'floating'],
    realestate: ['centered', 'transparent'],
    fitness: ['floating', 'centered', 'transparent'],
    creative: ['floating', 'transparent', 'centered'],
    business: ['centered', 'floating'],
    ecommerce: ['floating', 'centered'],
    events: ['centered', 'transparent', 'floating'],
    blog: ['centered', 'floating', 'transparent'],
    travel: ['floating', 'transparent', 'centered'],
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
 * simple / minimal / centered-stack / dark-gradient.
 * Note: expanded + mega-footer hidden (newsletter feature not ready).
 */
export const FOOTER_VARIANT_BY_CATEGORY: Readonly<Record<string, string[]>> = {
    beauty: ['centered-stack', 'simple', 'minimal'],
    restaurant: ['simple', 'dark-gradient', 'centered-stack'],
    fnb: ['simple', 'centered-stack', 'minimal'],
    tech: ['dark-gradient', 'simple', 'minimal'],
    health: ['simple', 'minimal', 'centered-stack'],
    education: ['simple', 'dark-gradient', 'centered-stack'],
    realestate: ['simple', 'dark-gradient', 'minimal'],
    fitness: ['dark-gradient', 'simple', 'centered-stack'],
    creative: ['centered-stack', 'minimal', 'dark-gradient'],
    business: ['simple', 'dark-gradient', 'minimal'],
    ecommerce: ['dark-gradient', 'simple', 'centered-stack'],
    events: ['dark-gradient', 'simple', 'centered-stack'],
    blog: ['minimal', 'centered-stack', 'simple'],
    travel: ['dark-gradient', 'simple', 'centered-stack'],
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
    beauty: [/* 'popup', // Temporarily disabled: Bug #791 */ 'inline', 'banner'],
    restaurant: ['inline', 'banner', /* 'popup', // Temporarily disabled: Bug #791 */],
    fnb: ['inline', /* 'popup', // Temporarily disabled: Bug #791 */ 'banner'],
    tech: ['banner', 'inline', /* 'popup', // Temporarily disabled: Bug #791 */],
    health: ['inline', 'banner', /* 'popup', // Temporarily disabled: Bug #791 */],
    education: ['inline', /* 'popup', // Temporarily disabled: Bug #791 */ 'banner'],
    realestate: ['banner', 'inline', /* 'popup', // Temporarily disabled: Bug #791 */],
    fitness: ['inline', 'banner', /* 'popup', // Temporarily disabled: Bug #791 */],
    creative: [/* 'popup', // Temporarily disabled: Bug #791 */ 'banner', 'inline'],
    business: ['banner', 'inline', /* 'popup', // Temporarily disabled: Bug #791 */],
    ecommerce: [/* 'popup', // Temporarily disabled: Bug #791 */ 'banner', 'inline'],
    events: ['inline', /* 'popup', // Temporarily disabled: Bug #791 */ 'banner'],
    blog: ['banner', 'inline', /* 'popup', // Temporarily disabled: Bug #791 */],
    travel: ['inline', 'banner', /* 'popup', // Temporarily disabled: Bug #791 */],
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
    'social-proof': 'reviews',
    team: 'members',
    faq: 'faqs',
    pricing: 'plans',
    gallery: 'images',
    'service-cards': 'services',
    'logo-cloud': 'logos',
    stats: 'stats',
}
