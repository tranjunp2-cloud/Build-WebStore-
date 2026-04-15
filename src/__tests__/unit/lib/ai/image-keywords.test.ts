import { describe, it, expect } from 'vitest'
import {
    deriveKeywords,
    translateIndustryToEn,
    fallbackBroaden,
    CATEGORY_BASE_KEYWORDS,
    BLOCK_MODIFIER_KEYWORDS,
    VN_TO_EN_FALLBACKS,
    MS_TO_EN_FALLBACKS,
} from '@/lib/ai/image-keywords'

describe('image-keywords [plan-260414-unsplash]', () => {
    describe('CATEGORY_BASE_KEYWORDS coverage', () => {
        const CATEGORIES = [
            'restaurant', 'beauty', 'tech', 'health', 'education',
            'fitness', 'creative', 'business', 'fnb', 'realestate',
            'events', 'blog', 'travel', 'ecommerce',
        ]

        it.each(CATEGORIES)('has base keywords for category "%s"', (cat) => {
            expect(CATEGORY_BASE_KEYWORDS[cat]).toBeDefined()
            expect(CATEGORY_BASE_KEYWORDS[cat]!.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('BLOCK_MODIFIER_KEYWORDS coverage', () => {
        it('has modifiers for key block types', () => {
            expect(BLOCK_MODIFIER_KEYWORDS.team).toBeDefined()
            expect(BLOCK_MODIFIER_KEYWORDS.testimonials).toBeDefined()
            expect(BLOCK_MODIFIER_KEYWORDS.gallery).toBeDefined()
        })
    })

    describe('MS_TO_EN_FALLBACKS (Malaysia market primary)', () => {
        it('has ≥20 Malay entries', () => {
            expect(Object.keys(MS_TO_EN_FALLBACKS).length).toBeGreaterThanOrEqual(20)
        })

        it('maps "restoran" to restaurant', () => {
            expect(MS_TO_EN_FALLBACKS.restoran).toContain('restaurant')
        })

        it('maps "kedai kopi" to coffee shop', () => {
            expect(MS_TO_EN_FALLBACKS['kedai kopi']).toContain('coffee')
        })
    })

    describe('VN_TO_EN_FALLBACKS (team QA only)', () => {
        it('has ≥20 Vietnamese entries', () => {
            expect(Object.keys(VN_TO_EN_FALLBACKS).length).toBeGreaterThanOrEqual(20)
        })

        it('maps "nhà hàng" to restaurant', () => {
            expect(VN_TO_EN_FALLBACKS['nhà hàng']).toContain('restaurant')
        })
    })

    describe('translateIndustryToEn', () => {
        it('returns empty string for undefined input', () => {
            expect(translateIndustryToEn(undefined)).toBe('')
        })

        it('preserves pure ASCII English input', () => {
            expect(translateIndustryToEn('modern cafe')).toBe('modern cafe')
        })

        it('translates MS input to EN (primary market)', () => {
            const result = translateIndustryToEn('kedai kopi specialty')
            expect(result).toContain('coffee')
        })

        it('translates VN input to EN when language=vi', () => {
            const result = translateIndustryToEn('nhà hàng phở', 'vi')
            expect(result).toContain('restaurant')
        })

        it('prefers MS table when language not specified (Malaysia market)', () => {
            // "restoran" exists in MS but not VN → should match MS
            const result = translateIndustryToEn('restoran halal')
            expect(result).toContain('restaurant')
        })
    })

    describe('deriveKeywords', () => {
        it('returns keywords for known category + block', () => {
            const result = deriveKeywords('beauty', 'hero', {})
            expect(result.length).toBeGreaterThanOrEqual(1)
            expect(result.every((k) => k.length > 0)).toBe(true)
        })

        it('uses fallback for unknown category', () => {
            const result = deriveKeywords('unknown-cat', 'hero', {})
            expect(result.length).toBeGreaterThanOrEqual(1)
        })

        it('includes block modifier when defined', () => {
            const result = deriveKeywords('beauty', 'team', {})
            const joined = result.join(' ')
            expect(joined.toLowerCase()).toMatch(/portrait|headshot/)
        })

        it('includes industry boost when provided', () => {
            const result = deriveKeywords('beauty', 'hero', { industry: 'restoran' })
            const joined = result.join(' ')
            expect(joined.toLowerCase()).toContain('restaurant')
        })

        it('produces variety across multiple calls (randomization)', () => {
            const seen = new Set<string>()
            for (let i = 0; i < 50; i++) {
                seen.add(deriveKeywords('beauty', 'hero', {}).join('|'))
            }
            expect(seen.size).toBeGreaterThanOrEqual(2)
        })
    })

    describe('fallbackBroaden', () => {
        it('drops last keyword when multiple', () => {
            expect(fallbackBroaden(['spa', 'wellness', 'detail'])).toEqual(['spa', 'wellness'])
        })

        it('preserves single keyword', () => {
            expect(fallbackBroaden(['spa'])).toEqual(['spa'])
        })

        it('handles empty array', () => {
            expect(fallbackBroaden([])).toEqual([])
        })
    })
})
