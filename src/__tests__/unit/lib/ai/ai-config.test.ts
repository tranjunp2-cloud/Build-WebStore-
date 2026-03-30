import { describe, it, expect } from 'vitest'
import {
    selectModel,
    checkRateLimit,
    RATE_LIMITS,
    ESTIMATED_COSTS,
    type AITask,
    type SubscriptionPlan,
} from '@/lib/ai/config'

// ─── TC-F01.08: AI model routing for site generation ──────────────────
// ─── TC-F01.10: Model selection based on task complexity ──────────────

const ALL_TASKS: AITask[] = [
    'site-generation', 'chat-edit', 'inline-edit',
    'seo-generation', 'content-rewrite', 'product-description',
]

const ALL_PLANS: SubscriptionPlan[] = ['free', 'starter', 'pro', 'business']

describe('selectModel [TC-F01.08, TC-F01.10]', () => {
    it('returns gpt-4o for site-generation (highest quality)', () => {
        expect(selectModel('site-generation')).toBe('gpt-4o')
    })

    it('returns gpt-4o-mini for chat-edit (cost-optimized)', () => {
        expect(selectModel('chat-edit')).toBe('gpt-4o-mini')
    })

    it('returns gpt-4o-mini for inline-edit', () => {
        expect(selectModel('inline-edit')).toBe('gpt-4o-mini')
    })

    it('returns gpt-4o-mini for seo-generation', () => {
        expect(selectModel('seo-generation')).toBe('gpt-4o-mini')
    })

    it('returns gpt-4o-mini for content-rewrite', () => {
        expect(selectModel('content-rewrite')).toBe('gpt-4o-mini')
    })

    it('returns gpt-4o-mini for product-description', () => {
        expect(selectModel('product-description')).toBe('gpt-4o-mini')
    })
})

describe('checkRateLimit [TC-F01.08]', () => {
    it('allows when usage is 0 (free plan, site-generation)', () => {
        const result = checkRateLimit('free', 'site-generation', 0)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(1)
        expect(result.limit).toBe(1)
    })

    it('blocks when usage reaches limit (free plan, site-generation)', () => {
        const result = checkRateLimit('free', 'site-generation', 1)

        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('calculates remaining correctly', () => {
        const result = checkRateLimit('free', 'chat-edit', 15)

        expect(result.remaining).toBe(5) // limit=20, usage=15
        expect(result.allowed).toBe(true)
    })

    it('allows at limit-1 (boundary test)', () => {
        const limit = RATE_LIMITS.free['chat-edit'] // 20
        const result = checkRateLimit('free', 'chat-edit', limit - 1)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(1)
    })

    it('blocks at exact limit (boundary test)', () => {
        const limit = RATE_LIMITS.free['chat-edit'] // 20
        const result = checkRateLimit('free', 'chat-edit', limit)

        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('clamps negative remaining to 0 (usage exceeds limit)', () => {
        const result = checkRateLimit('free', 'site-generation', 100)

        expect(result.remaining).toBe(0)
        expect(result.allowed).toBe(false)
    })

    it('effectively unlimited for business plan', () => {
        const result = checkRateLimit('business', 'site-generation', 10000)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBeGreaterThan(0)
    })

    it('starter plan has higher limits than free', () => {
        const freeLimit = RATE_LIMITS.free['chat-edit']
        const starterLimit = RATE_LIMITS.starter['chat-edit']

        expect(starterLimit).toBeGreaterThan(freeLimit)
    })

    it('pro plan has higher limits than starter', () => {
        const starterLimit = RATE_LIMITS.starter['chat-edit']
        const proLimit = RATE_LIMITS.pro['chat-edit']

        expect(proLimit).toBeGreaterThan(starterLimit)
    })
})

describe('RATE_LIMITS structure', () => {
    it('has entries for all plans and all tasks', () => {
        for (const plan of ALL_PLANS) {
            for (const task of ALL_TASKS) {
                expect(RATE_LIMITS[plan][task]).toBeDefined()
                expect(typeof RATE_LIMITS[plan][task]).toBe('number')
                expect(RATE_LIMITS[plan][task]).toBeGreaterThan(0)
            }
        }
    })
})

describe('ESTIMATED_COSTS structure', () => {
    it('has cost entry for all tasks', () => {
        for (const task of ALL_TASKS) {
            expect(ESTIMATED_COSTS[task]).toBeDefined()
            expect(ESTIMATED_COSTS[task]).toBeGreaterThan(0)
        }
    })

    it('site-generation costs more than other tasks (uses gpt-4o)', () => {
        const siteGenCost = ESTIMATED_COSTS['site-generation']
        for (const task of ALL_TASKS.filter(t => t !== 'site-generation')) {
            expect(siteGenCost).toBeGreaterThan(ESTIMATED_COSTS[task])
        }
    })
})
