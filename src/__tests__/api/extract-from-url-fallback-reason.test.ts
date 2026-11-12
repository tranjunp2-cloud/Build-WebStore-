/**
 * TC-AIWB-94 — extract-from-url says WHY it returned scraper-only data (no usable workspace,
 * platform off, task failure) instead of presenting a low-confidence result as a plain success.
 * Real: route, request schema, safety checks, config gate. Faked: session, rate limit, scraper, task call.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AiClientError } from '@ech/ai-contracts'

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler({ id: 7, email: 'staff@ech.my' }, req, ctx),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 })) }))
vi.mock('@/lib/ai/url-scraper', () => ({ scrapeUrl: vi.fn() }))
vi.mock('@/lib/ai-platform/ai-tasks', () => ({ runAiTaskForUser: vi.fn() }))

import { POST } from '@/app/api/ai/extract-from-url/route'
import { AgentAccessError } from '@/lib/ai-platform/context'
import { scrapeUrl } from '@/lib/ai/url-scraper'
import { runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'

const PAGE = 'Kedai Kopi ABC. Kopi, teh tarik, nasi lemak. Buka setiap hari dari 7 pagi hingga 10 malam.'

const post = () => POST(
    new NextRequest('http://localhost:3000/api/ai/extract-from-url', { method: 'POST', body: JSON.stringify({ url: 'https://kedai-kopi.example' }) }),
    undefined as never,
)

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(scrapeUrl).mockResolvedValue({
        raw: { preprocessedText: PAGE },
        meta: { title: 'Kedai Kopi ABC | Home', description: 'Kopi terbaik di KL', locale: 'ms-MY' },
        confidence: 'high',
        warnings: [],
    } as never)
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('extract-from-url fallback reason [TC-AIWB-94]', () => {
    it('a user with no usable workspace (or staff outside it) gets scraper data flagged not_workspace_member', async () => {
        vi.mocked(runAiTaskForUser).mockRejectedValue(new AgentAccessError('AI features run inside a workspace you are a member of.', 403))

        const body = await (await post()).json()

        expect(body.success).toBe(true)
        expect(body.aiFallbackReason).toBe('not_workspace_member')
        expect(body.data.businessName).toBe('Kedai Kopi ABC | Home')
        expect(body.data.confidence).toBe('low')
    })

    it('a platform that is off is flagged ai_unconfigured and the task is not attempted', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const body = await (await post()).json()

        expect(body.aiFallbackReason).toBe('ai_unconfigured')
        expect(runAiTaskForUser).not.toHaveBeenCalled()
    })

    it('a failing task is flagged ai_task_failed', async () => {
        vi.mocked(runAiTaskForUser).mockRejectedValue(new AiClientError('down', 503))

        expect((await (await post()).json()).aiFallbackReason).toBe('ai_task_failed')
    })

    it('a successful extraction carries no fallback reason', async () => {
        vi.mocked(runAiTaskForUser).mockResolvedValue({
            output: { businessName: 'Kedai Kopi ABC', industry: 'restaurant', shortDescription: 'Kopi', products: 'Kopi', detectedLanguage: 'ms', confidence: 'high' },
        } as never)

        const body = await (await post()).json()

        expect(body.success).toBe(true)
        expect('aiFallbackReason' in body).toBe(false)
    })
})
