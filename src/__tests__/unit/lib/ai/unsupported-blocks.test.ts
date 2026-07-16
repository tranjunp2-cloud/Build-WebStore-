/**
 * TC-F01-UB-01 — Unsupported blocks drop list
 * Shared between happy path (openai-generator) and fallback path (fallback-adapter).
 * Source: plan-2156 phase-06 regression fix (fc0020d + 9bf02d4 interaction).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
    BLOCKS_REQUIRE_MEDIA_PIPELINE,
    BLOCKS_NOT_IN_PAYLOAD,
    BLOCKS_TEMP_HIDDEN,
    isUnsupportedBlock,
    filterUnsupportedBlocks,
} from '@/lib/ai/unsupported-blocks'

describe('isUnsupportedBlock', () => {
    it('returns true for every block in MEDIA_PIPELINE list', () => {
        for (const t of BLOCKS_REQUIRE_MEDIA_PIPELINE) {
            expect(isUnsupportedBlock(t)).toBe(true)
        }
    })

    it('returns true for every block in NOT_IN_PAYLOAD list', () => {
        for (const t of BLOCKS_NOT_IN_PAYLOAD) {
            expect(isUnsupportedBlock(t)).toBe(true)
        }
    })

    it('menu-display, property-card, pricing-table are in BLOCKS_TEMP_HIDDEN [TC-F01-UB-01]', () => {
        expect(BLOCKS_TEMP_HIDDEN.has('menu-display')).toBe(true)
        expect(BLOCKS_TEMP_HIDDEN.has('property-card')).toBe(true)
        expect(BLOCKS_TEMP_HIDDEN.has('pricing-table')).toBe(true)
    })

    it('isUnsupportedBlock returns true for GH-1024 hidden blocks', () => {
        expect(isUnsupportedBlock('menu-display')).toBe(true)
        expect(isUnsupportedBlock('property-card')).toBe(true)
        expect(isUnsupportedBlock('pricing-table')).toBe(true)
    })

    it('returns false for supported blocks', () => {
        for (const t of ['hero', 'navigation', 'footer', 'faq', 'features', 'pricing', 'testimonials']) {
            expect(isUnsupportedBlock(t)).toBe(false)
        }
    })

    it('returns false for empty / unknown', () => {
        expect(isUnsupportedBlock('')).toBe(false)
        expect(isUnsupportedBlock('totally-made-up')).toBe(false)
    })
})

describe('filterUnsupportedBlocks', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('drops unsupported + keeps supported in order', () => {
        const input = [
            { blockType: 'hero' },
            { blockType: 'review-cards' },
            { blockType: 'features' },
            { blockType: 'footer' },
        ]
        const out = filterUnsupportedBlocks(input, 'fallback')
        expect(out).toEqual([
            { blockType: 'hero' },
            { blockType: 'features' },
            { blockType: 'footer' },
        ])
        expect(warnSpy).toHaveBeenCalledTimes(1)
    })

    it('replaces unsupported blocks with supported equivalents when mapped', () => {
        const input = [
            {
                blockType: 'menu-display',
                headline: 'Our Menu',
                currency: 'USD',
                categories: [
                    {
                        name: 'Drinks',
                        items: [
                            { name: 'Coffee', price: 5, isPopular: true }
                        ]
                    }
                ]
            },
            {
                blockType: 'booking-widget',
                headline: 'Book Doctor',
                services: [
                    { name: 'Consultation', duration: 15, price: 100 }
                ]
            },
            {
                blockType: 'pricing-table',
                headline: 'Pricing plans',
                plans: [
                    { name: 'Pro', price: '29', features: ['Unlimited storage'], cta: { label: 'Go', url: '/go' } }
                ]
            },
        ]
        const out = filterUnsupportedBlocks(input, 'fallback')
        expect(out[0]).toEqual({
            blockType: 'menu-food',
            variant: 'classic',
            headline: 'Our Menu',
            categories: [
                {
                    name: 'Drinks',
                    items: [
                        { name: 'Coffee', description: '', price: '5', currency: 'USD', tag: 'Popular', image: undefined }
                    ]
                }
            ]
        })
        expect(out[1]).toEqual({
            blockType: 'contact',
            variant: 'simple',
            headline: 'Book Doctor',
            subtext: 'Available Services:\nConsultation (15 mins) - 100 RM'
        })
        expect(out[2]).toEqual({
            blockType: 'pricing',
            variant: 'cards',
            headline: 'Pricing plans',
            subheadline: undefined,
            plans: [
                {
                    name: 'Pro',
                    price: '29',
                    yearlyPrice: undefined,
                    description: undefined,
                    features: [{ text: 'Unlimited storage', included: true }],
                    ctaLabel: 'Go',
                    ctaUrl: '/go',
                    highlighted: false
                }
            ]
        })
        expect(warnSpy).toHaveBeenCalledTimes(3)
    })

    it('converts property-card, social-proof, and before-after with high fidelity schema mapping', () => {
        const input = [
            {
                blockType: 'property-card',
                headline: 'Featured Properties',
                currency: 'RM',
                properties: [
                    { title: 'Villa A', price: 500000, location: 'KL', bedrooms: 3, bathrooms: 2, area: 1500, type: 'sale' }
                ]
            },
            {
                blockType: 'social-proof',
                headline: 'What users say',
                reviews: [
                    { author: 'Alice', content: 'Great service', rating: 5 }
                ]
            },
            {
                blockType: 'before-after',
                headline: 'Transformation',
                beforeImage: { url: '/before.png', alt: 'Before transformation', label: 'Start' },
                afterImage: { url: '/after.png', alt: 'After transformation', label: 'Finish' }
            }
        ]
        const out = filterUnsupportedBlocks(input, 'ai')
        expect(out[0]).toEqual({
            blockType: 'service-cards',
            variant: undefined,
            headline: 'Featured Properties',
            subheadline: undefined,
            services: [
                {
                    title: 'Villa A',
                    description: '3 Bed, 2 Bath, 1500 sqft, Location: KL',
                    icon: '🏠',
                    price: '500000',
                    priceUnit: 'RM'
                }
            ]
        })
        expect(out[1]).toEqual({
            blockType: 'testimonials',
            variant: undefined,
            headline: 'What users say',
            subheadline: undefined,
            testimonials: [
                {
                    quote: 'Great service',
                    name: 'Alice',
                    title: '',
                    rating: 5,
                    avatar: undefined
                }
            ]
        })
        expect(out[2]).toEqual({
            blockType: 'gallery',
            variant: 'grid',
            headline: 'Transformation',
            images: [
                { image: { url: '/before.png', alt: 'Before transformation' }, caption: 'Start' },
                { image: { url: '/after.png', alt: 'After transformation' }, caption: 'Finish' }
            ]
        })
    })

    it('logs fallback prefix when context="fallback"', () => {
        filterUnsupportedBlocks([{ blockType: 'review-cards' }], 'fallback')
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback]'))
    })

    it('logs AI prefix when context="ai"', () => {
        filterUnsupportedBlocks([{ blockType: 'review-cards' }], 'ai')
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[AI]'))
    })

    it('drops blocks with missing/invalid blockType', () => {
        const input = [
            { blockType: 'hero' },
            { blockType: '' },
            { notBlockType: 'x' } as unknown as { blockType?: string },
        ]
        const out = filterUnsupportedBlocks(input, 'ai')
        expect(out).toEqual([{ blockType: 'hero' }])
    })
})
