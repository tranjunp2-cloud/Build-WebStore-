import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit } from '@/lib/rateLimit'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'

// ─── Mocks (top-level) ────────────────────────────────────────────────
const mockUser = { id: 1, email: 'owner@shop.my', tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19, resetAt: 0 })),
}))

vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 1 }, tenantId: 'tenant-1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import { POST } from '@/app/api/ai/generate-blog/route'

const fetchMock = vi.fn<typeof fetch>()

function makeRequest(body: unknown) {
    return new Request('http://localhost:3000/api/ai/generate-blog', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

function taskResponse(output: unknown) {
    return Response.json({
        taskId: 'copy.blog-post',
        promptVersion: 'copy.blog-post@1',
        requestId: 'req_1',
        output,
        usage: { provider: 'openai', model: 'gpt-4.1-mini', costUsdMicros: 40, latencyMs: 900, fallbacks: [] },
    })
}

function sentTaskInput(call = 0) {
    const [, init] = fetchMock.mock.calls[call]!
    return JSON.parse(String(init?.body)).input as Record<string, unknown>
}

const BLOG_POST = {
    title: 'Coffee Culture in KL',
    content: '<p>Blog content here</p>',
    seoTitle: 'Coffee Culture',
    seoDescription: 'Explore coffee culture.',
}

// ─── TC-F17.013: AI blog content generation ───────────────────────────

describe('POST /api/ai/generate-blog [TC-F17.013]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    it('returns 400 when prompt is missing', async () => {
        const res = await POST(makeRequest({}), undefined as never)
        expect(res.status).toBe(400)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns 503 with the AI-unavailable message when the AI platform is not configured [TC-AISEC-01]', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const res = await POST(makeRequest({ prompt: 'Write about coffee' }), undefined as never)

        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ success: false, error: AI_UNAVAILABLE_MESSAGE })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('generates a blog post through the copy.blog-post platform task', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse(BLOG_POST))

        const res = await POST(makeRequest({ prompt: 'Coffee culture in KL' }), undefined as never)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, data: BLOG_POST })
        const [url] = fetchMock.mock.calls[0]!
        expect(url).toBe('http://ai.internal:8300/v1/tasks/copy.blog-post/run')
        expect(sentTaskInput()).toEqual({ prompt: 'Coffee culture in KL', language: 'en', tone: 'Professional' })
    })

    it('forwards the language parameter to the platform task', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse({ ...BLOG_POST, title: 'Budaya Kopi' }))

        const res = await POST(makeRequest({ prompt: 'Kopi culture', language: 'ms' }), undefined as never)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.title).toBe('Budaya Kopi')
        expect(sentTaskInput()).toMatchObject({ language: 'ms' })
    })

    it('passes platform quota errors through with the 429 status', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))

        const res = await POST(makeRequest({ prompt: 'Test' }), undefined as never)

        expect(res.status).toBe(429)
        expect(await res.json()).toEqual({ success: false, error: "Your workspace reached today's AI limit." })
    })

    it('maps a platform outage to 502 with a user-safe message', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'upstream 503 from provider x' }, { status: 503 }))

        const res = await POST(makeRequest({ prompt: 'Test' }), undefined as never)
        const body = await res.json()

        expect(res.status).toBe(502)
        expect(body.success).toBe(false)
        expect(JSON.stringify(body)).not.toContain('provider x')
    })

    it('counts generations under the generate-blog rate-limit key [TC-AISEC-11]', async () => {
        vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 0 })

        const res = await POST(makeRequest({ prompt: 'Test' }), undefined as never)

        expect(res.status).toBe(429)
        expect(checkRateLimit).toHaveBeenCalledWith('ai:generate-blog:1', 20)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
