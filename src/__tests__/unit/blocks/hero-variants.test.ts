import { describe, it, expect } from 'vitest'
import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'

// ── TC-S2-001: Hero Block Variants ──────────────────────────────────────────

const HERO_VARIANTS = [
    'centered', 'split-left', 'split-right', 'fullscreen', 'video',
    'magazine', 'minimal', 'cards-overlay', 'gradient', 'parallax', 'slideshow', 'split-video',
] as const

const minimalHeroConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'hero',
    headline: 'Welcome to Our Site',
    ...overrides,
})

describe('[TC-S2-001] Hero Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 12 variants', () => {
            for (const v of HERO_VARIANTS) {
                const result = HeroConfigSchema.safeParse(minimalHeroConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = HeroConfigSchema.safeParse(minimalHeroConfig({ variant: 'nonexistent-variant' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "centered" when variant not specified', () => {
            const result = HeroConfigSchema.parse(minimalHeroConfig())
            expect(result.variant).toBe('centered')
        })

        it('accepts optional videoUrl field', () => {
            const result = HeroConfigSchema.safeParse(
                minimalHeroConfig({ variant: 'split-video', videoUrl: 'https://example.com/vid.mp4' }),
            )
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.videoUrl).toBe('https://example.com/vid.mp4')
            }
        })

        it('accepts optional gradientPreset field with valid values', () => {
            const presets = ['aurora', 'sunset', 'ocean', 'forest'] as const
            for (const preset of presets) {
                const result = HeroConfigSchema.safeParse(
                    minimalHeroConfig({ variant: 'gradient', gradientPreset: preset }),
                )
                expect(result.success, `gradientPreset '${preset}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid gradientPreset', () => {
            const result = HeroConfigSchema.safeParse(
                minimalHeroConfig({ gradientPreset: 'invalid-preset' }),
            )
            expect(result.success).toBe(false)
        })

        it('accepts optional images[] array', () => {
            const result = HeroConfigSchema.safeParse(
                minimalHeroConfig({
                    variant: 'slideshow',
                    images: [
                        { url: 'https://example.com/1.jpg', alt: 'Image 1' },
                        { url: 'https://example.com/2.jpg' },
                    ],
                }),
            )
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.images).toHaveLength(2)
            }
        })

        it('backward compat — old config with variant="centered" still validates', () => {
            const legacyConfig = {
                blockType: 'hero',
                variant: 'centered',
                headline: 'Hello World',
                subheadline: 'Welcome',
                ctaButtons: [{ label: 'Get Started', url: '/signup', style: 'primary' }],
                image: { url: 'https://example.com/hero.jpg', alt: 'Hero' },
            }
            const result = HeroConfigSchema.safeParse(legacyConfig)
            expect(result.success).toBe(true)
        })

        it('backward compat — old config with variant="split-left" still validates', () => {
            const result = HeroConfigSchema.safeParse(
                minimalHeroConfig({ variant: 'split-left' }),
            )
            expect(result.success).toBe(true)
        })
    })

    describe('Meta', () => {
        it('has exactly 12 variants', () => {
            expect(heroMeta.variants).toHaveLength(12)
        })

        it('variants match schema enum', () => {
            for (const v of heroMeta.variants) {
                const result = HeroConfigSchema.safeParse(minimalHeroConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(heroMeta.type).toBe('hero')
        })

        it('defaultVariant is "centered"', () => {
            expect(heroMeta.defaultVariant).toBe('centered')
        })

        it('includes new editable fields', () => {
            expect(heroMeta.editableFields).toContain('videoUrl')
            expect(heroMeta.editableFields).toContain('gradientPreset')
            expect(heroMeta.editableFields).toContain('images')
        })
    })
})
