/**
 * TC-F01V-VM — Variety measurement metric functions (Phase 04)
 * Source: plans/260414-2253-ai-gen-variety-root-cause/phase-04-variety-measurement.md
 *
 * Offline unit tests for the 5 metric functions in scripts/measure-variety.ts.
 * Uses mocked GenResult arrays — no dev server or API calls.
 */

import { describe, expect, it } from 'vitest'
import {
    computeVariantShare,
    computeSkeletonEntropy,
    computeContentCollision,
    computeThemeDistribution,
    computeImageUniqueness,
    type GenResult,
} from '../../../../../scripts/measure-variety'

function fakeGen(
    overrides: Partial<GenResult> & {
        heroVariant?: string
        heroImage?: number | string | null
        testimonialQuotes?: string[]
        primaryColor?: string
        fontPairingId?: string
    } = {},
): GenResult {
    return {
        siteName: overrides.siteName ?? 'Test Business',
        blocks: overrides.blocks ?? [
            { blockType: 'navigation', variant: 'pill' },
            {
                blockType: 'hero',
                variant: overrides.heroVariant ?? 'gradient',
                image: overrides.heroImage ?? 42,
            },
            {
                blockType: 'testimonials',
                variant: 'cards',
                testimonials: (overrides.testimonialQuotes ?? ['Default quote']).map((q) => ({
                    quote: q,
                    name: 'Customer',
                })),
            },
            { blockType: 'footer', variant: 'simple' },
        ],
        theme: {
            primaryColor: overrides.primaryColor ?? '#0ea5e9',
            fontPairingId: overrides.fontPairingId ?? 'modern-clean',
        },
    }
}

describe('computeVariantShare', () => {
    it('TC-F01V-VM.01 — detects dominant variant collapse', () => {
        const results = Array.from({ length: 20 }, () => fakeGen({ heroVariant: 'gradient' }))
        const shares = computeVariantShare(results)
        expect(shares.hero?.top).toBe('gradient')
        expect(shares.hero?.share).toBe(1.0)
        expect(shares.hero?.distinct).toBe(1)
    })

    it('TC-F01V-VM.02 — counts distinct variants across results', () => {
        const results = [
            fakeGen({ heroVariant: 'gradient' }),
            fakeGen({ heroVariant: 'split-left' }),
            fakeGen({ heroVariant: 'magazine' }),
            fakeGen({ heroVariant: 'gradient' }),
        ]
        const shares = computeVariantShare(results)
        expect(shares.hero?.distinct).toBe(3)
        expect(shares.hero?.share).toBe(0.5) // gradient 2/4
    })
})

describe('computeSkeletonEntropy', () => {
    it('TC-F01V-VM.03 — reports 1 when all skeletons identical', () => {
        const results = Array.from({ length: 10 }, () => fakeGen())
        const e = computeSkeletonEntropy(results)
        expect(e.distinct).toBe(1)
    })

    it('TC-F01V-VM.04 — counts distinct block sequences', () => {
        const results: GenResult[] = [
            fakeGen(),
            {
                siteName: 'B',
                blocks: [
                    { blockType: 'navigation', variant: 'pill' },
                    { blockType: 'hero', variant: 'split-left' },
                    { blockType: 'features', variant: 'grid-3' },
                    { blockType: 'footer', variant: 'simple' },
                ],
            },
        ]
        const e = computeSkeletonEntropy(results)
        expect(e.distinct).toBe(2)
    })
})

describe('computeContentCollision', () => {
    it('TC-F01V-VM.05 — 0% when all quotes unique', () => {
        const results = [
            fakeGen({ testimonialQuotes: ['Quote A'] }),
            fakeGen({ testimonialQuotes: ['Quote B'] }),
            fakeGen({ testimonialQuotes: ['Quote C'] }),
        ]
        const c = computeContentCollision(results)
        expect(c.testimonialOverlapPct).toBe(0)
    })

    it('TC-F01V-VM.06 — high overlap when same quotes repeat', () => {
        const results = [
            fakeGen({ testimonialQuotes: ['Same quote'] }),
            fakeGen({ testimonialQuotes: ['Same quote'] }),
            fakeGen({ testimonialQuotes: ['Same quote'] }),
        ]
        const c = computeContentCollision(results)
        expect(c.testimonialOverlapPct).toBe(100)
    })
})

describe('computeThemeDistribution', () => {
    it('TC-F01V-VM.07 — counts distinct (color, font) combos', () => {
        const results = [
            fakeGen({ primaryColor: '#ff0000', fontPairingId: 'modern-clean' }),
            fakeGen({ primaryColor: '#00ff00', fontPairingId: 'modern-clean' }),
            fakeGen({ primaryColor: '#ff0000', fontPairingId: 'modern-clean' }),
            fakeGen({ primaryColor: '#0000ff', fontPairingId: 'elegant-serif' }),
        ]
        const t = computeThemeDistribution(results)
        expect(t.distinctCombos).toBe(3)
    })
})

describe('computeImageUniqueness', () => {
    it('TC-F01V-VM.08 — counts distinct hero image ids', () => {
        const results = [
            fakeGen({ heroImage: 1 }),
            fakeGen({ heroImage: 2 }),
            fakeGen({ heroImage: 3 }),
            fakeGen({ heroImage: 1 }),
        ]
        const i = computeImageUniqueness(results)
        expect(i.distinctHeroImages).toBe(3)
    })

    it('TC-F01V-VM.09 — ignores empty/null image fields', () => {
        const results = [
            fakeGen({ heroImage: null }),
            fakeGen({ heroImage: '' }),
            fakeGen({ heroImage: 42 }),
        ]
        const i = computeImageUniqueness(results)
        expect(i.distinctHeroImages).toBe(1)
    })
})
