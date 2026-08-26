import { describe, it, expect } from 'vitest'
import { PricingConfigSchema, pricingMeta } from '@/blocks/pricing/config'

// ── TC-S2-008: Pricing Block Variants ───────────────────────────────────────

const PRICING_VARIANTS = [
    'cards', 'table', 'horizontal', 'toggle', 'tiered', 'comparison', 'minimal', 'slider',
] as const

const minimalPricingConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'pricing',
    headline: 'Choose Your Plan',
    plans: [
        {
            name: 'Starter',
            price: 'RM 29',
            features: ['Feature A', 'Feature B'],
            ctaLabel: 'Get Started',
            ctaUrl: '/signup',
        },
    ],
    ...overrides,
})

describe('[TC-S2-008] Pricing Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 8 variants', () => {
            for (const v of PRICING_VARIANTS) {
                const result = PricingConfigSchema.safeParse(minimalPricingConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = PricingConfigSchema.safeParse(minimalPricingConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "cards" when variant not specified', () => {
            const result = PricingConfigSchema.parse(minimalPricingConfig())
            expect(result.variant).toBe('cards')
        })

        it('accepts yearlyDiscount field', () => {
            const result = PricingConfigSchema.safeParse(
                minimalPricingConfig({ yearlyDiscount: 20 }),
            )
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.yearlyDiscount).toBe(20)
            }
        })

        it('yearlyDiscount is optional', () => {
            const result = PricingConfigSchema.parse(minimalPricingConfig())
            expect(result.yearlyDiscount).toBeUndefined()
        })

        it('accepts plan with full fields including highlighted', () => {
            const result = PricingConfigSchema.safeParse(minimalPricingConfig({
                plans: [{
                    name: 'Pro',
                    price: 'RM 99',
                    period: '/month',
                    description: 'Best for teams',
                    features: ['All features', 'Priority support'],
                    ctaLabel: 'Upgrade Now',
                    ctaUrl: '/upgrade',
                    highlighted: true,
                }],
            }))
            expect(result.success).toBe(true)
        })

        it('defaults plans to empty array when not provided', () => {
            const result = PricingConfigSchema.parse({
                blockType: 'pricing',
            })
            expect(result.plans).toEqual([])
        })

        it('defaults highlighted to false', () => {
            const result = PricingConfigSchema.parse(minimalPricingConfig())
            expect(result.plans[0].highlighted).toBe(false)
        })
    })

    describe('Meta', () => {
        it('has exactly 8 variants', () => {
            expect(pricingMeta.variants).toHaveLength(8)
        })

        it('variants match schema enum', () => {
            for (const v of pricingMeta.variants) {
                const result = PricingConfigSchema.safeParse(minimalPricingConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(pricingMeta.type).toBe('pricing')
        })

        it('defaultVariant is "cards"', () => {
            expect(pricingMeta.defaultVariant).toBe('cards')
        })
    })
})
