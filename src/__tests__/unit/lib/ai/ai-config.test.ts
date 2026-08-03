import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
    'url-extraction', 'bulk-parse',
]

const ALL_PLANS: SubscriptionPlan[] = ['free', 'starter', 'pro', 'business']

describe('selectModel — default routing [TC-F01.08, TC-F01.10]', () => {
    // Clear env overrides for default-route tests
    const originalEnv: Record<string, string | undefined> = {}
    const ENV_KEYS = [
        'AI_MODEL_SITEGEN', 'AI_MODEL_EDIT', 'AI_MODEL_INLINE_EDIT',
        'AI_MODEL_SEO', 'AI_MODEL_REWRITE', 'AI_MODEL_PRODUCT_DESC',
        'AI_MODEL_IMAGE_RATING', 'AI_MODEL_URL_EXTRACT', 'AI_MODEL_BULK_PARSE',
    ]

    beforeEach(() => {
        for (const k of ENV_KEYS) {
            originalEnv[k] = process.env[k]
            delete process.env[k]
        }
    })

    afterEach(() => {
        for (const k of ENV_KEYS) {
            if (originalEnv[k] === undefined) delete process.env[k]
            else process.env[k] = originalEnv[k]
        }
    })

    it('returns gpt-5.4-mini for site-generation', () => {
        expect(selectModel('site-generation')).toBe('gpt-5.4-mini')
    })

    it('returns gpt-5.4-mini for the light site-generation batch', () => {
        expect(selectModel('site-generation-subpages-light')).toBe('gpt-5.4-mini')
    })

    it('returns gpt-5.4-mini for image rating', () => {
        expect(selectModel('image-rating')).toBe('gpt-5.4-mini')
    })

    it('returns gpt-4.1-mini for chat-edit (phase-04: better instruction following)', () => {
        expect(selectModel('chat-edit')).toBe('gpt-4.1-mini')
    })

    it('returns gpt-4.1-mini for inline-edit (phase-04)', () => {
        expect(selectModel('inline-edit')).toBe('gpt-4.1-mini')
    })

    it('returns gpt-4.1-nano for seo-generation (phase-04: 4x cheaper lightweight)', () => {
        expect(selectModel('seo-generation')).toBe('gpt-4.1-nano')
    })

    it('returns gpt-4.1-nano for content-rewrite (phase-04)', () => {
        expect(selectModel('content-rewrite')).toBe('gpt-4.1-nano')
    })

    it('returns gpt-4.1-nano for product-description (phase-04)', () => {
        expect(selectModel('product-description')).toBe('gpt-4.1-nano')
    })

    it('returns gpt-4.1-nano for bulk-parse (phase-04: 50x cheaper for CSV extraction)', () => {
        expect(selectModel('bulk-parse')).toBe('gpt-4.1-nano')
    })

    it('returns gpt-4.1-nano for url-extraction (phase-04)', () => {
        expect(selectModel('url-extraction')).toBe('gpt-4.1-nano')
    })
})

describe('selectModel — env override', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>
    const savedSiteGen = process.env.AI_MODEL_SITEGEN
    const savedEdit = process.env.AI_MODEL_EDIT

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        delete process.env.AI_MODEL_SITEGEN
        delete process.env.AI_MODEL_EDIT
    })

    afterEach(() => {
        warnSpy.mockRestore()
        if (savedSiteGen === undefined) delete process.env.AI_MODEL_SITEGEN
        else process.env.AI_MODEL_SITEGEN = savedSiteGen
        if (savedEdit === undefined) delete process.env.AI_MODEL_EDIT
        else process.env.AI_MODEL_EDIT = savedEdit
    })

    it('AI_MODEL_SITEGEN=gpt-4.1-mini rolls site-generation back to GPT-4.1 mini', () => {
        process.env.AI_MODEL_SITEGEN = 'gpt-4.1-mini'
        expect(selectModel('site-generation')).toBe('gpt-4.1-mini')
    })

    it('AI_MODEL_EDIT=gpt-4.1-nano overrides chat-edit default', () => {
        process.env.AI_MODEL_EDIT = 'gpt-4.1-nano'
        expect(selectModel('chat-edit')).toBe('gpt-4.1-nano')
    })

    it('invalid override falls back to default + console.warn', () => {
        process.env.AI_MODEL_SITEGEN = 'nonexistent-model'
        expect(selectModel('site-generation')).toBe('gpt-5.4-mini')
        expect(warnSpy).toHaveBeenCalledOnce()
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-model'))
    })

    it('empty-string override treated as no override', () => {
        process.env.AI_MODEL_SITEGEN = ''
        expect(selectModel('site-generation')).toBe('gpt-5.4-mini')
        expect(warnSpy).not.toHaveBeenCalled()
    })

    it('canary rollback via env var: AI_MODEL_SITEGEN=gpt-4o restores legacy', () => {
        process.env.AI_MODEL_SITEGEN = 'gpt-4o'
        expect(selectModel('site-generation')).toBe('gpt-4o')
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

    it('site-generation costs more than other tasks (heavier prompt + output)', () => {
        const siteGenCost = ESTIMATED_COSTS['site-generation']
        for (const task of ALL_TASKS.filter(t => t !== 'site-generation')) {
            expect(siteGenCost).toBeGreaterThan(ESTIMATED_COSTS[task])
        }
    })
})
