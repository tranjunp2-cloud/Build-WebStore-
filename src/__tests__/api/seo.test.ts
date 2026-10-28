import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST as AnalyzePOST } from '@/app/api/seo/analyze/route'
import { POST as FixPOST } from '@/app/api/seo/fix/route'
import { NextRequest } from 'next/server'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-1', email: 'admin@example.com', roles: ['super-admin'] }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@example.com', roles: ['super-admin'] }),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))

// seo/fix generates meta through the AI platform as the caller in the site's workspace.
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 'user-1' }, tenantId: 'tenant-1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

const fetchMock = vi.fn<typeof fetch>()

function seoFixTaskResponse(output: unknown) {
    return Response.json({
        taskId: 'seo.fix-meta',
        promptVersion: 'seo.fix-meta@1',
        requestId: 'req_1',
        output,
        usage: { provider: 'openai', model: 'gpt-4.1-nano', costUsdMicros: 12, latencyMs: 900, fallbacks: [] },
    })
}

// Giả lập Payload CMS cho cả 2 APIs (Analyze và Fix)
vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'sites' && id === 'site-valid') {
                    return { id: 'site-valid', name: 'Mock Site', seo: {}, tenant: 'tenant-1' }
                }
                return null
            }),
            find: vi.fn().mockImplementation(async ({ collection, where }) => {
                if (collection === 'pages' && where.site.equals === 'site-valid') {
                    return {
                        docs: [
                            {
                                id: 'page-1', title: 'Home', slug: '/', 
                                // Có Lỗi SEO: Thiếu meta title và description, ít content
                                seo: {}, 
                                layout: [{ blockType: 'hero', headline: 'Welcome' }]
                            },
                            {
                                id: 'page-2', title: 'About', slug: '/about',
                                // Có Meta Title, nhưng thiếu Description
                                seo: { title: 'About Us' },
                                layout: []
                            }
                        ],
                        totalDocs: 2
                    }
                }
                return { docs: [], totalDocs: 0 }
            }),
            update: vi.fn().mockResolvedValue({})
        })
    }
})


describe('SEO APIs', () => {
    beforeEach(() => {
        vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    describe('POST /api/seo/analyze', () => {
        it('returns 400 if siteId is omitted', async () => {
            const req = new NextRequest('http://localhost:3000/api/seo/analyze', {
                method: 'POST',
                body: JSON.stringify({})
            })
            const res = await AnalyzePOST(req)
            const body = await res.json()
            expect(res.status).toBe(400)
            expect(body.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 200 with SEO score and issue list for valid siteId', async () => {
            const req = new NextRequest('http://localhost:3000/api/seo/analyze', {
                method: 'POST',
                body: JSON.stringify({ siteId: 'site-valid' })
            })
            const res = await AnalyzePOST(req)
            const result = await res.json()

            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            // Lấy từ dummy DB ở trên, tổng số trang là 2
            expect(result.data.pages.length).toBe(2)
            expect(result.data.score).toBeTypeOf('number')
            // Chắc chắn là có issue vì mock page-1 không có meta desc/title
            expect(result.data.totalIssues).toBeGreaterThan(0)
        })
    })

    describe('POST /api/seo/fix', () => {
        it('returns 404 if siteId not found in db', async () => {
            const req = new NextRequest('http://localhost:3000/api/seo/fix', {
                method: 'POST',
                body: JSON.stringify({ siteId: 'site-not-exist' })
            })
            const res = await FixPOST(req)
            expect(res.status).toBe(404)
        })

        it('returns 200 and fixes pages through the AI platform if missing SEO info', async () => {
            fetchMock.mockResolvedValue(seoFixTaskResponse({
                metaTitle: 'AI SEO Title',
                metaDescription: 'AI generated SEO description for testing',
            }))
            const req = new NextRequest('http://localhost:3000/api/seo/fix', {
                method: 'POST',
                body: JSON.stringify({ siteId: 'site-valid' })
            })
            const res = await FixPOST(req)
            const result = await res.json()

            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.totalPages).toBeGreaterThan(0)

            // Platform must fix at least 1 page because the mock has pages with missing info
            expect(result.data.fixedPages).toBeGreaterThan(0)
            expect(result.data.results[0].metaTitle).toBe("AI SEO Title")
            const [url] = fetchMock.mock.calls[0]!
            expect(url).toBe('http://ai.internal:8300/v1/tasks/seo.fix-meta/run')
        })

        it('returns 503 AI_UNAVAILABLE when pages need fixing and the platform is not configured [TC-AISEC-01]', async () => {
            vi.stubEnv('AI_PLATFORM_URL', '')
            const req = new NextRequest('http://localhost:3000/api/seo/fix', {
                method: 'POST',
                body: JSON.stringify({ siteId: 'site-valid' })
            })

            const res = await FixPOST(req)

            expect(res.status).toBe(503)
            expect(await res.json()).toEqual({ success: false, error: { code: 'AI_UNAVAILABLE', message: AI_UNAVAILABLE_MESSAGE } })
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

})
