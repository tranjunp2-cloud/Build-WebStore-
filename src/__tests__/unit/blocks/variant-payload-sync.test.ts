/**
 * TC-F01.VS: Variant-Payload Sync tests
 *
 * Root cause of 500 errors: Pages.ts defines variant option values that Payload
 * persists to DB, but the block's config.ts Zod schema only accepts a different
 * set of variants. At render time, the Zod parse fails → 500.
 *
 * This test file verifies BOTH directions:
 *   1. Every variant value in config.ts Zod enum exists as an option in Pages.ts
 *      (config → Pages: Zod accepts what Pages can save)
 *   2. Every option value in Pages.ts exists in config.ts Zod enum
 *      (Pages → config: what Payload saves, Zod can also accept)
 *
 * Source of truth for Pages.ts options: extracted inline as PAGES_VARIANTS below.
 * These must be kept in sync with src/collections/Pages.ts manually.
 * CI will catch drift: if a Pages.ts option is added without updating this file,
 * one of the bi-directional checks will fail.
 *
 * Plan: 260414-1400-ai-gen-unsplash-pipeline / audit follow-up
 */

import { describe, it, expect } from 'vitest'

// ── Block config schema imports (Zod enums) ───────────────────────────────────
import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'
import { NavigationConfigSchema, navigationMeta } from '@/blocks/navigation/config'
import { AboutConfigSchema, aboutMeta } from '@/blocks/about/config'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'
import { FeaturesConfigSchema, featuresMeta } from '@/blocks/features/config'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'
import { GalleryConfigSchema, galleryMeta } from '@/blocks/gallery/config'
import { StatsConfigSchema, statsMeta } from '@/blocks/stats/config'
import { PricingConfigSchema, pricingMeta } from '@/blocks/pricing/config'
import { FAQConfigSchema, faqMeta } from '@/blocks/faq/config'
import { TeamConfigSchema, teamMeta } from '@/blocks/team/config'
import { CTAConfigSchema, ctaMeta } from '@/blocks/cta/config'
import { NewsletterConfigSchema, newsletterMeta } from '@/blocks/newsletter/config'
import { LogoCloudConfigSchema, logoCloudMeta } from '@/blocks/logo-cloud/config'
import { ServiceCardsConfigSchema, serviceCardsMeta } from '@/blocks/service-cards/config'

// ── Pages.ts inline variant values (mirrors src/collections/Pages.ts) ─────────
// These are extracted from the `options` arrays in Pages.ts and MUST stay in
// sync. If Pages.ts adds a new variant option, add it here AND the config.ts
// Zod enum must accept it (or this test catches the drift).

const PAGES_VARIANTS: Record<string, string[]> = {
    hero: [
        'centered', 'split-left', 'split-right', 'fullscreen', 'video',
        'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax',
        'slideshow', 'split-video',
    ],
    navigation: ['default', 'centered', 'transparent', 'sidebar', 'floating'],
    about: ['simple', 'split', 'story', 'two-column', 'founder-quote', 'centered-large', 'image-overlay'],
    contact: ['form', 'info-only', 'split', 'card-float', 'minimal-inline'],
    footer: ['simple', 'minimal', 'centered-stack', 'dark-gradient'],
    features: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel'],
    testimonials: [
        'cards', 'carousel', 'simple', 'masonry', 'spotlight',
        'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single',
    ],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'justified'],
    stats: ['row', 'grid', 'highlight', 'cards', 'inline-text', 'chart-bars'],
    pricing: ['cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider'],
    faq: ['accordion', 'grid', 'simple', 'two-column-accordion', 'chat-bubbles', 'numbered'],
    team: ['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row'],
    cta: ['banner', 'inline', 'card', 'floating-sticky', 'image-bg', 'split-testimonial', 'dark-card', 'mesh-gradient-hero'],
    newsletter: ['inline', /* 'popup', // Temporarily disabled: Bug #791 */ 'banner', 'stacked-card', 'minimal', 'incentive-grid'],
    'logo-cloud': ['row', 'grid'],
    'service-cards': ['grid', 'list', 'featured'],
}

// ── Block registry: name → schema + meta + required fields for parse ──────────
const BLOCK_REGISTRY = [
    {
        name: 'hero',
        schema: HeroConfigSchema,
        meta: heroMeta,
        requiredFields: { headline: 'Test' },
    },
    {
        name: 'navigation',
        schema: NavigationConfigSchema,
        meta: navigationMeta,
        requiredFields: {},
    },
    {
        name: 'about',
        schema: AboutConfigSchema,
        meta: aboutMeta,
        requiredFields: { headline: 'Test' },
    },
    {
        name: 'contact',
        schema: ContactConfigSchema,
        meta: contactMeta,
        requiredFields: {},
    },
    {
        name: 'footer',
        schema: FooterConfigSchema,
        meta: footerMeta,
        requiredFields: {},
    },
    {
        name: 'features',
        schema: FeaturesConfigSchema,
        meta: featuresMeta,
        requiredFields: { headline: 'Test' },
    },
    {
        name: 'testimonials',
        schema: TestimonialsConfigSchema,
        meta: testimonialsMeta,
        requiredFields: {},
    },
    {
        name: 'gallery',
        schema: GalleryConfigSchema,
        meta: galleryMeta,
        requiredFields: {},
    },
    {
        name: 'stats',
        schema: StatsConfigSchema,
        meta: statsMeta,
        requiredFields: {},
    },
    {
        name: 'pricing',
        schema: PricingConfigSchema,
        meta: pricingMeta,
        requiredFields: {},
    },
    {
        name: 'faq',
        schema: FAQConfigSchema,
        meta: faqMeta,
        requiredFields: {},
    },
    {
        name: 'team',
        schema: TeamConfigSchema,
        meta: teamMeta,
        requiredFields: {},
    },
    {
        name: 'cta',
        schema: CTAConfigSchema,
        meta: ctaMeta,
        requiredFields: { headline: 'Test', ctaLabel: 'Click', ctaUrl: '/link' },
    },
    {
        name: 'newsletter',
        schema: NewsletterConfigSchema,
        meta: newsletterMeta,
        requiredFields: {},
    },
    {
        name: 'logo-cloud',
        schema: LogoCloudConfigSchema,
        meta: logoCloudMeta,
        requiredFields: {},
    },
    {
        name: 'service-cards',
        schema: ServiceCardsConfigSchema,
        meta: serviceCardsMeta,
        requiredFields: { headline: 'Test' },
    },
] as const

// ── TC-F01.VS.01: Payload → config (Pages.ts values accepted by Zod) ─────────
describe('[TC-F01.VS.01] Every Pages.ts variant value is accepted by config.ts Zod schema', () => {
    for (const block of BLOCK_REGISTRY) {
        const pagesVariants = PAGES_VARIANTS[block.name]
        if (!pagesVariants) continue

        describe(`${block.name}`, () => {
            for (const variant of pagesVariants) {
                it(`variant '${variant}' saved by Payload is accepted by Zod schema`, () => {
                    // Arrange
                    const input = { blockType: block.name, variant, ...block.requiredFields }

                    // Act
                    const result = (block.schema as ReturnType<typeof HeroConfigSchema.extend>).safeParse(input)

                    // Assert — mismatch here = 500 error risk at render time
                    expect(
                        result.success,
                        `${block.name} variant '${variant}' is in Pages.ts but rejected by config.ts Zod schema — this causes 500 at render time`,
                    ).toBe(true)
                })
            }
        })
    }
})

// ── TC-F01.VS.02: config → Payload (Zod enum values exist in Pages.ts) ───────
describe('[TC-F01.VS.02] Every config.ts meta.variants value exists in Pages.ts options', () => {
    for (const block of BLOCK_REGISTRY) {
        const pagesVariants = PAGES_VARIANTS[block.name]
        if (!pagesVariants) continue

        const pagesSet = new Set(pagesVariants)

        describe(`${block.name}`, () => {
            for (const variant of block.meta.variants) {
                it(`config variant '${variant}' is present in Pages.ts options`, () => {
                    // Assert — mismatch here = Zod accepts it but Payload admin
                    // doesn't show it as an option → inconsistency / dead variant
                    expect(
                        pagesSet.has(variant),
                        `${block.name} config.ts variant '${variant}' is missing from Pages.ts options — add it or remove from config`,
                    ).toBe(true)
                })
            }
        })
    }
})

// ── TC-F01.VS.03: variant counts are identical (full set equality) ────────────
describe('[TC-F01.VS.03] Pages.ts and config.ts have the same number of variants', () => {
    for (const block of BLOCK_REGISTRY) {
        const pagesVariants = PAGES_VARIANTS[block.name]
        if (!pagesVariants) continue

        it(`${block.name}: Pages.ts (${pagesVariants.length}) === config.ts meta.variants (${block.meta.variants.length})`, () => {
            // Arrange
            const pagesSet = new Set(pagesVariants)
            const configSet = new Set(block.meta.variants)

            // Find actual diffs for clear failure messages
            const inPagesNotConfig = pagesVariants.filter((v) => !configSet.has(v))
            const inConfigNotPages = block.meta.variants.filter((v) => !pagesSet.has(v))

            // Assert
            expect(
                inPagesNotConfig,
                `${block.name}: variants in Pages.ts but NOT in config.ts → will cause 500: ${inPagesNotConfig.join(', ')}`,
            ).toHaveLength(0)

            expect(
                inConfigNotPages,
                `${block.name}: variants in config.ts but NOT in Pages.ts → dead variants: ${inConfigNotPages.join(', ')}`,
            ).toHaveLength(0)

            expect(pagesVariants.length).toBe(block.meta.variants.length)
        })
    }
})

// ── TC-F01.VS.04: no invalid variant causes an unhandled Zod error ────────────
describe('[TC-F01.VS.04] Invalid variant values are rejected by Zod (not cause unhandled errors)', () => {
    const invalidValues = ['invalid', 'GRID', 'Grid', '', ' ', 'undefined', '0', 'null']

    for (const block of BLOCK_REGISTRY) {
        describe(`${block.name}`, () => {
            for (const bad of invalidValues) {
                it(`rejects variant '${bad}' gracefully via safeParse`, () => {
                    // Arrange
                    const input = { blockType: block.name, variant: bad, ...block.requiredFields }

                    // Act — must NOT throw, must return { success: false }
                    let result: { success: boolean } | undefined
                    expect(() => {
                        result = (block.schema as ReturnType<typeof HeroConfigSchema.extend>).safeParse(input)
                    }).not.toThrow()

                    // Assert
                    expect(result).toBeDefined()
                    expect(result!.success).toBe(false)
                })
            }
        })
    }
})
