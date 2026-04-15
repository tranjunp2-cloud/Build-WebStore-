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

    it('TC-F01V-CR.05 — faq pool slice rotates by seed', () => {
        const firstQs = new Set<string>()
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            const block = buildBlockFromLibrary('faq', 'beauty', { seed })
            const items = block?.items as Array<{ question: string }> | undefined
            if (items?.[0]) firstQs.add(items[0].question)
        }
        expect(firstQs.size).toBeGreaterThanOrEqual(2)
    })
})

describe('padItems — seed-rotated padding (R5 fix)', () => {
    it('TC-F01V-CR.06 — different seeds produce different padded testimonials', () => {
        const firstPaddedNames = new Set<string>()
        for (const name of TEST_NAMES) {
            const seed = hashBusinessName(name)
            const padded = padItems('testimonials', [], 4, 'beauty', { seed }) as Array<{
                name: string
            }>
            if (padded[0]?.name) firstPaddedNames.add(padded[0].name)
        }
        // 10 seeds → ≥2 distinct first-padded names
        expect(firstPaddedNames.size).toBeGreaterThanOrEqual(2)
    })

    it('TC-F01V-CR.07 — existing items preserved before padding', () => {
        const existing = [{ name: 'Pre-existing', quote: 'Already here', rating: 5 }]
        const padded = padItems('testimonials', existing, 4, 'beauty', { seed: 42 })
        expect(padded[0]).toEqual(existing[0])
        expect(padded.length).toBe(4)
    })

    it('TC-F01V-CR.08 — same seed reproduces same padding (determinism)', () => {
        const a = padItems('testimonials', [], 4, 'beauty', { seed: 100 }) as Array<{
            name: string
        }>
        const b = padItems('testimonials', [], 4, 'beauty', { seed: 100 }) as Array<{
            name: string
        }>
        expect(a.map((x) => x.name)).toEqual(b.map((x) => x.name))
    })
})
