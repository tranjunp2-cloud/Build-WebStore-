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

import { POST as productDescriptionPOST } from '@/app/api/ai/product-description/route'
import { POST as rewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { resolveActorForUser } from '@/lib/ai-platform/context'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'

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

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('/api/ai copy routes on the platform task engine [TC-AICP-19]', () => {
    it('product-description runs copy.product-description and keeps the legacy response shape', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('copy.product-description', { description: '  Soft cotton tee.\nBreathes well.  ' }))

        const res = await productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee', category: 'Apparel', language: 'ms' }), undefined as never)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, data: { description: 'Soft cotton tee.\nBreathes well.' } })
        const [url, init] = fetchMock.mock.calls[0]!
        expect(url).toBe('http://ai.internal:8300/v1/tasks/copy.product-description/run')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ctx-token')
        expect(JSON.parse(String(init?.body))).toEqual({ input: { name: 'Cotton tee', category: 'Apparel', language: 'ms' } })
    })

    it('rewrite-text returns the rewritten text and falls back to the original when empty', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('copy.rewrite-text', { rewritten: 'Shop the new season' }))
        const ok = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'New season here', instruction: 'Make it punchier' }), undefined as never)
        expect(await ok.json()).toEqual({ rewritten: 'Shop the new season' })

        fetchMock.mockResolvedValueOnce(taskResponse('copy.rewrite-text', { rewritten: '   ' }))
        const empty = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'Keep me', instruction: 'Shorter' }), undefined as never)
        expect(await empty.json()).toEqual({ rewritten: 'Keep me' })
    })

    it('passes quota errors through and hides provider outages', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))
        const limited = await productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee' }), undefined as never)
        expect(limited.status).toBe(429)
        expect(await limited.json()).toEqual({ success: false, error: "Your workspace reached today's AI limit." })

        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'upstream 503 from provider x' }, { status: 503 }))
        const down = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'a', instruction: 'b' }), undefined as never)
        expect(down.status).toBe(502)
        expect((await down.json()).error).not.toContain('provider x')
    })

    it('hides validation detail from the platform behind a generic message', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'text: Too big: expected string to have <=50000 characters' }, { status: 400 }))

        const res = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'a', instruction: 'b' }), undefined as never)

        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('This request is too large or not valid for the AI assistant.')
    })

    it('refuses callers who are not members of the workspace', async () => {
        const { AgentAccessError } = await import('@/lib/ai-platform/context')
        vi.mocked(resolveActorForUser).mockRejectedValueOnce(new AgentAccessError('You are not an active member of this workspace.', 403))

        const res = await productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee' }), undefined as never)

        expect(res.status).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('answers 503 with the AI-unavailable message when the platform is not configured [TC-AISEC-01]', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const res = await productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee' }), undefined as never)
        const rewrite = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'a', instruction: 'b' }), undefined as never)

        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ success: false, error: AI_UNAVAILABLE_MESSAGE })
        expect(rewrite.status).toBe(503)
        expect(await rewrite.json()).toEqual({ error: AI_UNAVAILABLE_MESSAGE })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
