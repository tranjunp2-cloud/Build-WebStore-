/**
 * TC-F01-FA-01 — Fallback adapter end-to-end
 * Source: plans/260412-2156-ai-gen-website-audit/phase-06-step-4-shape-adapter.md
 */

import { describe, expect, it } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { ComposerCategory } from '@/lib/ai/composer-category-resolver'

const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

describe('composeFallbackResult — 14 categories', () => {
    const canonical: Array<[string, ComposerCategory]> = [
        ['Fine dining restaurant with seasonal menu', 'restaurant'],
        ['Online store selling handmade boutique jewelry', 'ecommerce'],
        ['Luxury spa salon with skincare treatments', 'beauty'],
        ['AI photo editing SaaS platform for creators', 'tech'],
        ['I want a site for my dental clinic in District 1', 'health'],
        ['English tuition academy for kindergarten students', 'education'],
        ['Real estate listings for condos in the city', 'realestate'],
        ['Yoga studio membership signup', 'fitness'],
        ['Portfolio site for a freelance illustrator', 'creative'],
        ['Consulting agency for corporate services', 'business'],
        ['Vietnamese coffee cafe brand online', 'fnb'],
        ['Wedding photography and event planning', 'events'],
        ['Travel tour operator with hotel packages', 'travel'],
        ['Personal blog newsletter for writers', 'blog'],
    ]

    for (const [prompt, category] of canonical) {
        it(`category=${category} produces valid GenerationResult`, () => {
            const result = composeFallbackResult(prompt, 42, 'en')

            expect(result.siteName).toBeTruthy()
            expect(result.blocks.length).toBeGreaterThan(0)
            expect(result.theme.primaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
            expect(result.theme.secondaryColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
            expect(ALLOWED_HEADING_FONTS).toContain(result.theme.fontHeading)
            expect(ALLOWED_BODY_FONTS).toContain(result.theme.fontBody)
            expect(['light', 'dark']).toContain(result.theme.colorMode)
            expect(result.seo.title.length).toBeGreaterThan(0)
            expect(result.seo.description.length).toBeLessThanOrEqual(161)
            expect(result.language).toBe('en')
        })
    }
})

describe('composeFallbackResult — behaviors', () => {
    it('extractedName overrides siteName and propagates to blocks', () => {
        const result = composeFallbackResult('dental clinic', 1, 'en', 'Smile Studio')
        expect(result.siteName).toBe('Smile Studio')
        // At least one block should reference the overridden name (hero/contact/footer).
        const blocksJson = JSON.stringify(result.blocks)
        expect(blocksJson).toContain('Smile Studio')
    })

    it('same prompt + same seed → identical result (deterministic)', () => {
        const a = composeFallbackResult('modern dental clinic', 42, 'en')
        const b = composeFallbackResult('modern dental clinic', 42, 'en')
        expect(a.siteName).toBe(b.siteName)
        expect(a.blocks.length).toBe(b.blocks.length)
        expect(a.theme).toEqual(b.theme)
    })

    it('different seed → potentially different preset (but valid)', () => {
        const a = composeFallbackResult('restaurant', 0, 'en')
        const b = composeFallbackResult('restaurant', 2, 'en')
        expect(a.blocks.length).toBeGreaterThan(0)
        expect(b.blocks.length).toBeGreaterThan(0)
    })

    it('language=vi propagates', () => {
        const result = composeFallbackResult('quán cafe indie', 1, 'vi')
        expect(result.language).toBe('vi')
    })

    it('pages array mirrors templateSeed pages', () => {
        const result = composeFallbackResult('restaurant', 0, 'en')
        expect(result.pages).toBeDefined()
        expect(result.pages!.length).toBeGreaterThan(0)
        expect(result.pages![0]!.isHomepage).toBe(true)
    })

    it('restaurant fallback emits at least one restaurant-appropriate block', () => {
        const ACCEPTABLE = new Set(['hero', 'features', 'testimonials', 'faq', 'cta', 'stats', 'team', 'pricing', 'menu-food'])
        const blockTypes = new Set<string>()
        for (let seed = 0; seed < 4; seed++) {
            const result = composeFallbackResult('restaurant', seed, 'en')
            for (const block of result.blocks) {
                blockTypes.add(block.blockType as string)
            }
        }
        const hasAny = [...ACCEPTABLE].some((t) => blockTypes.has(t))
        expect(hasAny).toBe(true)
    })

    it('zero-keyword prompt → business category fallback works', () => {
        const result = composeFallbackResult('something generic', 0, 'en')
        expect(result.siteType).toBe('business')
        expect(result.blocks.length).toBeGreaterThan(0)
    })

    it('drops unsupported blocks from fallback output (fc0020d regression fix)', () => {
        // Health seed 7 previously emitted booking-widget; must not leak through.
        // review-cards drops on all gen paths (media pipeline required).
        // Note: before-after, booking-widget re-enabled via plan 260422-1900-block-aivisible-audit-fix.
        // Note: gallery + portfolio-grid re-enabled via plan 260414-1400 Unsplash pipeline.
        // Note: menu-display re-hidden via GH-1024 — use menu-food for restaurants.
        const UNSUPPORTED = new Set([
            'review-cards',
        ])

        const scenarios: Array<[string, number]> = [
            ['dental clinic', 7],
            ['crossfit gym', 11],
            ['wedding photographer portfolio', 5],
            ['italian restaurant', 42],
        ]

        for (const [prompt, seed] of scenarios) {
            const result = composeFallbackResult(prompt, seed, 'en')
            for (const block of result.blocks) {
                expect(UNSUPPORTED.has(block.blockType as string)).toBe(false)
            }
            for (const page of result.pages ?? []) {
                for (const block of page.blocks) {
                    expect(UNSUPPORTED.has(block.blockType as string)).toBe(false)
                }
            }
        }
    })
})
