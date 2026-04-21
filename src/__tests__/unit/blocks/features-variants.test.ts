import { describe, it, expect } from 'vitest'
import { FeaturesConfigSchema, featuresMeta } from '@/blocks/features/config'
import { parseFeatureIcon } from '@/blocks/features/index'

// ── TC-S2-004: Features Block Variants ──────────────────────────────────────

const FEATURES_VARIANTS = [
    'grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel',
] as const

const minimalFeaturesConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'features',
    headline: 'Our Features',
    features: [
        { title: 'Feature 1', description: 'Description 1' },
        { title: 'Feature 2', description: 'Description 2' },
    ],
    ...overrides,
})

describe('[TC-S2-004] Features Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 8 variants (4 existing + 4 new)', () => {
            for (const v of FEATURES_VARIANTS) {
                const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "grid-3" when variant not specified', () => {
            const result = FeaturesConfigSchema.parse(minimalFeaturesConfig())
            expect(result.variant).toBe('grid-3')
        })

        it('accepts feature items with optional icon', () => {
            const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({
                features: [
                    { icon: 'rocket', title: 'Fast', description: 'Very fast' },
                    { title: 'Simple', description: 'Very simple' },
                ],
            }))
            expect(result.success).toBe(true)
        })

        it('defaults features to empty array when not provided', () => {
            const result = FeaturesConfigSchema.parse({
                blockType: 'features',
                headline: 'Features',
            })
            expect(result.features).toEqual([])
        })

        it('backward compat — old variant "grid-3" still works', () => {
            const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({ variant: 'grid-3' }))
            expect(result.success).toBe(true)
        })

        it('backward compat — old variant "list" still works', () => {
            const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({ variant: 'list' }))
            expect(result.success).toBe(true)
        })
    })

    describe('Meta', () => {
        it('has exactly 8 variants', () => {
            expect(featuresMeta.variants).toHaveLength(8)
        })

        it('variants match schema enum', () => {
            for (const v of featuresMeta.variants) {
                const result = FeaturesConfigSchema.safeParse(minimalFeaturesConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(featuresMeta.type).toBe('features')
        })

        it('defaultVariant is "grid-3"', () => {
            expect(featuresMeta.defaultVariant).toBe('grid-3')
        })
    })
})

// ── BUG-FEAT-006: parseFeatureIcon emoji detection regression ────────────────
// Regression: icon.length <= 2 incorrectly flagged multi-codepoint emojis (e.g.
// shield 🛡️ = length 3) as AI text and replaced them with ✨.
// Fix: /\p{Extended_Pictographic}/u detects all emoji regardless of codepoint length.

describe('[BUG-FEAT-006] parseFeatureIcon — emoji detection', () => {
    it('preserves single-codepoint emoji (length 1)', () => {
        expect(parseFeatureIcon('⭐')).toBe('⭐')
    })

    it('preserves surrogate-pair emoji (length 2)', () => {
        expect(parseFeatureIcon('🔥')).toBe('🔥')
    })

    it('preserves emoji with variation selector (length 3) — regression case', () => {
        // 🛡️ appears in FALLBACK_FEATURES; was silently replaced with ✨ before fix
        expect(parseFeatureIcon('🛡️')).toBe('🛡️')
    })

    it('preserves ZWJ emoji sequences (length > 2)', () => {
        expect(parseFeatureIcon('🏳️‍🌈')).toBe('🏳️‍🌈')
    })

    it('maps AI text string "Sparkles" to ✨', () => {
        expect(parseFeatureIcon('Sparkles')).toBe('✨')
    })

    it('maps AI text string "Shield" to 🛡️', () => {
        expect(parseFeatureIcon('Shield')).toBe('🛡️')
    })

    it('maps AI text string "Clock" to ⏰', () => {
        expect(parseFeatureIcon('Clock')).toBe('⏰')
    })

    it('returns ✨ default for unknown arbitrary text', () => {
        expect(parseFeatureIcon('ArbitraryAIText')).toBe('✨')
    })

    it('returns undefined for undefined input', () => {
        expect(parseFeatureIcon(undefined)).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
        expect(parseFeatureIcon('')).toBeUndefined()
    })
})
