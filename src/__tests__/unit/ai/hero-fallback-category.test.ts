/**
 * TC-F01-W.51 — hero fallback URL resolves per industry category (GH-1185)
 *
 * Before this fix: ALL businesses got the same hardcoded office-hallway photo
 * (photo-1497366216548) when Unsplash search failed.
 * After: `pickHeroFallbackUrl` resolves ctx.category → industry-specific photo.
 */
import { describe, it, expect } from 'vitest'
import {
    pickHeroFallbackUrl,
    HERO_FALLBACK_BY_CATEGORY,
} from '@/lib/ai/media-pipeline'

const UNSPLASH_BASE = 'https://images.unsplash.com/'
const HERO_PARAMS = '?w=1920&h=1080&fit=crop&q=80'
const OLD_HARDCODED_ID = 'photo-1497366216548-37526070297c'

const ALL_CATEGORIES = [
    'tech', 'restaurant', 'beauty', 'health', 'education',
    'fitness', 'creative', 'business', 'fnb', 'realestate',
    'events', 'travel', 'ecommerce', 'blog',
] as const

describe('TC-F01-W.51 — hero fallback per-category (GH-1185)', () => {
    describe('HERO_FALLBACK_BY_CATEGORY coverage', () => {
        it.each(ALL_CATEGORIES)('has ≥2 fallback photos for "%s"', (cat) => {
            expect(HERO_FALLBACK_BY_CATEGORY[cat]).toBeDefined()
            expect(HERO_FALLBACK_BY_CATEGORY[cat]!.length).toBeGreaterThanOrEqual(2)
        })

        it('never contains the old hardcoded office-hallway photo', () => {
            const allIds = Object.values(HERO_FALLBACK_BY_CATEGORY).flat()
            expect(allIds).not.toContain(OLD_HARDCODED_ID)
        })
    })

    describe('pickHeroFallbackUrl — URL format', () => {
        it('returns a valid Unsplash URL with hero dimensions', () => {
            const url = pickHeroFallbackUrl('tech')
            expect(url.startsWith(UNSPLASH_BASE)).toBe(true)
            expect(url).toContain('/photo-')
            expect(url).toContain('w=1920')
            expect(url).toContain('h=1080')
            expect(url).toContain('fit=crop')
        })

        it('never returns the old hardcoded office-hallway photo', () => {
            for (const cat of ALL_CATEGORIES) {
                for (let i = 0; i < 10; i++) {
                    const url = pickHeroFallbackUrl(cat)
                    expect(url).not.toContain(OLD_HARDCODED_ID)
                }
            }
        })
    })

    describe('pickHeroFallbackUrl — category routing', () => {
        it('tech business (raw VN input) → tech photo pool', () => {
            // Simulates: businessInfo.industry = "SaaS bán hàng đa kênh, CRM, AI Chatbot"
            const url = pickHeroFallbackUrl('SaaS bán hàng đa kênh, CRM, AI Chatbot')
            const techIds = HERO_FALLBACK_BY_CATEGORY['tech']!
            const urlContainsTechPhoto = techIds.some(id => url.includes(id))
            expect(urlContainsTechPhoto).toBe(true)
        })

        it('restaurant input → restaurant photo pool', () => {
            const url = pickHeroFallbackUrl('nhà hàng hải sản')
            const ids = HERO_FALLBACK_BY_CATEGORY['restaurant']!
            expect(ids.some(id => url.includes(id))).toBe(true)
        })

        it('beauty/spa input → beauty photo pool', () => {
            const url = pickHeroFallbackUrl('spa thẩm mỹ')
            const ids = HERO_FALLBACK_BY_CATEGORY['beauty']!
            expect(ids.some(id => url.includes(id))).toBe(true)
        })

        it('unknown / empty category → business photo pool (safe fallback)', () => {
            const url1 = pickHeroFallbackUrl(undefined)
            const url2 = pickHeroFallbackUrl('')
            const url3 = pickHeroFallbackUrl('some completely random unknown industry xyz')
            const ids = HERO_FALLBACK_BY_CATEGORY['business']!
            expect(ids.some(id => url1.includes(id))).toBe(true)
            expect(ids.some(id => url2.includes(id))).toBe(true)
            expect(ids.some(id => url3.includes(id))).toBe(true)
        })

        it('fitness gym input → fitness photo pool', () => {
            const url = pickHeroFallbackUrl('gym fitness center')
            const ids = HERO_FALLBACK_BY_CATEGORY['fitness']!
            expect(ids.some(id => url.includes(id))).toBe(true)
        })
    })
})
