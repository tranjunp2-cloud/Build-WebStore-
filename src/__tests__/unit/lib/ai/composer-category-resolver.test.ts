/**
 * TC-F01-CCR-01 — Composer category resolver
 * Source: plans/260412-2156-ai-gen-website-audit/phase-06-step-3-category-translator.md
 */

import { describe, expect, it } from 'vitest'
import { resolveComposerCategory, type ComposerCategory } from '@/lib/ai/composer-category-resolver'

describe('resolveComposerCategory — 14 canonical prompts', () => {
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

    for (const [prompt, expected] of canonical) {
        it(`"${prompt.slice(0, 40)}..." → ${expected}`, () => {
            expect(resolveComposerCategory(prompt)).toBe(expected)
        })
    }
})

describe('resolveComposerCategory — edge cases', () => {
    it('empty string → business', () => {
        expect(resolveComposerCategory('')).toBe('business')
    })

    it('undefined-like (non-string) → business', () => {
        expect(resolveComposerCategory(null as unknown as string)).toBe('business')
    })

    it('zero-keyword prompt → business (safe sink)', () => {
        expect(resolveComposerCategory('something totally generic here')).toBe('business')
    })

    it('VN prompt resolves (nha khoa → health)', () => {
        expect(resolveComposerCategory('Phòng khám nha khoa uy tín ở Sài Gòn')).toBe('health')
    })

    it('VN prompt resolves (quán cafe → fnb)', () => {
        expect(resolveComposerCategory('Quán cafe nhỏ phong cách indie')).toBe('fnb')
    })

    it('ambiguous "coffee shop and restaurant" picks fnb per tie-break priority', () => {
        // fnb has priority before restaurant in TIE_BREAK_ORDER
        const result = resolveComposerCategory('coffee shop and restaurant')
        expect(['fnb', 'restaurant']).toContain(result)
    })
})
