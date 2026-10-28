/**
 * /api/ai translate routes on the AI platform task engine.
 * TC-IDs: TC-AICP-23 (translate → i18n.translate-blocks), TC-AICP-24 (translate cache key
 * isolation + hit before rate limit, route level).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (top-level) ─────────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler({ id: 7, email: 'owner@shop.my' }, req, ctx),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10 })) }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import { POST as translatePOST } from '@/app/api/ai/translate/route'
import { clearTranslationCache } from '@/lib/ai/translate-cache'
import { AgentAccessError, resolveActorForUser } from '@/lib/ai-platform/context'
import { checkRateLimit } from '@/lib/rateLimit'

const fetchMock = vi.fn<typeof fetch>()

function post(path: string, body: unknown) {
    return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', body: JSON.stringify(body) })
}

function taskResponse(taskId: string, output: unknown) {
    return Response.json({
        taskId,
        promptVersion: `${taskId}@1`,
        requestId: 'req_1',
        output,
        usage: { provider: 'openai', model: 'gpt-4.1-nano', costUsdMicros: 12, latencyMs: 900, fallbacks: [] },
    })
}

function sentInput(call = 0) {
    return JSON.parse(String(fetchMock.mock.calls[call]![1]?.body)).input
}

const HERO = {
    blockType: 'hero-b1',
    targetLocale: 'ms',
    content: { headline: 'Welcome', ctaButtons: [{ label: 'Shop now', href: '/shop' }], columns: 3, badge: '' },
}
const HERO_FIELDS = { headline: 'Welcome', 'ctaButtons.0.label': 'Shop now', 'ctaButtons.0.href': '/shop' }
const HERO_TRANSLATED = { headline: 'Selamat Datang', 'ctaButtons.0.label': 'Beli sekarang', 'ctaButtons.0.href': '/shop' }

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    vi.mocked(checkRateLimit).mockClear()
    clearTranslationCache()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('/api/ai/translate on the platform task engine [TC-AICP-23]', () => {
    it('sends string leaves as field paths and writes translations back into the block shape', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(
            taskResponse('i18n.translate-blocks', { fields: { ...HERO_TRANSLATED, headline: '<b>Selamat Datang</b>' } }),
        )

        // Act
        const res = await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            translated: { headline: 'Selamat Datang', ctaButtons: [{ label: 'Beli sekarang', href: '/shop' }], columns: 3, badge: '' },
            cached: false,
        })
        expect(fetchMock.mock.calls[0]![0]).toBe('http://ai.internal:8300/v1/tasks/i18n.translate-blocks/run')
        expect(sentInput()).toEqual({ targetLocale: 'ms', fields: HERO_FIELDS })
    })

    it('answers an error (never the original content) on outages and passes the workspace quota through [TC-AIREL-240]', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'upstream 503 from provider x' }, { status: 503 }))
        const down = await translatePOST(post('/api/ai/translate', HERO), undefined as never)
        expect(down.status).toBe(502)
        expect(await down.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })

        fetchMock.mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))
        const limited = await translatePOST(post('/api/ai/translate', HERO), undefined as never)
        expect(limited.status).toBe(429)
        expect(await limited.json()).toEqual({ error: "Your workspace reached today's AI limit." })
    })

    it('does not call the platform for callers outside the workspace', async () => {
        vi.mocked(resolveActorForUser).mockRejectedValueOnce(new AgentAccessError('You are not an active member of this workspace.', 403))

        const res = await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        expect(res.status).toBe(502)
        expect(await res.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('answers 503 when the platform is not configured [TC-AIREL-240]', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const res = await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('/api/ai/translate cache on the platform path [TC-AICP-24]', () => {
    it('serves a repeat from cache without the platform or the rate limit', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(taskResponse('i18n.translate-blocks', { fields: HERO_TRANSLATED }))
        await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        // Act
        const res = await translatePOST(post('/api/ai/translate', { ...HERO, blockType: 'anything-else' }), undefined as never)

        // Assert
        expect((await res.json()).cached).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(checkRateLimit).toHaveBeenCalledTimes(1)
    })

    it('misses for edited content and for another workspace with the same content', async () => {
        // Arrange
        fetchMock.mockImplementation(async () => taskResponse('i18n.translate-blocks', { fields: HERO_TRANSLATED }))
        await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        // Act
        const edited = await translatePOST(
            post('/api/ai/translate', { ...HERO, content: { ...HERO.content, headline: 'Welcome back' } }),
            undefined as never,
        )
        vi.mocked(resolveActorForUser).mockResolvedValueOnce({ user: { id: 7 }, tenantId: '2', organizationId: 'org_2', role: 'owner' } as never)
        const otherWorkspace = await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        // Assert
        expect((await edited.json()).cached).toBe(false)
        expect((await otherWorkspace.json()).cached).toBe(false)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('never caches a fallback', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'down' }, { status: 503 }))
        await translatePOST(post('/api/ai/translate', HERO), undefined as never)
        fetchMock.mockResolvedValueOnce(taskResponse('i18n.translate-blocks', { fields: HERO_TRANSLATED }))

        const retry = await translatePOST(post('/api/ai/translate', HERO), undefined as never)

        expect((await retry.json()).cached).toBe(false)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
