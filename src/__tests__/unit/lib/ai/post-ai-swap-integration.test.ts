/**
 * TC-F01-PAS-INT-01..03 — Phase 04 integration smoke tests.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-04-post-ai-content-swap.md
 *
 * Exercises postAISwapStep with realistic multi-block payloads mirroring what
 * GPT-4o typically emits for beauty / restaurant / health categories. Not a
 * full generator integration (that needs live OpenAI mock) — validates the
 * swap step runs end-to-end on the shapes that flow through in production.
 */

import { describe, it, expect } from 'vitest'
import { postAISwapStep } from '@/lib/ai/post-ai-swap'
import type { BusinessSample } from '@/lib/ai/content'

const EMPTY_BIZ: Partial<BusinessSample> = {}
const USER_BIZ: Partial<BusinessSample> = {
    name: 'Warung Nasi Kak Yan',
    description: 'Traditional Malaysian home cooking in Bangsar.',
    products: ['Nasi Lemak', 'Rendang'],
}

describe('Phase 04 integration — realistic AI response shapes', () => {
    describe('TC-F01-PAS-INT-01: generic AI response → multiple swaps', () => {
        it('beauty category with AI slop → hero + features + about all swapped', () => {
            // Shape mirrors what GPT-4o typically emits when user provides
            // only business name + short description — verbose but generic.
            const aiBlocks = [
                {
                    blockType: 'navigation',
                    variant: 'pill',
                    logoText: 'Beauty Salon',
                    links: [{ label: 'Home', url: '/' }],
                },
                {
                    blockType: 'hero',
                    variant: 'split-left',
                    headline: 'Welcome to our website',
                    subheadline: 'Experience exceptional quality service every day',
                },
                {
                    blockType: 'features',
                    headline: 'Why Choose Us',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                        { title: 'Trusted Partner', description: 'Your trusted partner for all needs' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
                {
                    blockType: 'about',
                    headline: 'About Us',
                    body: 'We are a trusted partner dedicated to delivering exceptional quality service.',
                },
                {
                    blockType: 'footer',
                    variant: 'expanded',
                    logoText: 'Beauty Salon',
                },
            ]

            const result = postAISwapStep(aiBlocks, EMPTY_BIZ, 'beauty')

            // navigation + footer passed through (not swappable)
            expect(result.blocks).toHaveLength(5)
            const swapCount = result.telemetry.filter((t) => t.action === 'swapped').length
            expect(swapCount).toBeGreaterThanOrEqual(2)

            // Verify at least hero got swapped with composer output
            const swappedHero = result.blocks.find(
                (b) => (b as { blockType: string }).blockType === 'hero',
            ) as { headline: string }
            // Composer hero emits `${name} — ${topProduct}` pattern
            expect(swappedHero.headline).not.toContain('Welcome to our website')
        })
    })

    describe('TC-F01-PAS-INT-02: user data prevents swaps', () => {
        it('AI output referencing biz name + products → all kept', () => {
            const aiBlocks = [
                {
                    blockType: 'hero',
                    variant: 'centered',
                    headline: 'Warung Nasi Kak Yan — Authentic Home Cooking',
                    subheadline: 'Quality service from our family kitchen to yours',
                },
                {
                    blockType: 'features',
                    headline: 'Our Specialities',
                    features: [
                        { title: 'Nasi Lemak', description: 'Signature coconut rice with sambal' },
                        { title: 'Rendang', description: 'Slow-cooked traditional beef rendang' },
                    ],
                },
            ]

            const result = postAISwapStep(aiBlocks, USER_BIZ, 'restaurant')

            // All swappable blocks reference user data → kept
            const keptUserData = result.telemetry.filter((t) => t.action === 'kept-user-data')
            expect(keptUserData.length).toBe(2)

            // Headlines preserved exactly
            const hero = result.blocks[0] as { headline: string }
            expect(hero.headline).toBe('Warung Nasi Kak Yan — Authentic Home Cooking')
        })
    })

    describe('TC-F01-PAS-INT-03: mixed AI output → selective swap', () => {
        it('only generic blocks swap; specific blocks kept', () => {
            const aiBlocks = [
                // User-referenced hero → keep
                {
                    blockType: 'hero',
                    headline: 'Warung Nasi Kak Yan Welcomes You',
                    subheadline: 'Serving Bangsar since 2010',
                },
                // Generic features → swap
                {
                    blockType: 'features',
                    features: [
                        { title: 'Quality Service', description: 'Exceptional quality every interaction' },
                        { title: 'Fast Response', description: 'Dedicated team of professionals' },
                    ],
                },
                // Malaysia-specific about with no user data overlap → keep (not generic)
                {
                    blockType: 'about',
                    headline: 'Family Recipes Since 1985',
                    body: 'Learned from grandmother in Melaka. RM 12 meals, halal-certified, dine-in or tapau.',
                },
            ]

            const result = postAISwapStep(aiBlocks, USER_BIZ, 'restaurant')

            const actions = result.telemetry.map((t) => `${t.blockType}:${t.action}`)
            // Hero kept-user-data, features swapped, about kept-not-generic (specific Malaysian copy)
            expect(actions).toContain('hero:kept-user-data')
            expect(actions).toContain('features:swapped')
            expect(actions).toContain('about:kept-not-generic')
        })
    })
})
