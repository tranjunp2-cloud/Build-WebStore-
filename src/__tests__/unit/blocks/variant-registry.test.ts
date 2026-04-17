import { describe, it, expect } from 'vitest'

// Import all block configs and metas
import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'
import { FeaturesConfigSchema, featuresMeta } from '@/blocks/features/config'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'
import { PricingConfigSchema, pricingMeta } from '@/blocks/pricing/config'
import { GalleryConfigSchema, galleryMeta } from '@/blocks/gallery/config'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { NavigationConfigSchema, navigationMeta } from '@/blocks/navigation/config'

// ── TC-S2-015 + TC-S2-016: Cross-cutting Variant Registry Tests ─────────────

const BLOCK_CONFIGS = [
    { name: 'hero', meta: heroMeta, schema: HeroConfigSchema, expectedCount: 12, minFields: { headline: 'Test' } },
    { name: 'features', meta: featuresMeta, schema: FeaturesConfigSchema, expectedCount: 8, minFields: { headline: 'Test' } },
    { name: 'testimonials', meta: testimonialsMeta, schema: TestimonialsConfigSchema, expectedCount: 10, minFields: {} },
    { name: 'pricing', meta: pricingMeta, schema: PricingConfigSchema, expectedCount: 8, minFields: {} },
    { name: 'gallery', meta: galleryMeta, schema: GalleryConfigSchema, expectedCount: 6, minFields: {} },
    { name: 'footer', meta: footerMeta, schema: FooterConfigSchema, expectedCount: 6, minFields: {} },
    { name: 'contact', meta: contactMeta, schema: ContactConfigSchema, expectedCount: 6, minFields: {} },
    { name: 'navigation', meta: navigationMeta, schema: NavigationConfigSchema, expectedCount: 6, minFields: {} },
] as const

describe('[TC-S2-015] All Block Variant Counts', () => {
    it('total variant count across 8 blocks is 62', () => {
        const total = BLOCK_CONFIGS.reduce((sum, b) => sum + b.meta.variants.length, 0)
        expect(total).toBe(62)
    })

    for (const block of BLOCK_CONFIGS) {
        it(`${block.name} has ${block.expectedCount} variants`, () => {
            expect(block.meta.variants).toHaveLength(block.expectedCount)
        })
    }

    it('all variant names follow kebab-case convention', () => {
        const kebabCaseRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
        for (const block of BLOCK_CONFIGS) {
            for (const v of block.meta.variants) {
                expect(v, `${block.name} variant '${v}' should be kebab-case`).toMatch(kebabCaseRegex)
            }
        }
    })

    it('all variant names are max 20 characters', () => {
        for (const block of BLOCK_CONFIGS) {
            for (const v of block.meta.variants) {
                expect(v.length, `${block.name} variant '${v}' (${v.length} chars) should be <= 20`).toBeLessThanOrEqual(20)
            }
        }
    })

    it('no duplicate variant names within any block', () => {
        for (const block of BLOCK_CONFIGS) {
            const uniqueSet = new Set(block.meta.variants)
            expect(uniqueSet.size, `${block.name} has duplicate variants`).toBe(block.meta.variants.length)
        }
    })
})

describe('[TC-S2-016] Meta-Schema Consistency', () => {
    for (const block of BLOCK_CONFIGS) {
        describe(`${block.name}`, () => {
            it('each meta variant is valid in its schema', () => {
                for (const v of block.meta.variants) {
                    const config = {
                        blockType: block.name,
                        variant: v,
                        ...block.minFields,
                    }
                    const result = block.schema.safeParse(config)
                    expect(result.success, `${block.name} meta variant '${v}' should validate in schema`).toBe(true)
                }
            })

            it('meta.type matches blockType literal', () => {
                expect(block.meta.type).toBe(block.name)
            })

            it('meta.defaultVariant is included in meta.variants', () => {
                expect(block.meta.variants).toContain(block.meta.defaultVariant)
            })

            it('meta.defaultVariant matches schema default', () => {
                const config = {
                    blockType: block.name,
                    ...block.minFields,
                }
                const parsed = block.schema.parse(config)
                expect(parsed.variant).toBe(block.meta.defaultVariant)
            })
        })
    }
})
