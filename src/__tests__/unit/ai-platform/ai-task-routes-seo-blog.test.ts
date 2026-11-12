import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (top-level) ─────────────────────────────────────────────────────
const state = vi.hoisted(() => ({
    user: {} as Record<string, unknown>,
    payload: { findByID: vi.fn(), find: vi.fn(), update: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler(state.user, req, ctx),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10 })) }))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: () => (handler: unknown) => handler,
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.payload) }))
vi.mock('@/lib/ai/capture-generation', () => ({
    startCapture: vi.fn(async () => null),
    finishCapture: vi.fn(async () => undefined),
}))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import { POST as seoGeneratePOST } from '@/app/api/ai/seo-generate/route'
import { POST as generateBlogPOST } from '@/app/api/ai/generate-blog/route'
import { POST as seoFixPOST } from '@/app/api/seo/fix/route'
import { resolveActorForUser } from '@/lib/ai-platform/context'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'

const fetchMock = vi.fn<typeof fetch>()

const OWNER = {
    id: 7,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 1 }, status: 'active' }],
}

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

function sentTask(call = 0) {
    const [url, init] = fetchMock.mock.calls[call]!
    return { url: String(url), input: JSON.parse(String(init?.body)).input }
}

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    state.user = OWNER
    state.payload.findByID.mockReset()
    state.payload.find.mockReset()
    state.payload.update.mockReset().mockResolvedValue({})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('seo + blog routes on the platform task engine [TC-AICP-20]', () => {
    it('seo-generate runs seo.page-meta with the site keywords and enforces the legacy limits', async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce({ id: 5, tenant: 1, seo: { trackedKeywords: [{ keyword: 'batik murah' }] } })
        fetchMock.mockResolvedValueOnce(taskResponse('seo.page-meta', {
            title: 'T'.repeat(80),
            description: 'D'.repeat(200),
            slug: 'Kemeja Batik!',
        }))

        // Act
        const res = await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik', category: 'Apparel', language: 'ms', siteId: 5 }), undefined as never)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            success: true,
            data: { title: 'T'.repeat(70), description: 'D'.repeat(160), slug: 'kemeja-batik' },
        })
        const task = sentTask()
        expect(task.url).toBe('http://ai.internal:8300/v1/tasks/seo.page-meta/run')
        expect(task.input).toEqual({ name: 'Kemeja Batik', category: 'Apparel', language: 'ms', keywords: ['batik murah'] })
    })

    it('generate-blog runs copy.blog-post and returns the post as data', async () => {
        // Arrange
        const postBody = { title: 'Kopi KL', content: '<p>Body</p>', seoTitle: 'Kopi', seoDescription: 'Kopi culture.' }
        fetchMock.mockResolvedValueOnce(taskResponse('copy.blog-post', postBody))

        // Act
        const res = await generateBlogPOST(post('/api/ai/generate-blog', { prompt: 'Coffee in KL', tone: 'Friendly' }), undefined as never)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, data: postBody })
        const task = sentTask()
        expect(task.url).toBe('http://ai.internal:8300/v1/tasks/copy.blog-post/run')
        expect(task.input).toEqual({ prompt: 'Coffee in KL', language: 'en', tone: 'Friendly' })
    })

    it('generate-blog passes quota errors through in the legacy error shape', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))

        // Act
        const res = await generateBlogPOST(post('/api/ai/generate-blog', { prompt: 'Coffee' }), undefined as never)

        // Assert
        expect(res.status).toBe(429)
        expect(await res.json()).toEqual({ success: false, error: "Your workspace reached today's AI limit." })
    })

    it('seo/fix runs seo.fix-meta per page and keeps the legacy result shape', async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce({ id: 5, name: 'Kedai Runcit', tenant: { id: 1 }, seo: {} })
        state.payload.find.mockResolvedValueOnce({
            docs: [
                { id: 'p1', title: 'Home', seo: {}, layout: [{ headline: 'Welcome' }] },
                { id: 'p2', title: 'About', seo: { title: 'About', description: 'About us' }, layout: [] },
            ],
        })
        fetchMock.mockResolvedValueOnce(taskResponse('seo.fix-meta', { metaTitle: 'Home | Kedai', metaDescription: 'Fresh groceries.' }))

        // Act
        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            success: true,
            data: {
                fixedPages: 1,
                totalPages: 1,
                results: [{ pageId: 'p1', title: 'Home', metaTitle: 'Home | Kedai', metaDescription: 'Fresh groceries.' }],
            },
        })
        expect(sentTask().input).toEqual({ siteName: 'Kedai Runcit', pageContent: 'Heading: Welcome' })
        // Pages.update is super-admin only at the collection level; the route already checked the
        // caller's active membership of the site's workspace, so the write runs with access off.
        expect(state.payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            id: 'p1',
            overrideAccess: true,
            user: OWNER,
            data: { seo: { title: 'Home | Kedai', description: 'Fresh groceries.' } },
        }))
    })

    it('seo/fix reports a user-safe per-page error when the platform is down', async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce({ id: 5, name: 'Kedai', tenant: 1, seo: {} })
        state.payload.find.mockResolvedValueOnce({ docs: [{ id: 'p1', title: 'Home', seo: {}, layout: [] }] })
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'upstream 503 from provider x' }, { status: 503 }))

        // Act
        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        // Assert
        const body = await res.json()
        expect(body.data.fixedPages).toBe(0)
        expect(body.data.results[0].error).not.toContain('provider x')
        expect(state.payload.update).not.toHaveBeenCalled()
    })

    it('answers 503 (no OpenAI client, no model call) when the platform is not configured [TC-AISEC-01]', async () => {
        // Arrange
        vi.stubEnv('AI_PLATFORM_URL', '')
        state.payload.findByID.mockResolvedValueOnce({ id: 5, name: 'Kedai', tenant: { id: 1 }, seo: {} })
        state.payload.find.mockResolvedValueOnce({ docs: [{ id: 'p1', title: 'Home', seo: {}, layout: [] }] })

        // Act
        const seo = await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik' }), undefined as never)
        const blog = await generateBlogPOST(post('/api/ai/generate-blog', { prompt: 'Coffee' }), undefined as never)
        const fix = await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        // Assert
        expect(seo.status).toBe(503)
        expect(await seo.json()).toEqual({ success: false, error: AI_UNAVAILABLE_MESSAGE })
        expect(blog.status).toBe(503)
        expect(await blog.json()).toEqual({ success: false, error: AI_UNAVAILABLE_MESSAGE })
        // seo/fix only reaches the AI gate when a page actually needs fixing
        expect(fix.status).toBe(503)
        expect(await fix.json()).toEqual({ success: false, error: { code: 'AI_UNAVAILABLE', message: AI_UNAVAILABLE_MESSAGE } })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('POST /api/seo/fix tenant isolation [TC-AICP-21]', () => {
    it("refuses another tenant's site before reading or writing its pages", async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce({ id: 9, name: 'Other Shop', tenant: { id: 99 }, seo: {} })

        // Act
        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '9' }), undefined as never)

        // Assert
        expect(res.status).toBe(403)
        expect(state.payload.find).not.toHaveBeenCalled()
        expect(state.payload.update).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("reads the site with the caller's access so the collection rules apply too", async () => {
        // Arrange — access-filtered read finds nothing for a foreign site
        state.payload.findByID.mockResolvedValueOnce(null)

        // Act
        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '9' }), undefined as never)

        // Assert
        expect(res.status).toBe(404)
        expect(state.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            id: '9',
            overrideAccess: false,
            user: OWNER,
        }))
        expect(state.payload.update).not.toHaveBeenCalled()
    })

    it('refuses callers without an active membership before any read', async () => {
        // Arrange
        state.user = { ...OWNER, tenants: [{ tenant: { id: 1 }, status: 'pending' }] }

        // Act
        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        // Assert
        expect(res.status).toBe(403)
        expect(state.payload.findByID).not.toHaveBeenCalled()
    })
})

describe('POST /api/ai/seo-generate site tenant check [TC-AICP-22]', () => {
    it("refuses a siteId from another tenant and never sends its keywords", async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce({ id: 9, tenant: 99, seo: { trackedKeywords: [{ keyword: 'rival secret' }] } })

        // Act
        const res = await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik', siteId: 9 }), undefined as never)

        // Assert
        expect(res.status).toBe(403)
        expect(JSON.stringify(await res.json())).not.toContain('rival secret')
        expect(fetchMock).not.toHaveBeenCalled()
        expect(state.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            id: 9,
            overrideAccess: false,
            user: OWNER,
        }))
    })

    it('generates without keywords when the site is not readable by the caller', async () => {
        // Arrange
        state.payload.findByID.mockResolvedValueOnce(null)
        fetchMock.mockResolvedValueOnce(taskResponse('seo.page-meta', { title: 'Kemeja', description: 'Beli', slug: 'kemeja' }))

        // Act
        const res = await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik', siteId: 9 }), undefined as never)

        // Assert
        expect(res.status).toBe(200)
        expect(sentTask().input.keywords).toEqual([])
    })
})

describe('site-bound AI usage is billed to the site workspace [TC-AICP-20]', () => {
    it("resolves the actor in the site's tenant, not the cookie workspace", async () => {
        // Arrange
        vi.mocked(resolveActorForUser).mockClear()
        state.payload.findByID.mockResolvedValueOnce({ id: 5, tenant: 1, seo: {} })
        fetchMock.mockResolvedValueOnce(taskResponse('seo.page-meta', { title: 'Kemeja', description: 'Batik shirt', slug: 'kemeja' }))
        state.payload.findByID.mockResolvedValueOnce({ id: 5, name: 'Kedai Runcit', tenant: { id: 1 }, seo: {} })
        state.payload.find.mockResolvedValueOnce({ docs: [{ id: 'p1', title: 'Home', seo: {}, layout: [] }] })
        fetchMock.mockResolvedValueOnce(taskResponse('seo.fix-meta', { metaTitle: 'Home | Kedai', metaDescription: 'Fresh groceries.' }))

        // Act
        await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik', siteId: 5 }), undefined as never)
        await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        // Assert
        const tenants = vi.mocked(resolveActorForUser).mock.calls.map((call) => (call[2] as { tenantId?: string } | undefined)?.tenantId)
        expect(tenants).toEqual(['1', '1'])
    })
})
