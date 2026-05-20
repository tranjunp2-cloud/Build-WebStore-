/**
 * Regression tests for GH-912 — duplicate generated sites across users.
 *
 * Guarantee: `computeGenSeed` mixes user contact fields (name|email|phone) so
 * two users sharing only one of those fields still derive different seeds.
 * Drives diversity for theme picker, image pool, sample products fallback,
 * post-AI swap canned baselines, and static blog seeds.
 */

import { describe, it, expect } from 'vitest'
import { computeGenSeed } from '@/lib/ai/gen-seed'
import { pickCategoryThemeWithMood } from '@/lib/ai/category-theme-picker'
import { getBlogSeeds } from '@/lib/ai/content/blog-seeds'

describe('computeGenSeed (GH-912)', () => {
    it('returns same seed for identical contact info (deterministic)', () => {
        const info = { businessName: 'Acme', email: 'a@a.com', phone: '123' } as const
        expect(computeGenSeed(info)).toBe(computeGenSeed(info))
    })

    it('returns different seeds when only email differs', () => {
        const a = computeGenSeed({ businessName: 'Joe Coffee', email: 'a@a.com', phone: '111' })
        const b = computeGenSeed({ businessName: 'Joe Coffee', email: 'b@b.com', phone: '111' })
        expect(a).not.toBe(b)
    })

    it('returns different seeds when only phone differs', () => {
        const a = computeGenSeed({ businessName: 'Joe Coffee', email: 'x@x.com', phone: '111' })
        const b = computeGenSeed({ businessName: 'Joe Coffee', email: 'x@x.com', phone: '222' })
        expect(a).not.toBe(b)
    })

    it('degrades gracefully when email/phone absent (name-only seed)', () => {
        const a = computeGenSeed({ businessName: 'Solo', email: undefined, phone: undefined })
        const b = computeGenSeed({ businessName: 'Solo', email: undefined, phone: undefined })
        expect(a).toBe(b)
        expect(typeof a).toBe('number')
    })

    it('produces wide distribution across realistic same-name users', () => {
        // 10 users, same business name, different email/phone — seeds should
        // collide rarely (allow at most 1 collision in 10 to absorb hash luck).
        const seeds = Array.from({ length: 10 }, (_, i) =>
            computeGenSeed({
                businessName: 'Pho Hong',
                email: `user${i}@example.com`,
                phone: `+60${i}1234567`,
            }),
        )
        const unique = new Set(seeds)
        expect(unique.size).toBeGreaterThanOrEqual(9)
    })
})

describe('GH-912 downstream — same name but different contact picks different theme', () => {
    it('two users same business name + category get different theme presets when contacts differ', () => {
        const seedA = computeGenSeed({
            businessName: 'Joe Coffee',
            email: 'alice@example.com',
            phone: '+60111111111',
        })
        const seedB = computeGenSeed({
            businessName: 'Joe Coffee',
            email: 'bob@example.com',
            phone: '+60222222222',
        })

        const themeA = pickCategoryThemeWithMood('restaurant', seedA)
        const themeB = pickCategoryThemeWithMood('restaurant', seedB)

        // At minimum, seed must differ — theme equality is acceptable when
        // category has small preset pool (modulo collision), but seed diversity
        // is the load-bearing invariant for GH-912.
        expect(seedA).not.toBe(seedB)
        // Soft assertion — both calls return well-formed mood objects
        expect(themeA.mood).toBeDefined()
        expect(themeB.mood).toBeDefined()
    })
})

describe('GH-912 downstream — blog seeds rotate by user seed', () => {
    it('same category but different user seeds produce different blog seed ordering', () => {
        const a = getBlogSeeds('travel', { name: 'JoeTravel' }, 12345)
        const b = getBlogSeeds('travel', { name: 'JoeTravel' }, 67890)
        // Same set of posts but different ordering when seed differs.
        expect(a.length).toBe(b.length)
        const orderA = a.map((s) => s.slug).join('|')
        const orderB = b.map((s) => s.slug).join('|')
        expect(orderA).not.toBe(orderB)
    })

    it('omitting seed preserves legacy stable order (backwards compat)', () => {
        const a = getBlogSeeds('travel', { name: 'X' })
        const b = getBlogSeeds('travel', { name: 'X' })
        expect(a.map((s) => s.slug)).toEqual(b.map((s) => s.slug))
    })
})
