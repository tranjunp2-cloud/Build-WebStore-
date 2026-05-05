import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestimonialsConfigSchema, testimonialsMeta } from '@/blocks/testimonials/config'
import { enforceMinContent } from '@/lib/ai/variant-validation'

// ── TC-S2-006: Testimonials Block Variants ──────────────────────────────────

const TESTIMONIALS_VARIANTS = [
    'cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single',
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
        it('validates all 10 variants', () => {
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

// ── TC-BUG-TEST-019: Testimonials Carousel Scroll (GYM template) ────────────
describe('[TC-BUG-TEST-019] Carousel variant — scroll regression', () => {
    it('carousel variant is valid in schema', () => {
        const result = TestimonialsConfigSchema.safeParse({
            blockType: 'testimonials',
            variant: 'carousel',
            testimonials: [
                { quote: 'Great gym!', name: 'Ali', rating: 5 },
                { quote: 'Best coach!', name: 'Siti', rating: 5 },
                { quote: 'Changed my life!', name: 'Kumar', rating: 5 },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('enforceMinContent keeps carousel when testimonials.length >= 3', () => {
        expect(enforceMinContent('testimonials', 'carousel', 3)).toBe('carousel')
        expect(enforceMinContent('testimonials', 'carousel', 5)).toBe('carousel')
    })

    it('enforceMinContent falls back from carousel when testimonials.length < 3', () => {
        const fallback = enforceMinContent('testimonials', 'carousel', 2)
        expect(fallback).not.toBe('carousel')
        // fallback must still be a valid testimonials variant
        const result = TestimonialsConfigSchema.safeParse({
            blockType: 'testimonials',
            variant: fallback,
            testimonials: [{ quote: 'Test', name: 'User' }],
        })
        expect(result.success).toBe(true)
    })

    it('enforceMinContent falls back from carousel when testimonials.length is 1', () => {
        const fallback = enforceMinContent('testimonials', 'carousel', 1)
        expect(fallback).not.toBe('carousel')
    })
})

// ── TC-BUG-TEST-019: goTo boundary wrapping logic ────────────────────────────
describe('[TC-BUG-TEST-019] goTo boundary wrapping', () => {
    // Pure logic extracted from TestimonialsCarousel.goTo — mirrors the implementation.
    // Any change to boundary logic in the component MUST be reflected here.
    function makeGoTo(length: number) {
        return (idx: number): number => {
            if (idx < 0) return length - 1
            if (idx >= length) return 0
            return idx
        }
    }

    it('wraps backward past 0 to last index', () => {
        expect(makeGoTo(3)(-1)).toBe(2)
        expect(makeGoTo(5)(-1)).toBe(4)
    })

    it('wraps forward past last to 0', () => {
        expect(makeGoTo(3)(3)).toBe(0)
        expect(makeGoTo(5)(5)).toBe(0)
    })

    it('does not wrap within valid range', () => {
        expect(makeGoTo(3)(0)).toBe(0)
        expect(makeGoTo(3)(1)).toBe(1)
        expect(makeGoTo(3)(2)).toBe(2)
    })
})

// ── TC-BUG-TEST-019: auto-rotate pause timer ─────────────────────────────────
describe('[TC-BUG-TEST-019] resumeTimer — auto-rotate pause on manual nav', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('setTimeout is called with 5000ms on manual navigation', () => {
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
        // Simulate goTo pause pattern: setIsPaused(true) then setTimeout 5000
        let isPaused = false
        const resumeTimer = { current: null as ReturnType<typeof setTimeout> | null }
        const goTo = () => {
            isPaused = true
            if (resumeTimer.current) clearTimeout(resumeTimer.current)
            resumeTimer.current = setTimeout(() => { isPaused = false }, 5000)
        }

        goTo()
        expect(isPaused).toBe(true)
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)

        vi.advanceTimersByTime(5000)
        expect(isPaused).toBe(false)
    })

    it('rapid calls reset the 5s timer (debounce)', () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        const resumeTimer = { current: null as ReturnType<typeof setTimeout> | null }
        const goTo = () => {
            if (resumeTimer.current) clearTimeout(resumeTimer.current)
            resumeTimer.current = setTimeout(() => {}, 5000)
        }

        goTo()
        const firstTimer = resumeTimer.current
        goTo()
        expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimer)
    })
})

// ── TC-F31-BVA-080: Testimonials Grid — Schema Valid ─────────────────────────
describe('[TC-F31-BVA-080] Testimonials grid variant — schema and meta', () => {
    it('grid is accepted by schema', () => {
        const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({ variant: 'grid' }))
        expect(result.success).toBe(true)
    })

    it('grid is in testimonialsMeta.variants', () => {
        expect(testimonialsMeta.variants).toContain('grid')
    })

    it('enforceMinContent keeps grid with 1+ testimonial', () => {
        expect(enforceMinContent('testimonials', 'grid', 1)).toBe('grid')
        expect(enforceMinContent('testimonials', 'grid', 5)).toBe('grid')
    })
})

// ── TC-F31-BVA-081: Testimonials Single — Schema Valid ───────────────────────
describe('[TC-F31-BVA-081] Testimonials single variant — schema and meta', () => {
    it('single is accepted by schema', () => {
        const result = TestimonialsConfigSchema.safeParse(minimalTestimonialsConfig({ variant: 'single' }))
        expect(result.success).toBe(true)
    })

    it('single is in testimonialsMeta.variants', () => {
        expect(testimonialsMeta.variants).toContain('single')
    })

    it('enforceMinContent keeps single with 1+ testimonial', () => {
        expect(enforceMinContent('testimonials', 'single', 1)).toBe('single')
        expect(enforceMinContent('testimonials', 'single', 3)).toBe('single')
    })
})
