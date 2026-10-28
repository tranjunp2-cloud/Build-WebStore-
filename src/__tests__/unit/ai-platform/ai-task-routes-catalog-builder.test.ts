import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (top-level) ─────────────────────────────────────────────────────
const { findCategories } = vi.hoisted(() => ({ findCategories: vi.fn() }))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler({ id: 7, email: 'owner@shop.my' }, req, ctx),
    tenantIdForQuery: () => 1,
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10 })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: findCategories, logger: { info: vi.fn() } })),
}))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))
vi.mock('@/lib/sites/site-access', () => ({
    resolveSiteForUser: vi.fn(async () => ({ ok: true, site: { id: 5, name: 'Kedai Batik' }, tenantId: '1' })),
}))

import { POST as bulkParsePOST } from '@/app/api/ai/products-bulk-parse/route'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'
import { resolveSiteForUser } from '@/lib/sites/site-access'

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
        usage: { provider: 'openai', model: 'gpt-4.1-mini', costUsdMicros: 40, latencyMs: 2100, fallbacks: [] },
    })
}

function sentTask(call = 0) {
    const [url, init] = fetchMock.mock.calls[call]!
    return { url, input: JSON.parse(String(init?.body)).input }
}

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    findCategories.mockReset()
    findCategories.mockResolvedValue({
        docs: [
            { id: 1, name: 'Apparel', breadcrumbs: 'Apparel', parent: null },
            { id: 2, name: 'T-Shirts', breadcrumbs: 'Apparel > T-Shirts', parent: 1 },
        ],
        hasNextPage: false,
        totalDocs: 2,
    })
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('/api/ai/products-bulk-parse on the platform task engine [TC-AICP-26]', () => {
    it('sends the merchant text with tenant leaf categories and keeps the category guard + response shape', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('catalog.bulk-parse-products', {
            products: [
                {
                    name: 'Cotton T-Shirt', price: 5, categoryId: '2', sku: 'COT-TS',
                    description: 'Soft cotton shirt for everyday wear with a quality made style.',
                    variants: [{ name: 'White', price: 5, sku: 'TS-WHT', stock: 0 }],
                    variantConfigs: [{ name: 'Color', options: [{ value: 'White' }] }],
                },
                { name: 'Cotton Shirt Large', price: 9, categoryId: 99, sku: 'COT-SH', variants: [] },
            ],
        }))

        const res = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'áo thun trắng giá 5rm', locale: 'en' }), undefined as never)

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.generationId).toMatch(/^[0-9a-f-]{36}$/)
        expect(body.products.map((p: { categoryId: unknown }) => p.categoryId)).toEqual([2, null])
        expect(body.products[0]).toMatchObject({ name: 'Cotton T-Shirt', price: 5, variants: [{ name: 'White', stock: 0 }] })
        const { url, input } = sentTask()
        expect(url).toBe('http://ai.internal:8300/v1/tasks/catalog.bulk-parse-products/run')
        expect(input).toEqual({
            promptText: 'áo thun trắng giá 5rm',
            locale: 'en',
            categoryCandidates: [{ id: 2, path: 'Apparel > T-Shirts' }],
        })
    })

    it('still rejects merchant copy in the wrong language as retryable', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('catalog.bulk-parse-products', {
            products: [{ name: 'Seluar', price: 20, categoryId: null, variants: [{ name: 'Merah', price: 20 }] }],
        }))

        const res = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'seluar merah', locale: 'en' }), undefined as never)

        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({ error: 'merchantLanguageMismatch', retryable: true })
    })

    it('maps platform quota and outages onto the modal error codes', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }))
        const limited = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'tee 5rm' }), undefined as never)
        expect(limited.status).toBe(429)
        expect(await limited.json()).toEqual({ error: 'aiQuotaExceeded' })

        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'The AI could not complete this task.' }, { status: 503 }))
        const down = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'tee 5rm' }), undefined as never)
        expect(down.status).toBe(502)
        expect(await down.json()).toEqual({ error: 'parseError' })
    })

    it('maps the platform deadline onto aiTimeout so the modal can offer a retry', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ detail: 'The AI took too long to answer. Try again with less input.' }, { status: 504 }))

        const res = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'tee 5rm' }), undefined as never)

        expect(res.status).toBe(504)
        expect(await res.json()).toEqual({ error: 'aiTimeout' })
        const [, init] = fetchMock.mock.calls[0]!
        expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('answers 503 aiUnavailable (no sample data, no model call) when the platform is not configured [TC-AISEC-01]', async () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        const res = await bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'tee 5rm', locale: 'ms' }), undefined as never)

        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ error: 'aiUnavailable' })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
