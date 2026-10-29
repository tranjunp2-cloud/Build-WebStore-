/**
 * TC-F01V-CR — Content library rotation (Phase 03 R4 + R5)
 * Source: plans/260414-2253-ai-gen-variety-root-cause/phase-03-content-library-rotation.md
 *
 * Verifies buildBlockFromLibrary rotates BusinessSample + testimonials +
 * FAQs by seed so same-category businesses don't inject identical content,
 * and padItems rotates its pool offset per-seed.
 */

import { describe, expect, it } from 'vitest'
import { buildBlockFromLibrary, padItems } from '@/lib/ai/content-injection'
import { hashBusinessName } from '@/lib/ai/category-theme-picker'

const TEST_NAMES = [
    'Farah Glow Spa', 'Priya Nails', 'Zen Hair Studio', 'Bloom Beauty',
    'Rose Petal Salon', 'Lotus Massage', 'Glam Studio', 'Bella Skin',
    'Orchid Wellness', 'Jade Beauty',
]

describe('buildBlockFromLibrary — business rotation (R4 fix)', () => {
    it('TC-F01V-CR.01 — different seeds pick different BusinessSample for hero headline', () => {
        const headlines = new Set<string>()
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            const hero = buildBlockFromLibrary('hero', 'beauty', { seed })
            if (hero?.headline) headlines.add(String(hero.headline))
        }
        // 10 distinct seeds → expect ≥3 distinct headlines (pool has 3-5 businesses)
        expect(headlines.size).toBeGreaterThanOrEqual(3)
    })

    it('TC-F01V-CR.02 — same seed reproduces same business (determinism)', () => {
        const seed = hashBusinessName('Consistent Business')
        const hero1 = buildBlockFromLibrary('hero', 'beauty', { seed })
        const hero2 = buildBlockFromLibrary('hero', 'beauty', { seed })
        expect(hero1?.headline).toBe(hero2?.headline)
    })

    it('TC-F01V-CR.03 — about block body rotates by seed', () => {
        const bodies = new Set<string>()
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            const about = buildBlockFromLibrary('about', 'beauty', { seed, businessName: name })
            if (about?.body) bodies.add(String(about.body))
        }
        expect(bodies.size).toBeGreaterThanOrEqual(3)
    })
})

describe('buildBlockFromLibrary — testimonials/faq rotation (R5 fix)', () => {
    it('TC-F01V-CR.04 — testimonials pool slice rotates by seed', () => {
        const firstQuotes = new Set<string>()
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            const block = buildBlockFromLibrary('testimonials', 'beauty', { seed })
            const testimonials = block?.testimonials as Array<{ quote: string }> | undefined
            if (testimonials?.[0]) firstQuotes.add(testimonials[0].quote)
        }
        // 10 seeds on a pool of N testimonials → expect at least 2 distinct first quotes
        expect(firstQuotes.size).toBeGreaterThanOrEqual(2)
    })

    it('TC-F01V-CR.05 — faq has no rotating library pool: without facts nothing is injected (#2103)', () => {
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            expect(buildBlockFromLibrary('faq', 'beauty', { seed })).toBeNull()
        }
    })
})

describe('padItems — never pads real facts with invented items (#2103 A1)', () => {
    it('TC-F01V-CR.06 — testimonials / faq / team / stats / pricing / logo-cloud are not padded', () => {
        for (const bt of ['testimonials', 'faq', 'team', 'stats', 'pricing', 'logo-cloud', 'client-logos']) {
            for (const name of TEST_NAMES) {
                const seed = hashBusinessName(name)
                expect(padItems(bt, [], 4, 'beauty', { seed }), `${bt}/${name}`).toEqual([])
            }
        }
    })

    it('TC-F01V-CR.07 — existing items preserved and left as they are (no padding)', () => {
        const existing = [{ name: 'Pre-existing', quote: 'Already here', rating: 5 }]
        const padded = padItems('testimonials', existing, 4, 'beauty', { seed: 42 })
        expect(padded).toEqual(existing)
    })

    it('TC-F01V-CR.08 — same seed reproduces same result (determinism)', () => {
        const a = padItems('features', [], 4, 'beauty', { seed: 100 })
        const b = padItems('features', [], 4, 'beauty', { seed: 100 })
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })

    it('TC-AIAUD-027 — features may still be padded (product/description based, claim-free)', () => {
        const padded = padItems('features', [{ title: 'Kek lapis', description: 'RM 65', icon: 'Cake' }], 3, 'fnb', { seed: 1 })
        expect(padded.length).toBeGreaterThan(1)
        expect(JSON.stringify(padded)).not.toMatch(/halal|jakim|certified/i)
    })
})
