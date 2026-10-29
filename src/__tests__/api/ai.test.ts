import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSiteService } from '@/lib/ai/generate-site-service'
import type { GenerateSiteServiceContext } from '@/lib/ai/generate-site-service'
import { generateSiteWithAI, resolveSiteGenerationMode } from '@/lib/ai/openai-generator'
import { POST as GenerateSitePOST, buildGeneratedPages, canonicalizePageSlug } from '@/app/api/ai/generate-site/route'
import { POST as RewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as ApplyTemplatePOST } from '@/app/api/ai/apply-template/route'
import { POST as SeoGeneratePOST } from '@/app/api/ai/seo-generate/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { generateSampleProducts } from '@/lib/ai/generate-sample-products'
import { checkRateLimit } from '@/lib/rateLimit'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getBlockStrings, injectBlockStrings } from '@/lib/ai/block-i18n'
import { currentAiActor } from '@/lib/ai-platform/actor-scope'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }], ...mockAuthContact }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockImplementation(async () => ({ id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }], ...mockAuthContact })),
    tenantIdForQuery: vi.fn().mockReturnValue('tenant-1'),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' })
    })
}))

// Mock RateLimiter
let mockRateLimitAllowed = true
const initialOpenAiApiKey = process.env.OPENAI_API_KEY

afterEach(() => {
    if (initialOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = initialOpenAiApiKey
})
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockImplementation(() => ({
        allowed: mockRateLimitAllowed,
        remaining: 10,
        resetAt: Date.now() + 60000,
    })),
    checkTwoTierRateLimit: vi.fn().mockImplementation(() => ({
        allowed: mockRateLimitAllowed,
        remaining: 10,
        resetAt: Date.now() + 60000,
    })),
}))

// Mock Database (PayloadCMS)
let mockSiteDB: any[] = []
let mockPageDB: any[] = []
let mockTenant: any = { id: 'tenant-1', plan: 'pro', aiGenerationsCount: 0 }
// What payload.findByID returns for the user re-read when the session user lacks the workspace.
let mockFreshUser: unknown = null
let mockPageCreateFailure: { slug: string; error: Error } | null = null
let mockSiteCreateFailure: Error | null = null
let mockMediaDB: Array<Record<string, unknown>> = []
let mockProductDB: Array<Record<string, unknown>> = []
let mockCategoryDB: Array<Record<string, unknown>> = []
let mockGenerationRecordDB: Array<Record<string, unknown>> = []
const mockPayloadLoggerInfo = vi.hoisted(() => vi.fn())
let mockCompleteBlogCount = 3
let mockFailedPageCreateData: Record<string, unknown> | null = null
let mockIdCounter = 0
let mockAuthContact: { email?: string; phone?: string } = {}

type PersistedBlock = Record<string, unknown> & { blockType?: string }
type PersistedPage = Record<string, unknown> & {
    slug?: string
    layout?: PersistedBlock[]
}

vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            logger: { info: mockPayloadLoggerInfo },
            auth: vi.fn().mockResolvedValue({
                user: { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
            }),
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'tenants' && id === mockTenant.id) return mockTenant
                if (collection === 'users') return mockFreshUser
                if (collection === 'media') return { id, url: 'https://example.com/media.jpg' }
                if (collection === 'ai-generation-records') return mockGenerationRecordDB.find((record) => record.id === id) ?? null
                return null
            }),
            find: vi.fn().mockImplementation(async ({ collection }) => {
                if (collection === 'sites') return { docs: mockSiteDB }
                if (collection === 'pages') return { docs: mockPageDB }
                if (collection === 'media') return { docs: mockMediaDB }
                if (collection === 'categories') return { docs: mockCategoryDB }
                return { docs: [] }
            }),
            count: vi.fn().mockImplementation(async ({ collection }) => {
                if (collection === 'products') return { totalDocs: mockProductDB.length }
                if (collection === 'blogs') return { totalDocs: mockCompleteBlogCount }
                return { totalDocs: 3 }
            }),
            create: vi.fn().mockImplementation(async ({ collection, data }) => {
                if (collection === 'sites' && mockSiteCreateFailure) throw mockSiteCreateFailure
                if (collection === 'pages' && mockPageCreateFailure && data.slug === mockPageCreateFailure.slug) {
                    mockFailedPageCreateData = structuredClone(data)
                    const { error } = mockPageCreateFailure
                    mockPageCreateFailure = null
                    throw error
                }
                if (collection === 'pages' && mockPageDB.some(
                    page => page.site === data.site && page.slug === data.slug,
                )) {
                    throw new Error('duplicate page slug')
                }
                if (collection === 'products' && typeof data.sku === 'string' && mockProductDB.some(
                    product => product.tenant === data.tenant
                        && String(product.sku).toLowerCase() === data.sku.toLowerCase(),
                )) {
                    throw new Error('products_sku_tenant_uniq')
                }
                const doc = { id: `new-${collection}-${++mockIdCounter}`, ...data }
                if (collection === 'sites') mockSiteDB.push(doc)
                if (collection === 'pages') mockPageDB.push(doc)
                if (collection === 'products') mockProductDB.push(doc)
                if (collection === 'ai-generation-records') mockGenerationRecordDB.push(doc)
                return doc
            }),
            update: vi.fn().mockImplementation(async ({ collection, id, data }) => {
                if (collection === 'pages') {
                    const pageIdx = mockPageDB.findIndex(page => page.id === id)
                    if (pageIdx > -1) mockPageDB[pageIdx] = { ...mockPageDB[pageIdx], ...data }
                    return mockPageDB[pageIdx]
                }
                if (collection === 'ai-generation-records') {
                    const recordIdx = mockGenerationRecordDB.findIndex((record) => record.id === id)
                    if (recordIdx > -1) mockGenerationRecordDB[recordIdx] = { ...mockGenerationRecordDB[recordIdx], ...data }
                    return mockGenerationRecordDB[recordIdx]
                }
                const idx = mockSiteDB.findIndex(s => s.id === id)
                if (idx > -1) mockSiteDB[idx] = { ...mockSiteDB[idx], ...data }
                return mockSiteDB[idx]
            }),
            delete: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'pages') mockPageDB = mockPageDB.filter(page => page.id !== id)
                if (collection === 'products') mockProductDB = mockProductDB.filter(product => product.id !== id)
                return {}
            }),
        })
    }
})

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

// Mock sample products — prevent real OpenAI/Unsplash calls in API-level tests
vi.mock('@/lib/ai/generate-sample-products', async (importOriginal) => ({
    // #2103 A3: the pure photo matcher stays real; only the AI/image work is mocked.
    matchPoolPhotosToProducts: (await importOriginal<typeof import('@/lib/ai/generate-sample-products')>()).matchPoolPhotosToProducts,
    prepareSampleProducts: vi.fn().mockResolvedValue({
        category: 'services',
        products: Array.from({ length: 6 }, (_, index) => ({
            name: `Sample Product ${index + 1}`,
            shortDescription: 'Sample product',
            description: 'A complete sample product.',
            price: 10 + index,
            imageKeyword: `sample product ${index + 1}`,
        })),
    }),
    generateSampleProducts: vi.fn().mockResolvedValue({
        products: Array.from({ length: 6 }, (_, index) => ({
            name: `Sample Product ${index + 1}`,
            shortDescription: 'Sample product',
            description: 'A complete sample product.',
            price: 10 + index,
            sku: `SAMPLE-${index + 1}`,
            inventory: 0,
            status: 'active',
        })),
        stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
    }),
}))

// gen-perf Wave 1 (plan 260703-1341): capture after() callbacks so tests can
// prove seeding is DEFERRED (scheduled, not awaited in-request) and then
// invoke the captured tasks to assert post-response behavior. NextRequest/
// NextResponse stay real via importOriginal.
vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    after: vi.fn(),
}))

// Seeder boundaries — the route schedules these via after(); mocked so tests
// observe scheduling without running GPT/Pixabay work.
vi.mock('@/lib/ai/seed-blog-posts', () => ({
    seedBlogPosts: vi.fn().mockResolvedValue(3),
    // Default regeneration path: three persisted rows already exist.
    prepareBlogPosts: vi.fn().mockResolvedValue([]),
    assignResolvedBlogThumbnails: vi.fn((posts, thumbnailIds) =>
        posts.map((post: Record<string, unknown>, index: number) => ({
            ...post,
            ...(thumbnailIds[index] !== undefined ? { thumbnailId: thumbnailIds[index] } : {}),
        })),
    ),
    persistBlogPosts: vi.fn().mockResolvedValue(3),
}))
vi.mock('@/lib/images/image-library-seeder', () => ({
    seedImageLibraryForSite: vi.fn().mockResolvedValue({ hero: [], gallery: [], about: null, team: [], features: [] }),
}))
vi.mock('@/lib/sso/sso-api-client', () => ({
    notifyStepComplete: vi.fn().mockResolvedValue(undefined),
}))

// Mock AI Generator (SSE logic)
// GH-1190: generateSiteWithAI now forwards events via onEvent callback (6th param) in real-time
// instead of returning them in the events[] array for post-hoc replay. Mock must call onEvent.
vi.mock('@/lib/ai/openai-generator', () => ({
    resolveSiteGenerationMode: vi.fn().mockResolvedValue({
        requestedGenMode: 'template-first',
        effectiveGenMode: 'template-first',
    }),
    generateSiteWithAI: vi.fn().mockImplementation(async (
        _rawBusinessInfo: unknown,
        _extra: unknown,
        _lang: unknown,
        _ref: unknown,
        _overrides: unknown,
        onEvent?: (e: { event: string; data: unknown }) => void,
    ) => {
        const mockEvents = [
            { event: 'theme_generated', data: { color: 'blue' } },
            { event: 'content_generated', data: { block: 'hero' } },
        ]
        mockEvents.forEach(e => onEvent?.(e))
        return {
            result: {
                siteName: 'AI Bakery',
                siteType: 'ecommerce',
                theme: { primaryColor: '#000' },
                seo: { title: 'SEO Bakery', description: 'Desc Bakery' },
                blocks: [{ blockType: 'hero', headline: 'Welcome to Bakery' }]
            },
            events: mockEvents,
            requestedGenMode: 'template-first',
            effectiveGenMode: 'template-first',
        }
    }),
}))

// The one-shot AI routes (rewrite-text, seo-generate…) run as AI platform tasks. The platform
// itself is faked at the HTTP edge (fetch); the caller's workspace is resolved here.
vi.mock('@/lib/ai-platform/context', async (importOriginal) => ({
    // Real membership checks (generate-site resolves its actor with actorForUserInTenant)
    ...(await importOriginal<typeof import('@/lib/ai-platform/context')>()),
    resolveActorForUser: vi.fn(async () => ({ user: { id: 'user-xyz' }, tenantId: 'tenant-1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

const platformFetchMock = vi.fn<typeof fetch>()

function platformTaskResponse(taskId: string, output: unknown) {
    return Response.json({
        taskId,
        promptVersion: `${taskId}@1`,
        requestId: 'req_1',
        output,
        usage: { provider: 'openai', model: 'gpt-4.1-mini', costUsdMicros: 40, latencyMs: 900, fallbacks: [] },
    })
}

function sentTaskInput(call = 0) {
    const [, init] = platformFetchMock.mock.calls[call]!
    return JSON.parse(String(init?.body)).input as Record<string, unknown>
}

function stubPlatform() {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubGlobal('fetch', platformFetchMock)
    platformFetchMock.mockReset()
}


describe('AI Streaming APIs', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockSiteDB = []
        mockPageDB = []
        mockTenant = { id: 'tenant-1', plan: 'pro', aiGenerationsCount: 0 }
        mockRateLimitAllowed = true
        mockPageCreateFailure = null
        mockSiteCreateFailure = null
        mockMediaDB = []
        mockProductDB = []
        mockCategoryDB = []
        mockGenerationRecordDB = []
        mockCompleteBlogCount = 3
        mockFailedPageCreateData = null
        mockIdCounter = 0
        mockFreshUser = null
        mockAuthContact = {}
    })

    describe('POST /api/ai/generate-site', () => {
        
        it('[TC-F35.M11] rejects a migration account that does not own the target before generation or writes', async () => {
            // Arrange
            const payload = await getPayload({ config: {} as Parameters<typeof getPayload>[0]['config'] })
            vi.mocked(payload.findByID).mockResolvedValueOnce({ id: 'target-site', tenant: 'foreign-tenant' })
            const input = { businessInfo: { businessName: 'Source shop', industry: 'ecommerce', products: 'Catalog', shortDescription: 'Original shop' } }
            const sourceBlueprint = { nativeContract: { format: 'pw2-reconstruction-contract' as const, version: '1.0.0' as const, source: {storeId:'11',url:'https://source.example',capturedAt:'',dumpHash:''}, site:{name:'Source shop',navigation:{},footer:{}},pages:[],reconciliation:[] }, storeId: '11', siteName: 'Source shop', description: '', storeSettings: {},
                navigation: { menus: [], menu_items: [], menu_lines: [], settings: [] }, pages: [], warnings: [], excludedPages: 0, excludedComponents: 0 }
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1', role: 'owner', status: 'active' }] } as unknown as GenerateSiteServiceContext['user']

            // Act
            const response = await generateSiteService({ payload, user, input, streaming: false,
                migration: { targetSiteId: 'target-site', sourceBlueprint } })

            // Assert
            expect(response.status).toBe(403)
            expect(generateSiteWithAI).not.toHaveBeenCalled()
            expect(generateSampleProducts).not.toHaveBeenCalled()
            expect(payload.create).not.toHaveBeenCalled()
            expect(payload.update).not.toHaveBeenCalled()
            expect(payload.delete).not.toHaveBeenCalled()
        })

        it('[TC-F35.M11] allows owned CLI migration to reach generation without a subscription', async () => {
            // Arrange
            const payload = await getPayload({ config: {} as Parameters<typeof getPayload>[0]['config'] })
            vi.mocked(payload.findByID).mockResolvedValueOnce({ id: 'target-site', tenant: 'tenant-1' })
            const input = { businessInfo: { businessName: 'Source shop', industry: 'ecommerce', products: 'Catalog', shortDescription: 'Original shop' } }
            const sourceBlueprint = { nativeContract: { format: 'pw2-reconstruction-contract' as const, version: '1.0.0' as const, source: {storeId:'11',url:'https://source.example',capturedAt:'',dumpHash:''}, site:{name:'Source shop',navigation:{},footer:{}},pages:[],reconciliation:[] }, storeId: '11', siteName: 'Source shop', description: '', storeSettings: {},
                navigation: { menus: [], menu_items: [], menu_lines: [], settings: [] }, pages: [], warnings: [], excludedPages: 0, excludedComponents: 0 }
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1', role: 'owner', status: 'active' }] } as unknown as GenerateSiteServiceContext['user']

            const { getActivePlanSubscription, canUse } = await import('@/lib/subscriptions/plan-subscription')
            const subscriptionImplementation = vi.mocked(getActivePlanSubscription).getMockImplementation()!
            vi.mocked(getActivePlanSubscription).mockResolvedValueOnce(null)
            // Act
            const response = await generateSiteService({ payload, user, input, streaming: false,
                migration: { targetSiteId: 'target-site', sourceBlueprint } })

            // Assert: reaching AI proves the migration bypasses both billing gates.
            expect(getActivePlanSubscription).not.toHaveBeenCalled()
            expect(canUse).not.toHaveBeenCalled()
            expect(generateSiteWithAI).toHaveBeenCalled()
            expect(response.status).not.toBe(403)
            vi.mocked(getActivePlanSubscription).mockReset()
            vi.mocked(getActivePlanSubscription).mockImplementation(subscriptionImplementation)
        })

        it('TC-F41-26: returns 400 and records only a safe validation incident for an authenticated rejected form', async () => {
             // Arrange
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({ extraInstructions: 'Make it pop' }) // Missing businessInfo
             })

             // Act
             const res = await GenerateSitePOST(req)
             const body = await res.json()

             // Assert
             expect(body.error.code).toBe('VALIDATION_ERROR')
             expect(body.error.details.fieldErrors).toHaveProperty('businessInfo')
             expect(mockGenerationRecordDB).toEqual([expect.objectContaining({
                 lifecycle: 'terminal', outcome: 'failed', recoveryStatus: 'none',
                 generationErrors: [expect.objectContaining({
                     phase: 'validate', locationType: 'input', code: 'FORM_INVALID',
                 })],
             })])
             expect(mockGenerationRecordDB[0]).not.toHaveProperty('inputSnapshot')
             expect(JSON.stringify(mockGenerationRecordDB)).not.toContain('Make it pop')
        })

        it('TC-F41-27: does not track an unauthenticated rejected form', async () => {
             // Arrange
             vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST', body: JSON.stringify({}),
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(400)
             expect(mockGenerationRecordDB).toHaveLength(0)
        })

        it('TC-F41-27: does not track malformed JSON because no safe field incident exists', async () => {
             // Arrange
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST', body: '{not-json',
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(400)
             expect(mockGenerationRecordDB).toHaveLength(0)
        })

        it('returns 200 JSON with generated site data when stream=false', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({ 
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })
             const res = await GenerateSitePOST(req)
             const result = await res.json()

             expect(res.status).toBe(200)
             expect(getCurrentUser).toHaveBeenCalledWith(req)
             expect(result.success).toBe(true)
             expect(result.siteName).toBe('AI Bakery')
             expect(mockSiteDB.length).toBe(1) // A site was created
             expect(mockPageDB.length).toBe(5) // Four generated pages + system 404
             expect(result.totalPages).toBe(4)
             expect(mockPageDB.map((page) => page.slug)).toEqual(['/', '/about', '/products', '/contact', '404'])
        })

        describe('[TC-AIREL-22] runs on the AI platform as the generating member', () => {
            const businessInfo = { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
            const generate = () => GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({ businessInfo }),
            }))

            afterEach(() => vi.unstubAllEnvs())

            it('enters the member\'s actor scope for the whole pipeline and records the effective mode', async () => {
                vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
                vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
                let seen: unknown = 'not-called'
                vi.mocked(generateSiteWithAI).mockImplementationOnce(async () => {
                    seen = currentAiActor()
                    return {
                        result: { siteName: 'AI Bakery', siteType: 'ecommerce', theme: {}, seo: { title: 'T', description: 'D' }, blocks: [{ blockType: 'hero', headline: 'Welcome' }] },
                        events: [],
                        requestedGenMode: 'ai-first',
                        effectiveGenMode: 'ai-first',
                    } as never
                })

                const res = await generate()

                expect(res.status).toBe(200)
                expect(seen).toMatchObject({ tenantId: 'tenant-1', user: { id: 'user-xyz' } })
                expect(vi.mocked(resolveSiteGenerationMode)).toHaveBeenCalledWith(undefined)
                expect(mockGenerationRecordDB[0]?.outputSnapshot).toMatchObject({
                    generationMode: { requested: 'ai-first', effective: 'ai-first' },
                })
            })

            it('generates rule-based and says why when the platform is on but nobody can be billed', async () => {
                vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
                vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
                const pendingMember = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1', status: 'pending' }] }
                vi.mocked(getCurrentUser).mockResolvedValueOnce(pendingMember as never)
                mockFreshUser = pendingMember
                let seen: unknown = 'not-called'
                vi.mocked(generateSiteWithAI).mockImplementationOnce(async () => {
                    seen = currentAiActor()
                    return {
                        result: { siteName: 'AI Bakery', siteType: 'ecommerce', theme: {}, seo: { title: 'T', description: 'D' }, blocks: [{ blockType: 'hero', headline: 'Welcome' }] },
                        events: [],
                        requestedGenMode: 'template-first',
                        effectiveGenMode: 'template-first',
                    } as never
                })

                const res = await generate()

                expect(res.status).toBe(200)
                expect(seen).toBeNull()
                expect(vi.mocked(resolveSiteGenerationMode)).toHaveBeenCalledWith('not_workspace_member')
                expect(mockGenerationRecordDB[0]?.outputSnapshot).toMatchObject({
                    generationMode: { requested: 'template-first', effective: 'template-first' },
                })
            })

            it('skips the platform entirely when it is not configured', async () => {
                vi.stubEnv('AI_PLATFORM_URL', '')

                const res = await generate()

                expect(res.status).toBe(200)
                expect(vi.mocked(resolveSiteGenerationMode)).toHaveBeenCalledWith('ai_unconfigured')
            })
        })

        it('TC-F41-01: creates a route-owned capture for the authenticated user after validation', async () => {
             // Arrange
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 headers: { 'x-generation-request-id': 'f41-auth-capture' },
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(200)
             expect(mockGenerationRecordDB).toHaveLength(1)
             expect(mockGenerationRecordDB[0]).toMatchObject({
                 endpoint: 'site-generator',
                 user: 'user-xyz',
                 traceId: 'f41-auth-capture',
                 inputSchemaVersion: 'f41.v1',
                 lifecycle: 'terminal',
                 outcome: 'succeeded',
                 status: 'success',
                 pageSummary: { expected: 4, persisted: 4, failed: 0 },
             })
             expect(mockGenerationRecordDB[0]?.site).toBe(mockSiteDB[0]?.id)
             expect(mockGenerationRecordDB[0]?.inputSnapshot).toMatchObject({
                businessInfo: { businessName: 'Bakery' },
             })
        })

        it('TC-F41-03: finalizes four-page generation as partial_failed when one page write fails', async () => {
             // Arrange
             mockPageCreateFailure = { slug: '/about', error: new Error('timeout writing page') }
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(200)
             expect(mockGenerationRecordDB[0]).toMatchObject({
                 lifecycle: 'terminal', outcome: 'partial_failed', status: 'failed',
                 pageSummary: { expected: 4, persisted: 3, failed: 1 },
             })
             expect(mockGenerationRecordDB[0]?.pageOutcomes).toEqual(expect.arrayContaining([
                 expect.objectContaining({ pageKey: '/about', status: 'failed', errorCode: 'PERSISTENCE_TIMEOUT' }),
             ]))
             expect(mockGenerationRecordDB[0]?.pageOutcomes.filter((page) => page.status === 'persisted')).toHaveLength(3)
        })

        it('TC-F41-02: finalizes failed when site persistence fails after composition', async () => {
             // Arrange
             mockSiteCreateFailure = new Error('site persistence unavailable')
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(500)
             expect(mockGenerationRecordDB[0]).toMatchObject({
                lifecycle: 'terminal', outcome: 'failed', status: 'failed', recoveryStatus: 'ticket_required',
                 pageSummary: { expected: 0, persisted: 0, failed: 0 },
             })
             expect(mockGenerationRecordDB[0]?.generationErrors).toEqual(expect.arrayContaining([
                 expect.objectContaining({ code: 'SITE_PERSISTENCE_FAILED', phase: 'site_persist' }),
             ]))
             expect(mockGenerationRecordDB[0]?.userSafeMessage).not.toContain('site persistence unavailable')
        })

        it('TC-F41-02: SSE failure emits a safe error event and finalizes the capture', async () => {
             // Arrange
             mockSiteCreateFailure = new Error('site persistence unavailable')
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             })

             // Act
             const res = await GenerateSitePOST(req)
             const stream = await res.text()

             // Assert
             expect(res.status).toBe(200)
             expect(stream).toContain('event: error')
             expect(stream).toContain('"code":"GENERATION_FAILED"')
             expect(stream).not.toContain('site persistence unavailable')
             expect(mockGenerationRecordDB[0]).toMatchObject({
                lifecycle: 'terminal', outcome: 'failed', status: 'failed', recoveryStatus: 'ticket_required',
             })
        })

        it('accepts a valid generated site with six pages', async () => {
             const page = (title: string, slug: string, blockType: string, isHomepage = false) => ({
                 title,
                 slug,
                 isHomepage,
                 blocks: [{
                     blockType,
                     variant: blockType === 'hero' ? 'centered' : undefined,
                     headline: `${title} content`,
                     subheadline: `${title} page for Bakery Relevance`,
                 }],
                 seo: { title, description: `${title} page` },
             })
             const pages = [
                 page('Home', '/', 'hero', true),
                 page('About', '/about', 'about'),
                 page('Services', '/services', 'features'),
                 page('Contact', '/contact', 'contact'),
                 page('Blog', '/blog', 'blog-list'),
                 page('Gallery', '/gallery', 'gallery'),
             ]
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce({
                 result: {
                     siteName: 'Bakery Relevance',
                     siteType: 'fnb',
                     theme: { primaryColor: '#78350f' },
                     seo: { title: 'Bakery Relevance', description: 'Fresh artisan bakery' },
                     blocks: pages[0]!.blocks,
                     pages,
                 },
                 events: [],
             } as Awaited<ReturnType<typeof generateSiteWithAI>>)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'Bakery Relevance',
                         industry: 'fnb',
                         products: 'Sourdough, croissants, and celebration cakes',
                         shortDescription: 'A neighbourhood artisan bakery in Kuala Lumpur',
                     },
                 }),
             })

             const res = await GenerateSitePOST(req)
             const result = await res.json()

             expect(res.status).toBe(200)
             expect(result.success).toBe(true)
             // #2103 A3: a shop also gets a CMS /products page (right after Home)
             expect(result.totalPages).toBe(7)
             expect(mockPageDB.map((savedPage) => savedPage.slug)).toEqual([
                 '/', '/products', '/about', '/services', '/contact', '/blog', '/gallery', '404',
             ])
        })

        it('removes generated CTA links whose target pages do not exist', async () => {
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce({
                 result: {
                     siteName: 'Butter & Bloom Bakery',
                     siteType: 'business',
                     theme: { primaryColor: '#7c2d12' },
                     seo: { title: 'Butter & Bloom Bakery', description: 'Fresh artisan bakery' },
                     language: 'en',
                     blocks: [],
                     pages: [
                         {
                             title: 'Home',
                             slug: '/',
                             isHomepage: true,
                             blocks: [
                                 { blockType: 'hero', variant: 'centered', headline: 'Fresh every morning', subheadline: 'Bread and pastries baked daily' },
                                 {
                                     blockType: 'cta',
                                     variant: 'banner',
                                     headline: 'Ready to order?',
                                     ctaLabel: 'Order Now',
                                     ctaUrl: '/order',
                                     secondaryCtaLabel: 'View Menu',
                                     secondaryCtaUrl: '/menu',
                                 },
                             ],
                             seo: { title: 'Home', description: 'Bakery homepage' },
                         },
                         {
                             title: 'About',
                             slug: '/about',
                             blocks: [{ blockType: 'about', headline: 'About us', body: 'Our bakery story' }],
                             seo: { title: 'About', description: 'About the bakery' },
                         },
                         {
                             title: 'Services',
                             slug: '/services',
                             blocks: [{ blockType: 'features', headline: 'Our services', items: [] }],
                             seo: { title: 'Services', description: 'Bakery services' },
                         },
                         {
                             title: 'Contact',
                             slug: '/contact',
                             blocks: [
                                 { blockType: 'contact', variant: 'split', headline: 'Contact us', email: 'hello@butterandbloom.test' },
                             ],
                             seo: { title: 'Contact', description: 'Contact the bakery' },
                         },
                         {
                             title: 'Blog',
                             slug: '/blog',
                             blocks: [{ blockType: 'blog-list', variant: 'grid', headline: 'Latest posts', limit: 3 }],
                             seo: { title: 'Blog', description: 'Bakery articles' },
                         },
                     ],
                 },
                 events: [],
             } as any)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'Butter & Bloom Bakery',
                         industry: 'Food & Beverage',
                         products: 'Artisan bread, pastries, and celebration cakes',
                         shortDescription: 'A neighborhood bakery serving fresh handcrafted bakes every day',
                     },
                 }),
             })

             const res = await GenerateSitePOST(req)
             expect(res.status).toBe(200)

             const homepage = mockPageDB.find((page: any) => page.slug === '/')
             const cta = homepage?.layout?.find((block: any) => block.blockType === 'cta')
             expect(cta).toMatchObject({
                 ctaLabel: 'Order Now',
                 ctaUrl: '/contact',
             })
             expect(cta?.secondaryCtaLabel).toBeUndefined()
             expect(cta?.secondaryCtaUrl).toBeUndefined()
        })

        // TC-F01.SLUG.01 — GH-820: AI multi-page path normalizes canonical slugs
        // Regression: AI was generating "free-trial" slug for contact page on SaaS businesses.
        it('normalizes canonical page slugs when AI returns non-standard slugs (GH-820)', async () => {
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce({
                 result: {
                     siteName: 'SaaS Startup',
                     siteType: 'business',
                     theme: { primaryColor: '#000' },
                     seo: { title: 'SaaS Startup', description: 'Desc' },
                     language: 'en',
                     blocks: [],
                     pages: [
                         { title: 'Homepage', slug: '/', isHomepage: true, blocks: [{ blockType: 'navigation', variant: 'simple', links: [{ label: 'Our Story', url: '/our-story' }, { label: 'Free Trial', url: '/free-trial' }] }, { blockType: 'hero', variant: 'centered', headline: 'Hello', subheadline: 'World', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' }, { blockType: 'footer', variant: 'simple', columns: [{ title: 'Pages', links: [{ label: 'Our Story', url: '/our-story' }, { label: 'Free Trial', url: '/free-trial' }] }] }], seo: { title: 'Home', description: 'Home page' } },
                         { title: 'Our Story', slug: 'our-story', isHomepage: false, blocks: [{ blockType: 'navigation', variant: 'simple', links: [] }, { blockType: 'hero', variant: 'centered', headline: 'About', subheadline: 'Us', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' }, { blockType: 'about', variant: 'image-right', headline: 'About Us', body: 'About us' }, { blockType: 'footer', variant: 'simple', columns: [{ title: 'Pages', links: [] }] }], seo: { title: 'About', description: 'About page' } },
                         { title: 'Features', slug: 'features', isHomepage: false, blocks: [{ blockType: 'navigation', variant: 'simple', links: [] }, { blockType: 'hero', variant: 'centered', headline: 'Features', subheadline: 'Features', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' }, { blockType: 'features', variant: 'grid-3', headline: 'Features', items: [] }, { blockType: 'footer', variant: 'simple', columns: [{ title: 'Pages', links: [] }] }], seo: { title: 'Features', description: 'Features page' } },
                         { title: 'Start Free Trial', slug: 'free-trial', isHomepage: false, blocks: [{ blockType: 'navigation', variant: 'simple', links: [] }, { blockType: 'hero', variant: 'centered', headline: 'Contact', subheadline: 'Contact', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' }, { blockType: 'contact', variant: 'form', headline: 'Contact Us', email: 'a@b.com' }, { blockType: 'footer', variant: 'simple', columns: [{ title: 'Pages', links: [] }] }], seo: { title: 'Contact', description: 'Contact page' } },
                         { title: 'Blog', slug: 'blog', isHomepage: false, blocks: [{ blockType: 'navigation', variant: 'simple', links: [] }, { blockType: 'hero', variant: 'centered', headline: 'Blog', subheadline: 'Blog', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' }, { blockType: 'blog-list', variant: 'grid', items: [] }, { blockType: 'footer', variant: 'simple', columns: [] }], seo: { title: 'Blog', description: 'Blog page' } },
                     ],
                 },
                 events: [],
             } as any)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'SaaS Startup', industry: 'Technology', products: 'Free trial SaaS', shortDescription: 'A SaaS product' }
                 })
             })
             await GenerateSitePOST(req)

             const slugs = mockPageDB.map((p: any) => p.slug)
             // contact block-based detection → must resolve to "/contact", not "free-trial"
             expect(slugs).toContain('/contact')
             expect(slugs).not.toContain('free-trial')
             expect(slugs).not.toContain('/free-trial')
             // about title detection → must resolve to "/about", not "our-story"
             expect(slugs).toContain('/about')
             expect(slugs).not.toContain('our-story')
             expect(slugs).not.toContain('/our-story')

             // GH-820: verify nav/footer link URLs inside saved pages use normalized slugs
             const homepageSaved = mockPageDB.find((p: any) => p.slug === '/')
             expect(homepageSaved).toBeDefined()

             const navBlock = homepageSaved?.layout?.find((b: any) => b.blockType === 'navigation')
             expect(navBlock).toBeDefined()
             const navUrls = (navBlock?.links ?? []).map((l: any) => l.url)
             expect(navUrls).toContain('/about')
             expect(navUrls).not.toContain('our-story')
             expect(navUrls).not.toContain('/our-story')
             expect(navUrls).toContain('/contact')
             expect(navUrls).not.toContain('free-trial')
             expect(navUrls).not.toContain('/free-trial')

             const footerBlock = homepageSaved?.layout?.find((b: any) => b.blockType === 'footer')
             expect(footerBlock).toBeDefined()
             const pagesCol = footerBlock?.columns?.[0]
             expect(pagesCol).toBeDefined()
             const footerUrls = (pagesCol?.links ?? []).map((l: any) => l.url)
             expect(footerUrls).toContain('/about')
             expect(footerUrls).not.toContain('our-story')
             expect(footerUrls).toContain('/contact')
             expect(footerUrls).not.toContain('free-trial')
        })

        it('[TC-TF-025] normalizes generated products-grid defaults by page slug before persistence (GH-1588)', async () => {
             // Arrange
             const expectedProductsCopy = resolveBlockContent('products', 'en', 'Grid Shop').content as {
                 headline?: string
                 subheadline?: string
             }

             const generatedSite = {
                 result: {
                     siteName: 'Grid Shop',
                     siteType: 'ecommerce',
                     theme: {
                         primaryColor: '#000000',
                         secondaryColor: '#ffffff',
                         fontHeading: 'DM Sans',
                         fontBody: 'Inter',
                         colorMode: 'light',
                     },
                     seo: { title: 'Grid Shop', description: 'Desc' },
                     language: 'en',
                     blocks: [],
                     pages: [
                         {
                             title: 'Home',
                             slug: '/',
                             isHomepage: true,
                             blocks: [
                                 { blockType: 'navigation', variant: 'simple', links: [] },
                                 { blockType: 'hero', variant: 'centered', headline: 'Homepage Hero', subheadline: 'Welcome', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' },
                                 {
                                     blockType: 'products-grid',
                                     variant: 'grid-3',
                                     count: 24,
                                     items: [
                                         { name: 'Home Item 1', price: 'RM 10.00' },
                                         { name: 'Home Item 2', price: 'RM 20.00' },
                                     ],
                                 },
                                 { blockType: 'footer', variant: 'simple', columns: [] },
                             ],
                             seo: { title: 'Home', description: 'Home page' },
                         },
                         {
                             title: 'Products',
                             slug: '/products',
                             isHomepage: false,
                             blocks: [
                                 { blockType: 'navigation', variant: 'simple', links: [] },
                                 { blockType: 'hero', variant: 'centered', headline: 'Products Hero', subheadline: 'Browse', primaryButtonLabel: 'CTA', primaryButtonUrl: '/' },
                                 {
                                     blockType: 'products-grid',
                                     variant: 'grid-3',
                                     limit: 7.9,
                                     count: 8,
                                     items: [
                                         { name: 'Product Item 1', price: 'RM 30.00' },
                                         { name: 'Product Item 2', price: 'RM 40.00' },
                                     ],
                                 },
                                 { blockType: 'footer', variant: 'simple', columns: [] },
                             ],
                             seo: { title: 'Products', description: 'Products page' },
                         },
                         { title: 'About', slug: '/about', isHomepage: false, blocks: [{ blockType: 'about', headline: 'About', body: 'About Grid Shop' }], seo: { title: 'About', description: 'About page' } },
                         { title: 'Blog', slug: '/blog', isHomepage: false, blocks: [{ blockType: 'blog-list', headline: 'Blog' }], seo: { title: 'Blog', description: 'Blog page' } },
                         { title: 'Contact', slug: '/contact', isHomepage: false, blocks: [{ blockType: 'contact', headline: 'Contact', email: 'hello@grid.test' }], seo: { title: 'Contact', description: 'Contact page' } },
                     ],
                 },
                 events: [],
             } satisfies Awaited<ReturnType<typeof generateSiteWithAI>>
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce(generatedSite)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Grid Shop', industry: 'Retail', products: 'Curated goods', shortDescription: 'A modern shop' }
                 })
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(200)

             const persistedPages = mockPageDB as PersistedPage[]
             const homepageSaved = persistedPages.find((page) => page.slug === '/')
             const productsSaved = persistedPages.find((page) => page.slug === '/products')
             expect(homepageSaved).toBeDefined()
             expect(productsSaved).toBeDefined()

             const homepageGrid = homepageSaved?.layout?.find((block) => block.blockType === 'products-grid')
             const productsGrid = productsSaved?.layout?.find((block) => block.blockType === 'products-grid')
             expect(homepageGrid).toBeDefined()
             expect(productsGrid).toBeDefined()

             expect(homepageGrid.showCategoryFilter).toBe(false)
             expect(productsGrid.showCategoryFilter).toBe(true)
             expect(homepageGrid.headline).toBe(expectedProductsCopy.headline)
             expect(homepageGrid.subheadline).toBe(expectedProductsCopy.subheadline)
             expect(productsGrid.headline).toBe(expectedProductsCopy.headline)
             expect(productsGrid.subheadline).toBe(expectedProductsCopy.subheadline)
             expect(homepageGrid.limit).toBe(20)
             expect(productsGrid.limit).toBe(7)
             expect(homepageGrid.count).toBeUndefined()
             expect(productsGrid.count).toBeUndefined()

             const homepageHero = homepageSaved?.layout?.find((block) => block.blockType === 'hero')
             expect(homepageHero?.headline).toBe('Homepage Hero')
        })

        it('[TC-TF-026] keeps fallback /products page unchanged when no products-grid is generated (GH-1588)', async () => {
             // Arrange
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Fallback Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(200)
             const productsSaved = (mockPageDB as PersistedPage[]).find((page) => page.slug === '/products')
             expect(productsSaved).toBeDefined()
             expect(productsSaved?.layout?.some((block) => block.blockType === 'products-grid')).toBe(false)
        })

        it('[TC-TF-027] preserves Malay products-grid defaults when page creation retries without image refs (GH-1588)', async () => {
             // Arrange
             const expectedProductsCopy = resolveBlockContent('products', 'ms', 'Retry Shop').content as {
                 headline?: string
                 subheadline?: string
             }
             const generatedSite = {
                 result: {
                     siteName: 'Retry Shop',
                     siteType: 'ecommerce',
                     theme: {
                         primaryColor: '#000000',
                         secondaryColor: '#ffffff',
                         fontHeading: 'DM Sans',
                         fontBody: 'Inter',
                         colorMode: 'light',
                     },
                     seo: { title: 'Retry Shop', description: 'Desc' },
                     language: 'ms',
                     blocks: [],
                     pages: [
                         {
                             title: 'Home',
                             slug: '/',
                             isHomepage: true,
                             blocks: [{ blockType: 'hero', variant: 'centered', headline: 'Home' }],
                             seo: { title: 'Home', description: 'Home page' },
                         },
                         {
                             title: 'Products',
                             slug: '/products',
                             isHomepage: false,
                             blocks: [{
                                 blockType: 'products-grid',
                                 variant: 'grid-3',
                                 count: 9,
                                 image: 123,
                                 items: [{ name: 'Retry Item', price: 'RM 10.00' }],
                             }],
                             seo: { title: 'Products', description: 'Products page' },
                         },
                         { title: 'About', slug: '/about', isHomepage: false, blocks: [{ blockType: 'about', headline: 'Tentang', body: 'Tentang Retry Shop' }], seo: { title: 'Tentang', description: 'Tentang kami' } },
                         { title: 'Blog', slug: '/blog', isHomepage: false, blocks: [{ blockType: 'blog-list', headline: 'Blog' }], seo: { title: 'Blog', description: 'Blog' } },
                         { title: 'Contact', slug: '/contact', isHomepage: false, blocks: [{ blockType: 'contact', headline: 'Hubungi', email: 'hello@retry.test' }], seo: { title: 'Hubungi', description: 'Hubungi kami' } },
                     ],
                 },
                 events: [],
             } satisfies Awaited<ReturnType<typeof generateSiteWithAI>>
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce(generatedSite)
             mockMediaDB = [{
                 id: 123,
                 filename: 'retry-product.jpg',
                 mimeType: 'image/jpeg',
                 filesize: 1024,
             }]
             mockPageCreateFailure = {
                 slug: '/products',
                 error: new Error('upload foreign key failed'),
             }
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Retry Shop', industry: 'Retail', products: 'Goods', shortDescription: 'A retry shop' },
                     language: 'ms',
                     generationLocale: 'ms',
                 })
             })

             // Act
             const res = await GenerateSitePOST(req)

             // Assert
             expect(res.status).toBe(200)
             expect(mockPageCreateFailure).toBeNull()
             const failedProductsPage = mockFailedPageCreateData as PersistedPage | null
             const failedProductsGrid = failedProductsPage?.layout?.find((block) => block.blockType === 'products-grid')
             expect(failedProductsGrid?.image).toBe(123)
             const productsSaved = (mockPageDB as PersistedPage[]).find((page) => page.slug === '/products')
             const productsGrid = productsSaved?.layout?.find((block) => block.blockType === 'products-grid')
             expect(productsGrid).toMatchObject({
                 showCategoryFilter: true,
                 headline: expectedProductsCopy.headline,
                 subheadline: expectedProductsCopy.subheadline,
                 limit: 9,
             })
             expect(productsGrid?.count).toBeUndefined()
             expect(productsGrid?.image).toBeUndefined()
        })

        it('returns text/event-stream response for SSE mode when stream=true', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                 method: 'POST',
                 headers: { 'X-Generation-Request-Id': 'test_generation_1190' },
                 body: JSON.stringify({ 
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })
             const res = await GenerateSitePOST(req)
             
             // Verify it's streaming
             expect(res.status).toBe(200)
             expect(res.headers.get('Content-Type')).toBe('text/event-stream')
             
             // Check the readable stream body
             const reader = res.body?.getReader()
             expect(reader).toBeDefined()
             
             // The acceptance boundary is always the first event. Generation
             // events follow while the backend continues its pipeline.
             const { value } = await reader!.read()
             const text = new TextDecoder().decode(value)
             expect(text).toContain('event: generation_accepted')
             expect(text).toContain('"generationRequestId":"test_generation_1190"')
             
             let rest = ''
             while (true) {
                 const { done, value: nextValue } = await reader!.read()
                 if (done) break
                 rest += new TextDecoder().decode(nextValue)
             }
             expect(rest).toContain('event: theme_generated')
             expect(rest).toContain('event: done')
        })

        it('[TC-F35.M11] HTTP input cannot bypass missing subscription with a migration flag', async () => {
            const { getActivePlanSubscription } = await import('@/lib/subscriptions/plan-subscription')
            vi.mocked(getActivePlanSubscription).mockResolvedValueOnce(null)
            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh bread' },
                    migration: { targetSiteId: 'target-site' },
                    skipSubscription: true,
                }),
            })
            const res = await GenerateSitePOST(req)
            expect(res.status).toBe(403)
            expect((await res.json()).error.code).toBe('SUBSCRIPTION_EXPIRED')
            expect(generateSiteWithAI).not.toHaveBeenCalled()
        })

        it('[TC-F34-06] returns 403 when website_builder feature is locked on current plan', async () => {
             const { canUse } = await import('@/lib/subscriptions/plan-subscription')
             vi.mocked(canUse).mockResolvedValueOnce(false)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'Bakery',
                         industry: 'Food',
                         products: 'Bread',
                         shortDescription: 'Fresh artisan bakery'
                     }
                 })
             })

             const res = await GenerateSitePOST(req)
             const body = await res.json()

             expect(res.status).toBe(403)
             expect(body.error.code).toBe('FEATURE_LOCKED')
             expect(mockSiteDB).toHaveLength(0)
             expect(mockPageDB).toHaveLength(0)
        })

        it('returns 400 when business info contains restricted content', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'Underground Store',
                         industry: 'Retail',
                         products: 'gun for sale',
                         shortDescription: 'restricted catalog'
                     }
                 })
             })

             const res = await GenerateSitePOST(req)
             const body = await res.json()

             expect(res.status).toBe(400)
             expect(body.code).toBe('CONTENT_UNSAFE')
             expect(mockSiteDB).toHaveLength(0)
             expect(mockPageDB).toHaveLength(0)
        })

        it('sets generationStatus to completed on success path', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })
             const res = await GenerateSitePOST(req)
             expect(res.status).toBe(200)

             // Site should have generationStatus set to completed
             const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
             const resolvedPayload = await mockPayload
             const updateCalls = vi.mocked(resolvedPayload.update).mock.calls
             const completedCall = updateCalls.find(
                 (c: [{ collection: string; data?: { generationStatus?: string } }]) =>
                     c[0].collection === 'sites' && c[0].data?.generationStatus === 'completed'
             )
             expect(completedCall).toBeDefined()
        })

        it('[TC-GENPERF-W3-04] does not mark the site completed before required product work settles', async () => {
             // Arrange
             let resolveProducts: (value: { products: Array<Record<string, unknown>>; stats: { rateLimited: number; uploadFailed: number; noImage: number } }) => void = () => {}
             vi.mocked(generateSampleProducts).mockReturnValueOnce(new Promise((resolve) => { resolveProducts = resolve }))
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })

             // Act — let page/site creation reach the product completion barrier.
             const responsePromise = GenerateSitePOST(req)
             await vi.waitFor(() => expect(mockSiteDB.length).toBeGreaterThan(0))

             // Assert — externally observable status remains generating.
             expect(mockSiteDB.at(-1)?.generationStatus).toBe('generating')
             resolveProducts({
                 products: Array.from({ length: 6 }, (_, index) => ({
                     name: `Pending Product ${index + 1}`,
                     shortDescription: 'Sample product',
                     description: 'A complete sample product.',
                     price: 10,
                     sku: `PENDING-${index + 1}`,
                     inventory: 0,
                 })),
                 stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
             })
             const response = await responsePromise
             expect(response.status).toBe(200)
             expect(mockSiteDB.at(-1)?.generationStatus).toBe('completed')
        })

        it('[TC-GENPERF-W3-20] completes when fewer than six products persist', async () => {
             vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                 products: Array.from({ length: 5 }, (_, index) => ({
                     name: `Short Product ${index + 1}`,
                     shortDescription: 'Sample product',
                     description: 'A complete sample product.',
                     price: 10,
                     sku: `SHORT-${index + 1}`,
                     inventory: 0,
                 })),
                 stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
             })

             const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             }))

             expect(res.status).toBe(200)
             expect(mockSiteDB.at(-1)?.generationStatus).toBe('completed')
        })

        it('[TC-GENPERF-W3-25] regeneration accepts partial product generation', async () => {
             const payload = await getPayload({ config: {} as never })
             mockSiteDB = [{
                 id: 'site-existing',
                 tenant: 'tenant-1',
                 name: 'Existing Bakery',
                 generationStatus: 'completed',
             }]
             mockPageDB = [
                 { id: 'old-home', site: 'site-existing', title: 'Old Home', slug: '/', isHomepage: true, layout: [] },
                 { id: 'old-about', site: 'site-existing', title: 'Old About', slug: '/about', isHomepage: false, layout: [] },
                 { id: 'old-products', site: 'site-existing', title: 'Old Products', slug: '/products', isHomepage: false, layout: [] },
                 { id: 'old-blog', site: 'site-existing', title: 'Old Blog', slug: '/blog', isHomepage: false, layout: [] },
                 { id: 'old-contact', site: 'site-existing', title: 'Old Contact', slug: '/contact', isHomepage: false, layout: [] },
                 { id: 'old-404', site: 'site-existing', title: '404', slug: '404', isHomepage: false, layout: [] },
             ]
             vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                 products: Array.from({ length: 5 }, (_, index) => ({
                     name: `Short Product ${index + 1}`,
                     shortDescription: 'Sample product',
                     description: 'A complete sample product.',
                     price: 10,
                     sku: `REGEN-SHORT-${index + 1}`,
                     inventory: 0,
                 })),
                 stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
             })

             const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'New Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             }))

             expect(res.status).toBe(200)
             expect(mockSiteDB[0]?.generationStatus).toBe('completed')
             expect(mockPageDB.map(page => page.slug).sort()).toEqual(
                 ['/', '/about', '/contact', '/products', '404'].sort(),
             )
             const deletedIds = vi.mocked(payload.delete).mock.calls.map(([arg]) => arg.id)
             expect(deletedIds).toContain('old-home')
             expect(deletedIds).toContain('old-404')
             expect(mockPageDB.some(page => page.id === 'old-home')).toBe(false)
             expect(mockPageDB.some(page => page.id === 'old-404')).toBe(false)
             expect(mockPageDB.some(page => String(page.slug).startsWith('generation-'))).toBe(false)
        })

        it('[TC-GENPERF-W3-26] regeneration replaces old pages directly with canonical pages', async () => {
             const payload = await getPayload({ config: {} as never })
             mockSiteDB = [{
                 id: 'site-existing',
                 tenant: 'tenant-1',
                 name: 'Existing Bakery',
                 generationStatus: 'completed',
             }]
             mockPageDB = [
                 { id: 'old-home', site: 'site-existing', title: 'Old Home', slug: '/', isHomepage: true, layout: [] },
                 { id: 'old-about', site: 'site-existing', title: 'Old About', slug: '/about', isHomepage: false, layout: [] },
                 { id: 'old-products', site: 'site-existing', title: 'Old Products', slug: '/products', isHomepage: false, layout: [] },
                 { id: 'old-blog', site: 'site-existing', title: 'Old Blog', slug: '/blog', isHomepage: false, layout: [] },
                 { id: 'old-contact', site: 'site-existing', title: 'Old Contact', slug: '/contact', isHomepage: false, layout: [] },
                 { id: 'old-404', site: 'site-existing', title: '404', slug: '404', isHomepage: false, layout: [] },
             ]

             const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'New Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             }))

             expect(res.status).toBe(200)
             expect(mockSiteDB[0]?.generationStatus).toBe('completed')
             expect(mockSiteDB[0]?.name).toBe('AI Bakery')
             expect(mockPageDB.map(page => page.slug).sort()).toEqual(
                 ['/', '/about', '/contact', '/products', '404'].sort(),
             )
             expect(mockPageDB.some(page => String(page.slug).startsWith('generation-'))).toBe(false)
             expect(mockPageDB.some(page => page.id === 'old-home')).toBe(false)
             expect(mockPageDB.some(page => page.id === 'old-404')).toBe(false)

             const generatedPageCreates = vi.mocked(payload.create).mock.calls.filter(
                 ([arg]) => arg.collection === 'pages' && arg.data?.slug !== '404',
             )
             expect(generatedPageCreates).toHaveLength(4)
             expect(generatedPageCreates.some(([arg]) => arg.data?.slug === '/' && arg.data?.isHomepage === true)).toBe(true)
             expect(generatedPageCreates.every(([arg]) => !String(arg.data?.slug).startsWith('generation-'))).toBe(true)
        })

        it('[TC-GENPERF-W3-29] regeneration follows the original sample-product flow', async () => {
             mockSiteDB = [{
                 id: 'site-existing',
                 tenant: 'tenant-1',
                 name: 'Existing Bakery',
                 generationStatus: 'completed',
             }]
             mockPageDB = [
                 { id: 'old-home', site: 'site-existing', title: 'Old Home', slug: '/', isHomepage: true, layout: [] },
                 { id: 'old-about', site: 'site-existing', title: 'Old About', slug: '/about', isHomepage: false, layout: [] },
                 { id: 'old-products', site: 'site-existing', title: 'Old Products', slug: '/products', isHomepage: false, layout: [] },
                 { id: 'old-blog', site: 'site-existing', title: 'Old Blog', slug: '/blog', isHomepage: false, layout: [] },
                 { id: 'old-contact', site: 'site-existing', title: 'Old Contact', slug: '/contact', isHomepage: false, layout: [] },
                 { id: 'old-404', site: 'site-existing', title: '404', slug: '404', isHomepage: false, layout: [] },
             ]
             mockProductDB = Array.from({ length: 6 }, (_, index) => ({
                 id: `existing-product-${index + 1}`,
                 tenant: 'tenant-1',
                 site: 'site-existing',
                 sku: `BUS-${String(index + 1).padStart(3, '0')}`,
             }))

             const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'New Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             }))

             expect(res.status).toBe(200)
             expect(vi.mocked(generateSampleProducts)).toHaveBeenCalledTimes(1)
             expect(mockProductDB).toHaveLength(12)
             expect(mockProductDB.filter(product => String(product.id).startsWith('existing-product-'))).toHaveLength(6)
        })

        it('[TC-GENPERF-W3-31] marks regeneration failed when the old-page read fails', async () => {
             const payload = await getPayload({ config: {} as never })
             const originalFind = vi.mocked(payload.find).getMockImplementation()!
             mockSiteDB = [{
                 id: 'site-existing',
                 tenant: 'tenant-1',
                 name: 'Existing Bakery',
                 generationStatus: 'completed',
             }]
             vi.mocked(payload.find).mockImplementation(async (args) => {
                 if (args.collection === 'pages') throw new Error('old page read failed')
                 return originalFind(args)
             })

             try {
                 const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                     method: 'POST',
                     body: JSON.stringify({
                         businessInfo: { businessName: 'New Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                     }),
                 }))

                 expect(res.status).toBe(500)
                 expect(mockSiteDB[0]?.generationStatus).toBe('failed')
             } finally {
                 vi.mocked(payload.find).mockImplementation(originalFind)
             }
        })

        it('[TC-GENPERF-W3-32] schedules optional slug sync after the response path', async () => {
             const payload = await getPayload({ config: {} as never })
             const originalFindByID = vi.mocked(payload.findByID).getMockImplementation()!
             vi.mocked(payload.findByID).mockImplementation(async (args) => {
                 if (args.collection === 'tenants') {
                     return mockTenant
                 }
                 return originalFindByID(args)
             })

             try {
                 const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                     method: 'POST',
                     body: JSON.stringify({
                         businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                     }),
                 }))

                 expect(res.status).toBe(200)
                 // #2103 A1: the only tenant read is the single FACTS lookup (WhatsApp / address / enabled payments)
                 // before generation — the slug sync itself still runs after the response.
                 const tenantReads = vi.mocked(payload.findByID).mock.calls.filter(([arg]) => arg.collection === 'tenants')
                 expect(tenantReads).toHaveLength(1)
                 expect(tenantReads[0]![0]).toMatchObject({ depth: 0 })
             } finally {
                 vi.mocked(payload.findByID).mockImplementation(originalFindByID)
             }
        })

        it('[TC-GENPERF-W3-21] does not block completion on blog count', async () => {
             const payload = await getPayload({ config: {} as never })
             vi.mocked(payload.count).mockResolvedValueOnce({ totalDocs: 2 } as never)

             const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                 }),
             }))

             expect(res.status).toBe(200)
             expect(mockSiteDB.at(-1)?.generationStatus).toBe('completed')
        })

        it('[TC-GENPERF-W3-22] completes when a page persists after media refs are stripped', async () => {
             const payload = await getPayload({ config: {} as never })
             const originalCreate = vi.mocked(payload.create).getMockImplementation()!
             let rejectedImageWrites = 0
             vi.mocked(payload.create).mockImplementation(async (args) => {
                 // Payload reports the nested image FK failure at insert time;
                 // the persisted shape has already passed through media normalization.
                 // Exhaust the transient retry wrapper so the strip-media
                 // fallback is the write that finally persists the page.
                 if (args.collection === 'pages' && args.data?.slug !== '404' && rejectedImageWrites < 3) {
                     const hero = (args.data?.layout as Array<Record<string, unknown>> | undefined)
                         ?.find(block => block.blockType === 'hero')
                     if (hero) hero.image = 123
                     rejectedImageWrites++
                     throw new Error('pages_blocks_hero_image_id_media_id_fk violates foreign key constraint')
                 }
                 return originalCreate(args)
             })

             try {
                 const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                     method: 'POST',
                     body: JSON.stringify({
                         businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                     }),
                 }))

                 expect(rejectedImageWrites).toBe(3)
                 expect(res.status).toBe(200)
                 expect(mockSiteDB.at(-1)?.generationStatus).toBe('completed')
                 const completedWrites = vi.mocked(payload.update).mock.calls.filter(
                     ([arg]) => arg.collection === 'sites' && arg.data?.generationStatus === 'completed',
                 )
                 expect(completedWrites).toHaveLength(1)
             } finally {
                 vi.mocked(payload.create).mockImplementation(originalCreate)
             }
        })

        it('[TC-GENPERF-W3-23] completes when stale product media falls back to image-less rows', async () => {
             const payload = await getPayload({ config: {} as never })
             const originalCreate = vi.mocked(payload.create).getMockImplementation()!
             vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                 products: Array.from({ length: 6 }, (_, index) => ({
                     name: `Image Product ${index + 1}`,
                     shortDescription: 'Sample product',
                     description: 'A complete sample product.',
                     price: 10,
                     sku: `IMAGE-${index + 1}`,
                     inventory: 0,
                     imageId: 700 + index,
                 })),
                 stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
             })
             vi.mocked(payload.create).mockImplementation(async (args) => {
                 if (args.collection === 'products' && Array.isArray(args.data?.images)) {
                     const error = new Error('products_images_image_id_media_id_fk violates foreign key constraint') as Error & { code?: string }
                     error.code = '23503'
                     throw error
                 }
                 return originalCreate(args)
             })

             try {
                 const res = await GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                     method: 'POST',
                     body: JSON.stringify({
                         businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                     }),
                 }))

                 expect(res.status).toBe(200)
                 const imageLessProducts = vi.mocked(payload.create).mock.calls.filter(
                     ([arg]) => arg.collection === 'products' && !Array.isArray(arg.data?.images),
                 )
                 expect(imageLessProducts).toHaveLength(6)
                 expect(mockSiteDB.at(-1)?.generationStatus).toBe('completed')
             } finally {
                 vi.mocked(payload.create).mockImplementation(originalCreate)
             }
        })

        it('[TC-GENPERF-W3-24] continues generation after 75 seconds have elapsed', async () => {
             const payload = await getPayload({ config: {} as never })
             let now = 1_000_000
             const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
             let resolveProducts: (value: Awaited<ReturnType<typeof generateSampleProducts>>) => void = () => {}
             vi.mocked(generateSampleProducts).mockReturnValueOnce(new Promise((resolve) => { resolveProducts = resolve }))

             try {
                 const responsePromise = GenerateSitePOST(new NextRequest('http://localhost:3000/api/ai/generate-site', {
                     method: 'POST',
                     body: JSON.stringify({
                         businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                     }),
                 }))
                 await vi.waitFor(() => expect(mockPageDB).toHaveLength(5))

                 now += 75_000
                 resolveProducts({
                     products: Array.from({ length: 6 }, (_, index) => ({
                         name: `Late Product ${index + 1}`,
                         shortDescription: 'Sample product',
                         description: 'A complete sample product.',
                         price: 10,
                         sku: `LATE-${index + 1}`,
                         inventory: 0,
                         status: 'active',
                         imageId: 700 + index,
                     })),
                     stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
                 })

                 const res = await responsePromise
                 expect(res.status).toBe(200)
                 expect(vi.mocked(payload.create).mock.calls.filter(([arg]) => arg.collection === 'products')).toHaveLength(6)
                 expect(vi.mocked(payload.update).mock.calls.some(
                     ([arg]) => arg.collection === 'sites' && arg.data?.generationStatus === 'failed',
                 )).toBe(false)
             } finally {
                 nowSpy.mockRestore()
             }
        })

        it('sets generationStatus to generating before creating pages', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                 })
             })
             await GenerateSitePOST(req)

             // Site should have been created with generationStatus = 'generating'
             const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
             const resolvedPayload = await mockPayload
             const createCalls = vi.mocked(resolvedPayload.create).mock.calls
             const siteCreateCall = createCalls.find(
                 (c: [{ collection: string; data?: { generationStatus?: string } }]) =>
                     c[0].collection === 'sites'
             )
             expect(siteCreateCall).toBeDefined()
             expect(siteCreateCall![0].data.generationStatus).toBe('generating')
        })

        describe('contactInfo persistence (TC-F01-W.09, GH-2048)', () => {
            const generate = async () => {
                const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                    method: 'POST',
                    body: JSON.stringify({
                        businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                    }),
                })
                await GenerateSitePOST(req)
                const resolvedPayload = await vi.mocked(getPayload).mock.results[0]?.value
                return resolvedPayload as { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
            }
            const siteWrite = (calls: Array<[{ collection: string; data?: { contactInfo?: Record<string, string> } }]>) =>
                calls.find((c) => c[0].collection === 'sites')?.[0].data

            it('new site: saves account email + phone as contactInfo', async () => {
                mockAuthContact = { email: 'Owner@Login.my', phone: '60123456789' }
                const p = await generate()
                expect(siteWrite(p.create.mock.calls as never)?.contactInfo)
                    .toEqual({ email: 'owner@login.my', phone: '60123456789' })
            })

            it('new site: omits contactInfo when the account has no usable contact (QC email, no phone)', async () => {
                mockAuthContact = { email: 'qa@primeweb.local' }
                const p = await generate()
                const data = siteWrite(p.create.mock.calls as never)
                expect(data).toBeDefined()
                expect(data?.contactInfo).toBeUndefined()
            })

            it('regenerate: keeps contactInfo the owner edited, account only fills empty fields', async () => {
                mockAuthContact = { email: 'owner@login.my', phone: '60123456789' }
                mockSiteDB = [{ id: 'site-existing', tenant: 'tenant-1', name: 'Bakery', generationStatus: 'completed', contactInfo: { email: 'shop@mybiz.my' } }]
                const p = await generate()
                expect(siteWrite(p.update.mock.calls as never)?.contactInfo)
                    .toEqual({ email: 'shop@mybiz.my', phone: '60123456789' })
            })
        })

        // TC-F26-01-02 (extension): user-confirmed source locale persists verbatim.
        // For non en/ms/vi the builder collapses `language` to 'auto' (prompt only supports those),
        // so the real code is sent separately as `generationLocale` and must win over result.language.
        it('persists user-confirmed generationLocale verbatim over collapsed language (TC-F26-01-02)', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: { businessName: 'すし', industry: 'Food', products: '寿司', shortDescription: '新鮮な寿司' },
                     language: 'auto',
                     generationLocale: 'ja',
                 })
             })
             await GenerateSitePOST(req)

             const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
             const resolvedPayload = await mockPayload
             const createCalls = vi.mocked(resolvedPayload.create).mock.calls
             const siteCreateCalls = createCalls.filter(
                 (c: [{ collection: string; data?: { generationLocale?: string } }]) =>
                     c[0].collection === 'sites'
             )
             const siteCreateCall = siteCreateCalls.at(-1)
             expect(siteCreateCall).toBeDefined()
             expect(siteCreateCall![0].data.generationLocale).toBe('ja')
        })

        it('localizes an aliased About Us fallback in the persisted German Blog hero', async () => {
             injectBlockStrings('de', {
                 ...getBlockStrings('en'),
                 navigation: {
                     ...getBlockStrings('en').navigation,
                     about: 'Über uns',
                     getStarted: 'Kontakt aufnehmen',
                 },
             })
             vi.mocked(generateSiteWithAI).mockResolvedValueOnce({
                 result: {
                     siteName: 'GrünRaum Innenarchitektur',
                     siteType: 'business',
                     theme: { primaryColor: '#24466f' },
                     seo: {
                         title: 'GrünRaum Innenarchitektur',
                         description: 'Nachhaltige Innenarchitektur in Berlin.',
                     },
                     language: 'de',
                     blockLang: 'de',
                     blocks: [],
                     pages: [
                         {
                             title: 'Startseite',
                             slug: '/',
                             isHomepage: true,
                             blocks: [
                                 { blockType: 'navigation', variant: 'simple', links: [] },
                                 {
                                     blockType: 'hero',
                                     variant: 'centered',
                                     headline: 'Nachhaltige Räume',
                                     subheadline: 'Innenarchitektur für moderne Unternehmen.',
                                     ctaButtons: [
                                         { label: 'Kontakt aufnehmen', url: '/contact', style: 'primary' },
                                         { label: 'Über uns', url: '/about', style: 'secondary' },
                                     ],
                                 },
                                 { blockType: 'footer', variant: 'simple', columns: [] },
                             ],
                             seo: { title: 'Startseite', description: 'Nachhaltige Räume.' },
                         },
                         {
                             title: 'Blog',
                             slug: '/blog',
                             isHomepage: false,
                             blocks: [
                                 {
                                     blockType: 'hero',
                                     variant: 'split-left',
                                     headline: 'Neuigkeiten und Inspirationen',
                                     subheadline: 'Aktuelle Projekte und nachhaltige Gestaltung.',
                                     ctaButtons: [
                                         { label: 'Kontaktieren Sie uns', url: '/contact', style: 'primary' },
                                         { text: 'About Us', url: '/about', style: 'secondary' },
                                     ],
                                 },
                                 { blockType: 'blog-list', variant: 'grid', headline: 'Aktuelle Beiträge', limit: 3 },
                             ],
                             seo: { title: 'Blog', description: 'Aktuelle Beiträge.' },
                         },
                         {
                             title: 'Über uns',
                             slug: '/about',
                             isHomepage: false,
                             blocks: [{
                                 blockType: 'about',
                                 variant: 'image-right',
                                 headline: 'Über GrünRaum',
                                 body: 'Nachhaltige Innenarchitektur aus Berlin.',
                             }],
                             seo: { title: 'Über uns', description: 'Über GrünRaum.' },
                         },
                         {
                             title: 'Kontakt',
                             slug: '/contact',
                             isHomepage: false,
                             blocks: [{
                                 blockType: 'contact',
                                 variant: 'split',
                                 headline: 'Kontakt',
                                 email: 'kontakt@gruenraum.test',
                             }],
                             seo: { title: 'Kontakt', description: 'Kontaktieren Sie uns.' },
                         },
                     ],
                 },
                 events: [],
             } as Awaited<ReturnType<typeof generateSiteWithAI>>)

             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'GrünRaum Innenarchitektur',
                         industry: 'Interior Design',
                         products: 'Nachhaltige Innenarchitektur',
                         shortDescription: 'Nachhaltige Innenarchitektur in Berlin.',
                     },
                     language: 'auto',
                     generationLocale: 'de',
                 }),
             })

             const res = await GenerateSitePOST(req)

             expect(res.status).toBe(200)
             const blogPage = (mockPageDB as PersistedPage[]).find((page) => page.slug === '/blog')
             const hero = blogPage?.layout?.find((block) => block.blockType === 'hero')
             expect(hero?.ctaButtons).toEqual([
                 expect.objectContaining({ label: 'Kontaktieren Sie uns' }),
                 expect.objectContaining({ label: 'Über uns' }),
             ])
        })

        it('[TC-F26-11-04] resolves a missing Auto override once for AI, products, and persistence', async () => {
             // Arrange
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({
                     businessInfo: {
                         businessName: 'Dolci Firenze',
                         industry: 'ristorante italiano',
                         products: 'ottimi dolci e birra',
                         shortDescription: 'cucina tradizionale italiana',
                     },
                     language: 'auto',
                 }),
             })

             // Act
             await GenerateSitePOST(req)

             // Assert
             const generatorCall = vi.mocked(generateSiteWithAI).mock.calls.at(-1)
             expect(generatorCall?.[6]).toEqual({
                 targetLocale: 'it',
                 modeDecision: {
                     requestedGenMode: 'template-first',
                     effectiveGenMode: 'template-first',
                 },
                 // #2103 A1: merchant FACTS ride along with every generation
                 facts: expect.objectContaining({ brand: expect.any(String) }),
             })
             expect(vi.mocked(generateSampleProducts).mock.calls.at(-1)?.[1]).toBe('it')
             const { prepareBlogPosts } = await import('@/lib/ai/seed-blog-posts')
             expect(vi.mocked(prepareBlogPosts).mock.calls.at(-1)?.[0]).toEqual(
                 expect.objectContaining({ locale: 'it' }),
             )

             const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
             const resolvedPayload = await mockPayload
             const siteCreateCall = vi.mocked(resolvedPayload.create).mock.calls.find(
                 (call: [{ collection: string; data?: { generationLocale?: string } }]) =>
                     call[0].collection === 'sites',
             )
             expect(siteCreateCall?.[0].data?.generationLocale).toBe('it')
        })

        // GH-1458 — generate-site creates products directly via payload.create(), bypassing the
        // publish-guard/alt-fallback logic in saveProductAction. These verify the parity fix.
        // Phase 2 correction: generateSampleProducts' AI tier estimates weight/dimensions PER
        // PRODUCT (mirrors products-bulk-parse) — the constants below are the fallback for when
        // the AI omits them, NOT the primary source. Both cases covered.
        it('[TC-09.41] sample product create falls back to weight:1/dimensions:0 when SampleProduct omits them (GH-1458)', async () => {
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: 'Sample Bread',
                    shortDescription: 'Fresh bread',
                    description: 'Delicious fresh bread',
                    price: 10,
                    sku: 'BREAD-001',
                    inventory: 0,
                    status: 'active',
                    // weight/length/width/height intentionally omitted — AI didn't estimate them
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                })
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const createCalls = vi.mocked(resolvedPayload.create).mock.calls
            const productCreateCall = createCalls.find(
                (c: [{ collection: string; data?: { weight?: number; dimensions?: unknown } }]) => c[0].collection === 'products'
            )
            expect(productCreateCall).toBeDefined()
            expect(productCreateCall![0].data.weight).toBe(1)
            expect(productCreateCall![0].data.dimensions).toEqual({ length: 0, width: 0, height: 0 })
        })

        it('[TC-09.44] sample product create falls back to weight:1 when AI hallucinates weight:0 (GH-1458)', async () => {
            // Regression guard: `product.weight || 1` (not `?? 1`) — publish-guard.ts treats weight:0
            // as invalid (never a real physical weight), and this route bypasses that guard entirely
            // by creating status:'active' directly, so this fallback is the only enforcement point.
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: 'Sample Bread',
                    shortDescription: 'Fresh bread',
                    description: 'Delicious fresh bread',
                    price: 10,
                    sku: 'BREAD-001',
                    inventory: 0,
                    status: 'active',
                    weight: 0,
                    length: 0,
                    width: 0,
                    height: 0,
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                })
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const createCalls = vi.mocked(resolvedPayload.create).mock.calls
            const productCreateCall = createCalls.find(
                (c: [{ collection: string; data?: { weight?: number; dimensions?: unknown } }]) => c[0].collection === 'products'
            )
            expect(productCreateCall).toBeDefined()
            expect(productCreateCall![0].data.weight).toBe(1)
        })

        it('[TC-09.43] sample product create passes through AI-estimated weight/dimensions unchanged (GH-1458)', async () => {
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: 'Sample Sofa',
                    shortDescription: 'Comfy sofa',
                    description: 'A big comfy sofa',
                    price: 1200,
                    sku: 'SOFA-001',
                    inventory: 0,
                    status: 'active',
                    weight: 45.5,
                    length: 200,
                    width: 90,
                    height: 85,
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Furniture Co', industry: 'Home', products: 'Sofa', shortDescription: 'Comfy furniture' }
                })
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const createCalls = vi.mocked(resolvedPayload.create).mock.calls
            const productCreateCall = createCalls.find(
                (c: [{ collection: string; data?: { weight?: number; dimensions?: unknown } }]) => c[0].collection === 'products'
            )
            expect(productCreateCall).toBeDefined()
            expect(productCreateCall![0].data.weight).toBe(45.5)
            expect(productCreateCall![0].data.dimensions).toEqual({ length: 200, width: 90, height: 85 })
        })

        it('[TC-09.42] sample product create persists alt-text fallback (GH-1458)', async () => {
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: 'Sample Bread',
                    shortDescription: 'Fresh bread',
                    description: 'Delicious fresh bread',
                    price: 10,
                    sku: 'BREAD-001',
                    inventory: 0,
                    imageId: 555,
                    status: 'active',
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                })
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const createCalls = vi.mocked(resolvedPayload.create).mock.calls
            const productCreateCall = createCalls.find(
                (c: [{ collection: string; data?: { images?: Array<{ alt?: string }> } }]) => c[0].collection === 'products'
            )
            expect(productCreateCall).toBeDefined()
            // Mocked generateSiteWithAI (top of file) returns result.siteName = 'AI Bakery'
            expect(productCreateCall![0].data.images?.[0]?.alt).toBe('Sample Bread')
        })

        it('[TC-F08.164] sample product create persists a valid slug for a CJK-only name', async () => {
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: '节能吊灯',
                    shortDescription: '节能照明产品',
                    description: '适合现代家居的节能吊灯。',
                    price: 799,
                    sku: 'ECO-001',
                    inventory: 0,
                    status: 'active',
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: '智能家居', industry: 'Home', products: '灯具', shortDescription: '现代家居产品' },
                    generationLocale: 'zh-CN',
                }),
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const productCreateCall = vi.mocked(resolvedPayload.create).mock.calls.find(
                (call: [{ collection: string; data?: { slug?: string } }]) => call[0].collection === 'products',
            )
            expect(productCreateCall?.[0].data?.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            expect(productCreateCall?.[0].data?.slug.length).toBeGreaterThanOrEqual(3)
        })

        it('[TC-09.49] persisted alt-text fallback is capped at 500 chars, matching saveProductAction (code-review fix)', async () => {
            const longName = 'B'.repeat(600)
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: [{
                    name: longName,
                    shortDescription: 'Fresh bread',
                    description: 'Delicious fresh bread',
                    price: 10,
                    sku: 'BREAD-001',
                    inventory: 0,
                    imageId: 555,
                    status: 'active',
                }],
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' }
                })
            })
            await GenerateSitePOST(req)

            const mockPayload = vi.mocked(getPayload).mock.results[0]?.value
            const resolvedPayload = await mockPayload
            const createCalls = vi.mocked(resolvedPayload.create).mock.calls
            const productCreateCall = createCalls.find(
                (c: [{ collection: string; data?: { images?: Array<{ alt?: string }> } }]) => c[0].collection === 'products'
            )
            expect(productCreateCall).toBeDefined()
            const alt = productCreateCall![0].data.images?.[0]?.alt
            expect(alt).toBeDefined()
            expect(alt!.length).toBeLessThanOrEqual(500)
        })
    })

    describe('POST /api/ai/rewrite-text', () => {
        beforeEach(() => stubPlatform())
        afterEach(() => {
            vi.unstubAllEnvs()
            vi.unstubAllGlobals()
        })

        it('returns 400 if text or instruction is missing', async () => {
            const req = new NextRequest('http://localhost:3000/api/ai/rewrite-text', {
                method: 'POST',
                body: JSON.stringify({ text: 'Hello' }) // Missing instruction
            })
            const res = await RewriteTextPOST(req)
            const body = await res.json()
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(body.error.details.fieldErrors).toHaveProperty('instruction')
        })

        it('returns 200 with rewritten text from the copy.rewrite-text task', async () => {
            platformFetchMock.mockResolvedValueOnce(platformTaskResponse('copy.rewrite-text', { rewritten: 'Greetings' }))
            const req = new NextRequest('http://localhost:3000/api/ai/rewrite-text', {
                method: 'POST',
                body: JSON.stringify({ text: 'Hello', instruction: 'Make it formal' })
            })
            const res = await RewriteTextPOST(req)
            expect(res.status).toBe(200)
            expect(await res.json()).toEqual({ rewritten: 'Greetings' })
            expect(platformFetchMock.mock.calls[0]![0]).toBe('http://ai.internal:8300/v1/tasks/copy.rewrite-text/run')
            expect(sentTaskInput()).toEqual({ text: 'Hello', instruction: 'Make it formal', language: 'en' })
        })
    })

    describe('POST /api/ai/apply-template', () => {

        it('returns 400 if templateId is missing', async () => {
            const req = new NextRequest('http://localhost:3000/api/ai/apply-template', {
                method: 'POST',
                body: JSON.stringify({})
            })
            const res = await ApplyTemplatePOST(req)
            const body = await res.json()
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(body.error.details.fieldErrors).toHaveProperty('templateId')
        })

        it('returns 200 and creates site based on template', async () => {
            // Need to mock Payload findByID to return a template
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-xyz' } }),
                findByID: vi.fn().mockResolvedValue({ id: 'tpl-1', name: 'Premium Template', category: ['portfolio'], defaultTheme: {} }),
                find: vi.fn().mockResolvedValue({ docs: [{ id: 'tenant-1' }] }),
                create: vi.fn().mockResolvedValue({ id: 'new-site-123', name: 'Premium Template' }),
                update: vi.fn().mockResolvedValue({})
            })

            const req = new NextRequest('http://localhost:3000/api/ai/apply-template', {
                method: 'POST',
                body: JSON.stringify({ templateId: 'tpl-1' })
            })
            const res = await ApplyTemplatePOST(req)
            
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.success).toBe(true)
            expect(result.templateName).toBe('Premium Template')
        })
    })

    describe('POST /api/ai/seo-generate (TC-F08-03-01)', () => {
        beforeEach(() => stubPlatform())
        afterEach(() => {
            vi.unstubAllEnvs()
            vi.unstubAllGlobals()
        })

        it('returns 429 when rate limit exceeded', async () => {
            mockRateLimitAllowed = false
            const req = new NextRequest('http://localhost:3000/api/ai/seo-generate', {
                method: 'POST',
                body: JSON.stringify({ name: 'Valid Product' })
            })
            const res = await SeoGeneratePOST(req)
            expect(res.status).toBe(429)
        })

        it('returns 400 when name is too short', async () => {
            mockRateLimitAllowed = true
            const req = new NextRequest('http://localhost:3000/api/ai/seo-generate', {
                method: 'POST',
                body: JSON.stringify({ name: 'A' })
            })
            const res = await SeoGeneratePOST(req)
            expect(res.status).toBe(400)
        })

        it('returns 200 with JSON format when parameters are valid', async () => {
            mockRateLimitAllowed = true
            platformFetchMock.mockResolvedValueOnce(platformTaskResponse('seo.page-meta', { title: 'Generated Title', description: 'Generated Description', slug: 'generated-slug' }))

            const req = new NextRequest('http://localhost:3000/api/ai/seo-generate', {
                method: 'POST',
                body: JSON.stringify({ name: 'Trà Đào Cam Sả' })
            })
            const res = await SeoGeneratePOST(req)
            const json = await res.json()
            expect(res.status).toBe(200)
            expect(json.success).toBe(true)
            expect(json.data.slug).toBe('generated-slug')
        })
    })


    // ── gen-perf Wave 1 (plan 260703-1341, docs/qa/F01-gen-perf.md) ─────────
    // Proves blog + imglib seeding are scheduled via next/server after() and
    // never run inside the request. Mutation check: reverting route.ts to the
    // old inline fire-and-forget makes W1-01 fail (seeder called in-request).
    describe('TC-GENPERF-W1 — seeding deferred via after()', () => {
        const genPerfReq = () =>
            new NextRequest('http://localhost:3000/api/ai/generate-site', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                }),
            })
        // Invoke every captured after() callback WITHOUT catching — every task
        // the route schedules is contractually never-throw (.catch inside), so
        // any rejection here is a real defect.
        const runCapturedAfterTasks = async () => {
            const { after } = await import('next/server')
            for (const call of vi.mocked(after).mock.calls) {
                await (call[0] as () => unknown)()
            }
        }
        // Drain the event loop so any stray fire-and-forget chain (the mutant
        // this suite guards against — dynamic import().then(seed)) gets a
        // chance to run BEFORE the not-called assertions. Without this, an
        // inline-fired seeder wouldn't have resolved yet and the deferral
        // assertions would pass vacuously (verified by mutation test).
        const drainEventLoop = async () => {
            for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r))
        }

        it('[TC-GENPERF-W1-01] imglib seeding scheduled via after(), not run in-request', async () => {
            // Arrange
            const { seedImageLibraryForSite } = await import('@/lib/images/image-library-seeder')
            const { after } = await import('next/server')

            // Act — full route call
            const res = await GenerateSitePOST(genPerfReq())

            // Assert — response OK, seeder NOT called during the request
            // (drain first: an inline-fired mutant only resolves after ticks)
            expect(res.status).toBe(200)
            await drainEventLoop()
            expect(vi.mocked(seedImageLibraryForSite)).not.toHaveBeenCalled()
            expect(vi.mocked(after)).toHaveBeenCalled()

            // Post-response: captured after() tasks run the seeder exactly once
            await runCapturedAfterTasks()
            expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledWith(
                expect.anything(),
                'tenant-1',
                expect.any(String),
                'ecommerce',
                undefined,
                'Bread',
            )
        })

        it('[TC-GENPERF-W1-02] fallback blog seeding is deferred until after the response', async () => {
            // Arrange
            const { prepareBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(prepareBlogPosts).mockResolvedValueOnce(null)

            // Act
            const res = await GenerateSitePOST(genPerfReq())

             // Assert
             expect(res.status).toBe(200)
             expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
             await runCapturedAfterTasks()
             expect(vi.mocked(seedBlogPosts)).toHaveBeenCalledTimes(1)
        })

        it('[TC-GENPERF-W1-05] optional image-library seeder rejection is non-fatal', async () => {
            // Arrange
            const { seedImageLibraryForSite } = await import('@/lib/images/image-library-seeder')
            vi.mocked(seedImageLibraryForSite).mockRejectedValueOnce(new Error('imglib boom'))
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert — optional post-response work cannot invalidate completion.
            expect(res.status).toBe(200)
            await expect(runCapturedAfterTasks()).resolves.toBeUndefined()
            expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledTimes(1)
            errorSpy.mockRestore()
        })

        it('[TC-GENPERF-W1-06] SSE done payload keeps the original terminal contract', async () => {
            // Arrange
            const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                }),
            })

            // Act — read the REAL stream to the end and extract the done event
            const res = await GenerateSitePOST(req)
            const reader = res.body!.getReader()
            let full = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                full += new TextDecoder().decode(value)
            }

            // Assert — done event exists with the exact client-contract keys
            const m = full.match(/event: done\ndata: (\{[^\n]*\})/)
            expect(m).toBeTruthy()
            expect(Object.keys(JSON.parse(m![1]!)).sort()).toEqual(
                [
                    'pageId',
                    'pixabayImageStatus',
                    'pixabayUsedImages',
                    'placeholders',
                    'productIds',
                    'siteId',
                    'siteLanguage',
                    'siteName',
                    'timeMs',
                    'totalBlocks',
                    'totalPages',
                ],
            )
        })

        it('[TC-AIAUD-033] generated pages and the 404 page are created as drafts until the merchant publishes (#2103 A4)', async () => {
            const res = await GenerateSitePOST(genPerfReq())

            expect(res.status).toBe(200)
            expect(mockPageDB.length).toBeGreaterThan(1)
            expect(mockPageDB.map((page) => page._status)).toEqual(mockPageDB.map(() => 'draft'))
        })

        it('[TC-AIAUD-032] the done event carries productIds of the created products and the placeholders list (#2103 A3/A1)', async () => {
            const listed = Array.from({ length: 4 }, (_, index) => ({
                name: `Listed Product ${index + 1}`,
                shortDescription: 'Listed',
                description: 'Listed product.',
                price: 10 + index,
                sku: `LISTED-${index + 1}`,
                inventory: 0,
                status: 'active',
            }))
            vi.mocked(generateSampleProducts).mockResolvedValueOnce({
                products: listed,
                stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 },
            } as Awaited<ReturnType<typeof generateSampleProducts>>)
            const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Listed Product 1, Listed Product 2, Listed Product 3, Listed Product 4', shortDescription: 'Fresh artisan bakery' },
                }),
            })

            const res = await GenerateSitePOST(req)
            const reader = res.body!.getReader()
            let full = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                full += new TextDecoder().decode(value)
            }
            const done = JSON.parse(full.match(/event: done\ndata: (\{[^\n]*\})/)![1]!)

            // exactly the 4 listed products were created, and their ids are reported
            expect(mockProductDB).toHaveLength(4)
            expect(done.productIds).toEqual(mockProductDB.map((product) => String(product.id)))
            expect(done.productIds.every((id: string) => typeof id === 'string')).toBe(true)
            // every product stays active with stock 0 (storefront shows it as sold out)
            expect(mockProductDB.every((product) => product.status === 'active' && product.inventory === 0)).toBe(true)
            expect(Array.isArray(done.placeholders)).toBe(true)
            for (const placeholder of done.placeholders) {
                expect(Object.keys(placeholder).sort()).toEqual(['blockType', 'label', 'pageSlug'])
            }
        })

        it('[TC-AIAUD-208] placeholders are collected from the saved pages: a block dropped for an empty required list is not reported (#2103 L1)', async () => {
            vi.mocked(generateSiteWithAI).mockResolvedValueOnce({
                result: {
                    siteName: 'AI Bakery',
                    siteType: 'ecommerce',
                    theme: { primaryColor: '#000' },
                    seo: { title: 'SEO Bakery', description: 'Desc Bakery' },
                    language: 'en',
                    blocks: [],
                    pages: [{
                        title: 'Home', slug: '/', isHomepage: true,
                        blocks: [
                            { blockType: 'hero', variant: 'centered', headline: 'Fresh every morning' },
                            { blockType: 'stats', stats: [] },
                            { blockType: 'testimonials', testimonials: [] },
                        ],
                    }],
                },
                events: [],
            } as unknown as Awaited<ReturnType<typeof generateSiteWithAI>>)
            const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                method: 'POST',
                body: JSON.stringify({
                    businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread', shortDescription: 'Fresh artisan bakery' },
                }),
            })

            const res = await GenerateSitePOST(req)
            const reader = res.body!.getReader()
            let full = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                full += new TextDecoder().decode(value)
            }
            const done = JSON.parse(full.match(/event: done\ndata: (\{[^\n]*\})/)![1]!)

            const home = mockPageDB.find((page) => page.slug === '/')
            const savedTypes = (home?.layout as Array<{ blockType: string }>).map((block) => block.blockType)
            expect(savedTypes).not.toContain('stats')
            expect(savedTypes).toContain('testimonials')
            const reported = (done.placeholders as Array<{ pageSlug: string; blockType: string }>).filter((p) => p.pageSlug === '/').map((p) => p.blockType)
            expect(reported).not.toContain('stats')
            expect(reported).toContain('testimonials')
        })

        it('[TC-GENPERF-W1-07] after() unavailable → fallback executes seeding anyway', async () => {
            // Arrange — simulate no-request-scope (after throws, e.g. Vitest/local)
            const { after } = await import('next/server')
            const { seedImageLibraryForSite } = await import('@/lib/images/image-library-seeder')
            vi.mocked(after).mockImplementation(() => { throw new Error('after called outside request scope') })

            try {
                // Act
                const res = await GenerateSitePOST(genPerfReq())

                // Assert — route falls back to `void task()` for optional work.
                expect(res.status).toBe(200)
                await vi.waitFor(() => {
                    expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledTimes(1)
                })
            } finally {
                vi.mocked(after).mockImplementation(() => undefined)
            }
        })

        it('[TC-GENPERF-BI-01] prepared blog posts persist inline BEFORE done; legacy seeding unused', async () => {
            // Arrange — prep finished during the GPT window
            const { prepareBlogPosts, persistBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(prepareBlogPosts).mockResolvedValueOnce([
                { title: 'A', slug: 'a', content: '<p>a</p>', thumbnailId: 1 },
                { title: 'B', slug: 'b', content: '<p>b</p>', thumbnailId: 2 },
                { title: 'C', slug: 'c', content: '<p>c</p>', thumbnailId: 3 },
            ])

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert — persisted IN-REQUEST (before any after() task runs)
            expect(res.status).toBe(200)
            expect(vi.mocked(persistBlogPosts)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(persistBlogPosts).mock.calls[0]![1]).toHaveLength(3)
            await runCapturedAfterTasks()
            expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
        })

        it('[TC-GENPERF-BI-02] regeneration persists 3 prepared posts so defaults are replaced', async () => {
            // Arrange — prepareBlogPosts no longer skips when a default post exists.
            const { prepareBlogPosts, persistBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(prepareBlogPosts).mockResolvedValueOnce([
                { title: 'A2', slug: 'a2', content: '<p>a2</p>', thumbnailId: 1 },
                { title: 'B2', slug: 'b2', content: '<p>b2</p>', thumbnailId: 2 },
                { title: 'C2', slug: 'c2', content: '<p>c2</p>', thumbnailId: 3 },
            ])

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert
            expect(res.status).toBe(200)
            expect(vi.mocked(persistBlogPosts)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(persistBlogPosts).mock.calls[0]![1]).toHaveLength(3)
            await runCapturedAfterTasks()
            expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
        })

        it('[TC-GENPERF-BI-03] done waits until pending blog preparation is persisted', async () => {
            // Arrange
            const { prepareBlogPosts, persistBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            let resolvePrep: (v: Array<{ title: string; slug: string; content: string }>) => void = () => {}
            vi.mocked(prepareBlogPosts).mockReturnValueOnce(new Promise((r) => { resolvePrep = r }))

            // Act — response must remain pending until blog prep settles.
            let responseSettled = false
            const responsePromise = GenerateSitePOST(genPerfReq()).then((response) => {
                responseSettled = true
                return response
            })
            await drainEventLoop()
            expect(responseSettled).toBe(false)
            expect(vi.mocked(persistBlogPosts)).not.toHaveBeenCalled()

            resolvePrep([
                { title: 'A', slug: 'a', content: '<p>a</p>', thumbnailId: 1 },
                { title: 'B', slug: 'b', content: '<p>b</p>', thumbnailId: 2 },
                { title: 'C', slug: 'c', content: '<p>c</p>', thumbnailId: 3 },
            ])
            const res = await responsePromise
            expect(res.status).toBe(200)
            expect(vi.mocked(persistBlogPosts)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
        })
    })

    describe('canonicalizePageSlug — trust canonical slug over title/content [GH-820 + dental /contact fix]', () => {
        it('[TC-GENSLUG-01] keeps /contact even when the page title says "About" (would previously flip to /about)', () => {
            // Nano filled the contact slot with About-ish content, but gen-page-split
            // already validated + rewrote the slug to /contact. Title-first derivation
            // used to override it back to /about → duplicate slug → /contact dropped.
            const page = { title: 'Giới Thiệu Về Chúng Tôi (About)', slug: '/contact', blocks: [{ blockType: 'about' }] }
            expect(canonicalizePageSlug(page, 3)).toBe('/contact')
        })

        it('[TC-GENSLUG-02] trusts each canonical sub-page slug verbatim', () => {
            expect(canonicalizePageSlug({ title: 'x', slug: '/about', blocks: [] }, 1)).toBe('/about')
            expect(canonicalizePageSlug({ title: 'x', slug: '/services', blocks: [] }, 2)).toBe('/services')
            expect(canonicalizePageSlug({ title: 'x', slug: '/blog', blocks: [] }, 4)).toBe('/blog')
        })

        it('[TC-GENSLUG-03] still normalizes an ARBITRARY invented slug via title (GH-820 preserved)', () => {
            // slug "free-trial" is NOT canonical → title-based derivation runs → /contact
            expect(canonicalizePageSlug({ title: 'Contact Us', slug: '/free-trial', blocks: [] }, 3)).toBe('/contact')
        })

        it('[TC-GENSLUG-04] homepage always "/" regardless of slug', () => {
            expect(canonicalizePageSlug({ title: 'Home', slug: '/about', isHomepage: true, blocks: [] }, 0)).toBe('/')
        })
    })

    describe('buildGeneratedPages — fallback hero image allocation', () => {
        it('[TC-GENSLUG-05] keeps one homepage and drops duplicate canonical slugs from AI output', () => {
            const pages = buildGeneratedPages({
                blocks: [],
                businessInfo: {
                    businessName: 'Acme',
                    shortDescription: 'Consulting services',
                    products: 'Advisory',
                },
                result: {
                    pages: [
                        { title: 'Home', slug: '/', isHomepage: true, blocks: [] },
                        { title: 'About Us', slug: '/our-story', isHomepage: true, blocks: [] },
                        { title: 'About', slug: '/about', blocks: [] },
                        { title: 'Contact', slug: '/contact', blocks: [] },
                    ],
                },
            })

            expect(pages.map(page => ({ slug: page.slug, isHomepage: page.isHomepage }))).toEqual([
                { slug: '/', isHomepage: true },
                { slug: '/about', isHomepage: false },
                { slug: '/contact', isHomepage: false },
            ])
        })

        it('[TC-GENPERF-W3-17] gives cloned subpage heroes their reserved Media IDs', () => {
            const pages = buildGeneratedPages({
                blocks: [{
                    blockType: 'hero',
                    variant: 'centered',
                    headline: 'Home',
                    image: 100,
                    backgroundImage: 100,
                }],
                businessInfo: {
                    businessName: 'Butter & Bloom',
                    shortDescription: 'Neighborhood artisan bakery',
                    products: 'Bread and pastries',
                },
                result: {
                    seo: { title: 'Butter & Bloom', description: 'Fresh bakes' },
                },
                fallbackHeroMediaIds: [101, 102, 103, 104],
            })

            const heroMediaIds = pages.map(page => {
                const hero = page.layout.find(block => block.blockType === 'hero')
                return [hero?.image, hero?.backgroundImage]
            })
            expect(heroMediaIds).toEqual([
                [100, 100],
                [101, 101],
                [102, 102],
                [103, 103],
            ])
        })
    })
})
