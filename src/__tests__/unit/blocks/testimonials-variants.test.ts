import { describe, it, expect } from 'vitest'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'

// ── TC-S2-006: Testimonials Block Variants ──────────────────────────────────

const TESTIMONIALS_VARIANTS = [
    'cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text',
] as const

const minimalTestimonialsConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'testimonials',
    headline: 'What Our Customers Say',
    testimonials: [
        { quote: 'Great product!', name: 'John Doe' },
        { quote: 'Amazing service!', name: 'Jane Smith' },
    ],
    ...overrides,
})

describe('[TC-S2-006] Testimonials Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 8 variants', () => {
            for (const v of TESTIMONIALS_VARIANTS) {
                const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "cards" when variant not specified', () => {
            const result = TestimonialsConfigSchema.parse(minimalTestimonialsConfig())
            expect(result.variant).toBe('cards')
        })

        it('accepts testimonial with full fields', () => {
            const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({
                testimonials: [{
                    quote: 'Excellent!',
                    name: 'Ahmad',
                    title: 'CEO',
                    company: 'Tech Corp',
                    rating: 5,
                    avatar: { url: 'https://example.com/avatar.jpg', alt: 'Ahmad' },
                }],
            }))
            expect(result.success).toBe(true)
        })

        it('validates rating between 1 and 5', () => {
            const valid = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({
                testimonials: [{ quote: 'Good', name: 'Test', rating: 3 }],
            }))
            expect(valid.success).toBe(true)

            const tooHigh = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({
                testimonials: [{ quote: 'Good', name: 'Test', rating: 6 }],
            }))
            expect(tooHigh.success).toBe(false)

            const tooLow = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({
                testimonials: [{ quote: 'Good', name: 'Test', rating: 0 }],
            }))
            expect(tooLow.success).toBe(false)
        })

        it('defaults testimonials to empty array when not provided', () => {
            const result = TestimonialsConfigSchema.parse({
                blockType: 'testimonials',
            })
            expect(result.testimonials).toEqual([])
        })
    })

    describe('Meta', () => {
        it('has exactly 10 variants', () => {
            expect(testimonialsMeta.variants).toHaveLength(10)
        })

        it('variants match schema enum', () => {
            for (const v of testimonialsMeta.variants) {
                const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(testimonialsMeta.type).toBe('testimonials')
        })

        it('defaultVariant is "cards"', () => {
            expect(testimonialsMeta.defaultVariant).toBe('cards')
        })
    })
})
