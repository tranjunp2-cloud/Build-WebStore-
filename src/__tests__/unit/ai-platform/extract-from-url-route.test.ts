/**
 * TC-AIMV-01 — POST /api/ai/extract-from-url runs the platform task `site.extract-business-info`.
 * Platform failure or no platform → the scrape meta is returned as the fallback (never an error).
 * Real: request schema, URL and content safety checks, config gate, confidence merge.
 * Faked: session, rate limit, the scraper (network), and the platform task call.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AiClientError } from '@ech/ai-contracts'

const state = vi.hoisted(() => ({
    user: { id: 7, email: 'owner@shop.my', tenants: [{ tenant: { id: 1 }, status: 'active' }] } as Record<string, unknown>,
    rateLimitAllowed: true,
}))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler(state.user, req, ctx),
}))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: state.rateLimitAllowed, remaining: 4, resetAt: Date.now() + 60_000 })),
}))
vi.mock('@/lib/ai/url-scraper', () => ({ scrapeUrl: vi.fn() }))
vi.mock('@/lib/ai-platform/ai-tasks', () => ({ runAiTaskForUser: vi.fn() }))

import { POST } from '@/app/api/ai/extract-from-url/route'
import { checkRateLimit } from '@/lib/rateLimit'
import { scrapeUrl } from '@/lib/ai/url-scraper'
import { runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'

const scrape = (preprocessedText: string, confidence: 'high' | 'medium' | 'low' = 'high') => ({
    raw: { preprocessedText },
    meta: { title: 'Kedai Kopi ABC | Home', description: 'Kopi terbaik di KL', locale: 'ms-MY' },
    confidence,
    warnings: [],
})

const PAGE = 'Kedai Kopi ABC. Kopi, teh tarik, nasi lemak. Buka setiap hari dari 7 pagi hingga 10 malam.'

function post(body: unknown) {
    return new NextRequest('http://localhost:3000/api/ai/extract-from-url', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
    vi.clearAllMocks()
    state.rateLimitAllowed = true
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(scrapeUrl).mockResolvedValue(scrape(PAGE) as never)
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('POST /api/ai/extract-from-url [TC-AIMV-01]', () => {
    it('extracts with the site.extract-business-info task and returns the platform result', async () => {
        vi.mocked(runAiTaskForUser).mockResolvedValue({
            taskId: 'site.extract-business-info',
            output: { businessName: 'Kedai Kopi ABC', industry: 'restaurant', shortDescription: 'Kopi terbaik', products: 'Kopi, teh tarik', detectedLanguage: 'ms', confidence: 'medium' },
        } as never)

        const res = await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(runAiTaskForUser).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), expect.anything(), 'site.extract-business-info', { pageText: PAGE })
        expect(body.data).toMatchObject({ businessName: 'Kedai Kopi ABC', industry: 'restaurant', detectedLanguage: 'ms' })
        // Merged confidence: the lower of the scraper's and the model's.
        expect(body.data.confidence).toBe('medium')
        expect(body.sourceUrl).toBe('https://kedai-kopi.example')
    })

    it('caps the page text sent to the platform at 40,000 characters', async () => {
        vi.mocked(scrapeUrl).mockResolvedValue(scrape('x'.repeat(50_000)) as never)
        vi.mocked(runAiTaskForUser).mockResolvedValue({ taskId: 'site.extract-business-info', output: {} } as never)

        await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)

        const input = vi.mocked(runAiTaskForUser).mock.calls[0]![3] as { pageText: string }
        expect(input.pageText).toHaveLength(40_000)
    })

    it('falls back to the scraped page meta when the platform fails', async () => {
        vi.mocked(runAiTaskForUser).mockRejectedValue(new AiClientError('The AI service could not complete this request.', 503))

        const res = await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toMatchObject({
            businessName: 'Kedai Kopi ABC | Home',
            shortDescription: 'Kopi terbaik di KL',
            industry: '',
            detectedLanguage: 'ms',
            confidence: 'low',
        })
    })

    it('uses the same meta fallback without calling the platform when it is not configured', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const res = await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.businessName).toBe('Kedai Kopi ABC | Home')
        expect(body.data.confidence).toBe('low')
        expect(runAiTaskForUser).not.toHaveBeenCalled()
    })

    it('limits extraction per user under the ai:extract-from-url key', async () => {
        state.rateLimitAllowed = false

        const res = await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)

        expect(res.status).toBe(429)
        expect((await res.json()).code).toBe('RATE_LIMITED')
        expect(checkRateLimit).toHaveBeenCalledWith('ai:extract-from-url:7', 5)
        expect(scrapeUrl).not.toHaveBeenCalled()
    })

    it('refuses an unsafe URL before scraping or calling the platform', async () => {
        const res = await POST(post({ url: 'http://127.0.0.1/admin' }), undefined as never)

        expect(res.status).toBe(400)
        expect((await res.json()).code).toBe('URL_BLOCKED')
        expect(scrapeUrl).not.toHaveBeenCalled()
        expect(runAiTaskForUser).not.toHaveBeenCalled()
    })

    it('reports a scrape failure as 422 and makes no platform call', async () => {
        vi.mocked(scrapeUrl).mockRejectedValue(new Error('Website took too long to respond'))

        const res = await POST(post({ url: 'https://kedai-kopi.example' }), undefined as never)

        expect(res.status).toBe(422)
        expect((await res.json()).code).toBe('SCRAPE_FAILED')
        expect(runAiTaskForUser).not.toHaveBeenCalled()
    })
})
