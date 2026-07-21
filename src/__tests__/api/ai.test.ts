import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { POST as GenerateSitePOST, canonicalizePageSlug } from '@/app/api/ai/generate-site/route'
import { POST as EditBlockPOST } from '@/app/api/ai/edit-block/route'
import { POST as RewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as ApplyTemplatePOST } from '@/app/api/ai/apply-template/route'
import { POST as SeoGeneratePOST } from '@/app/api/ai/seo-generate/route'
import { POST as BulkParsePOST } from '@/app/api/ai/products-bulk-parse/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { generateSampleProducts } from '@/lib/ai/generate-sample-products'
import { checkRateLimit } from '@/lib/rateLimit'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }),
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

vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            auth: vi.fn().mockResolvedValue({
                user: { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
            }),
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'tenants' && id === mockTenant.id) return mockTenant
                if (collection === 'media') return { id, url: 'https://example.com/media.jpg' }
                return null
            }),
            find: vi.fn().mockImplementation(async ({ collection }) => {
                if (collection === 'sites') return { docs: mockSiteDB }
                if (collection === 'pages') return { docs: mockPageDB }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({ collection, data }) => {
                const doc = { id: `new-${collection}-123`, ...data }
                if (collection === 'sites') mockSiteDB.push(doc)
                if (collection === 'pages') mockPageDB.push(doc)
                return doc
            }),
            update: vi.fn().mockImplementation(async ({ collection, id, data }) => {
                const idx = mockSiteDB.findIndex(s => s.id === id)
                if (idx > -1) mockSiteDB[idx] = { ...mockSiteDB[idx], ...data }
                return mockSiteDB[idx]
            }),
            delete: vi.fn().mockResolvedValue({})
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
vi.mock('@/lib/ai/generate-sample-products', () => ({
    generateSampleProducts: vi.fn().mockResolvedValue({ products: [], stats: { rateLimited: 0, uploadFailed: 0, noImage: 0 } }),
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
    seedBlogPosts: vi.fn().mockResolvedValue(0),
    // Default: prep "failed" (null) → route takes the legacy after() seeding
    // path, which keeps the W1 blog tests meaningful. Inline-path tests
    // (TC-GENPERF-BI-*) override per-case.
    prepareBlogPosts: vi.fn().mockResolvedValue(null),
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
        }
    }),
}))

// Top-level openai mock — vi.mock() must never be inside it() per testing.md
vi.mock('openai', () => {
    const OpenAI = vi.fn()
    OpenAI.prototype.chat = {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: JSON.stringify({ action: 'update_theme', changes: { colorMode: 'dark' } }) } }]
            })
        }
    }
    return { default: OpenAI }
})


describe('AI Streaming APIs', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockSiteDB = []
        mockPageDB = []
        mockTenant = { id: 'tenant-1', plan: 'pro', aiGenerationsCount: 0 }
        mockRateLimitAllowed = true
    })

    describe('POST /api/ai/generate-site', () => {
        
        it('returns 400 if businessInfo is missing required fields', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site', {
                 method: 'POST',
                 body: JSON.stringify({ extraInstructions: 'Make it pop' }) // Missing businessInfo
             })
             const res = await GenerateSitePOST(req)
             const body = await res.json()
             expect(body.error.code).toBe('VALIDATION_ERROR')
             expect(body.error.details.fieldErrors).toHaveProperty('businessInfo')
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
             expect(result.success).toBe(true)
             expect(result.siteName).toBe('AI Bakery')
             expect(mockSiteDB.length).toBe(1) // A site was created
             expect(mockPageDB.length).toBe(5) // Homepage, About, Products, Contact + 404
             expect(result.totalPages).toBe(4) // totalPages excludes system 404 page
             expect(mockPageDB.map((page) => page.slug)).toEqual(['/', '/about', '/products', '/contact', '404'])
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

        it('returns text/event-stream response for SSE mode when stream=true', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                 method: 'POST',
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
             
             // Read the first chunk of stream (which should be "theme_generated" event we mocked)
             const { value } = await reader!.read()
             const text = new TextDecoder().decode(value)
             expect(text).toContain('event: theme_generated')
             
             // Wait for stream to finish reading to prevent controller close error
             while (true) {
                 const { done } = await reader!.read()
                 if (done) break
             }
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
             expect(generatorCall?.[6]).toEqual({ targetLocale: 'it' })
             expect(vi.mocked(generateSampleProducts).mock.calls.at(-1)?.[1]).toBe('it')

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

    describe('POST /api/ai/edit-block', () => {

        it('returns 400 if instruction is missing', async () => {
            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({ blockIndex: 0 }) // Missing instruction
            })
            const res = await EditBlockPOST(req)
            const body = await res.json()
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(body.error.details.fieldErrors).toHaveProperty('instruction')
        })

        it('returns 200 with AI generated JSON action', async () => {
            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({ instruction: 'Make to dark mode', blockIndex: 0 })
            })
            const res = await EditBlockPOST(req)
            expect(res.status).toBe(200)
        })

        it('returns update_multiple_blocks for page-wide instruction (TC-F01-MULTI-01)', async () => {
            process.env.OPENAI_API_KEY = 'test-key'

            // Override the prototype mock so new OpenAI() instances return multi-block response
            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                    action: 'update_multiple_blocks',
                    updates: [
                        { blockIndex: 0, changes: { headline: 'Xin chào' } },
                        { blockIndex: 1, changes: { title: 'Về chúng tôi' } },
                    ],
                    message: 'Translated all sections to Vietnamese.',
                }) } }],
                model: 'gpt-4o-mini',
                usage: { prompt_tokens: 100, completion_tokens: 200 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({
                    instruction: 'dịch toàn bộ trang sang tiếng Việt',
                    allBlocks: [
                        { blockType: 'hero', headline: 'Hello' },
                        { blockType: 'about', title: 'About Us' },
                    ],
                })
            })

            const res = await EditBlockPOST(req)
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.action).toBe('update_multiple_blocks')
            expect(data.updates).toHaveLength(2)
            expect(data.updates[0].blockIndex).toBe(0)
            expect(data.updates[1].changes.title).toBe('Về chúng tôi')
        })

        it('filters out-of-bounds blockIndex from AI response (TC-F01-MULTI-02)', async () => {
            process.env.OPENAI_API_KEY = 'test-key'

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            // AI hallucinates blockIndex=99 on a 2-block page — backend must drop it.
            // Float indices (0.5, 1.7) also pass `typeof === 'number'` but are not valid
            // array positions — Number.isInteger guard must reject them too.
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                    action: 'update_multiple_blocks',
                    updates: [
                        { blockIndex: 0, changes: { headline: 'Xin chào' } },
                        { blockIndex: 99, changes: { headline: 'ghost section' } },
                        { blockIndex: -1, changes: { headline: 'underflow' } },
                        { blockIndex: 0.5, changes: { headline: 'float low' } },
                        { blockIndex: 1.7, changes: { headline: 'float mid' } },
                    ],
                    message: 'Translated all sections.',
                }) } }],
                model: 'gpt-4o-mini',
                usage: { prompt_tokens: 100, completion_tokens: 200 },
            })

            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({
                    instruction: 'translate the whole page',
                    allBlocks: [
                        { blockType: 'hero', headline: 'Hello' },
                        { blockType: 'about', title: 'About Us' },
                    ],
                })
            })

            const res = await EditBlockPOST(req)
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.action).toBe('update_multiple_blocks')
            expect(data.updates).toHaveLength(1)
            expect(data.updates[0].blockIndex).toBe(0)
        })

        it('wraps SELECTED BLOCK FULL DATA as bounded valid JSON (TC-F01-NESTED-FULLDATA)', async () => {
            process.env.OPENAI_API_KEY = 'test-key'

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            const createMock = OpenAI.prototype.chat.completions.create
            createMock.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({
                    action: 'update_block',
                    blockIndex: 0,
                    changes: { description: 'shorter' },
                    message: 'Trimmed description.',
                }) } }],
                model: 'gpt-4o-mini',
                usage: { prompt_tokens: 100, completion_tokens: 200 },
            })

            const bigBlock = {
                blockType: 'hero',
                description: 'X'.repeat(5000),
                items: Array.from({ length: 20 }, (_, i) => ({ label: `item-${i}` })),
            }

            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({
                    instruction: 'make description shorter',
                    block: bigBlock,
                    blockIndex: 0,
                    allBlocks: [bigBlock],
                })
            })

            const res = await EditBlockPOST(req)
            expect(res.status).toBe(200)

            // Find the call whose system prompt actually contains the SELECTED BLOCK FULL DATA
            // section — other earlier tests share the prototype mock, so mock.calls is cumulative.
            const calls = createMock.mock.calls as Array<[{ messages: Array<{ role: string; content: string }> }]>
            const targetCall = [...calls].reverse().find(c => {
                const sys = c[0]?.messages?.find((m) => m.role === 'system')?.content ?? ''
                return sys.includes('## SELECTED BLOCK FULL DATA')
            })
            expect(targetCall).toBeDefined()
            const systemPrompt = targetCall![0].messages.find((m) => m.role === 'system')!.content

            expect(systemPrompt).toContain('## SELECTED BLOCK FULL DATA')
            const match = systemPrompt.match(/## SELECTED BLOCK FULL DATA\n```json\n([\s\S]*?)\n```/)
            expect(match).not.toBeNull()
            const parsed = JSON.parse(match![1]) as Record<string, unknown>
            expect(parsed.blockType).toBe('hero')
            // description string capped to ≤301 chars (300 + ellipsis)
            expect((parsed.description as string).length).toBeLessThanOrEqual(301)
            // items array capped to 10 entries + 1 overflow marker = 11 max
            expect(Array.isArray(parsed.items)).toBe(true)
            expect((parsed.items as unknown[]).length).toBeLessThanOrEqual(11)
        })
    })

    describe('POST /api/ai/rewrite-text', () => {

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

        it('returns 200 with rewritten text', async () => {
            const req = new NextRequest('http://localhost:3000/api/ai/rewrite-text', {
                method: 'POST',
                body: JSON.stringify({ text: 'Hello', instruction: 'Make it formal' })
            })
            const res = await RewriteTextPOST(req)
            expect(res.status).toBe(200)
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
            vi.mocked(process).env.OPENAI_API_KEY = 'test-key'

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify({ title: 'Generated Title', description: 'Generated Description', slug: 'generated-slug' }) } }]
            })

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

    describe('POST /api/ai/products-bulk-parse (TC-F08-04-01 & TC-F08.18)', () => {
        it('returns 429 with rateLimitExceeded code + resetAt when rate limit is hit (Stress Protection)', async () => {
            mockRateLimitAllowed = false
            const req = new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST',
                body: JSON.stringify({ promptText: 'Áo thun 50k' })
            })
            const res = await BulkParsePOST(req)
            const json = await res.json()
            expect(res.status).toBe(429)
            expect(json.error).toBe('rateLimitExceeded')
            expect(typeof json.resetAt).toBe('number')
            expect(vi.mocked(checkRateLimit)).toHaveBeenCalledWith('ai-bulk-parse:user-xyz', 10)
        })

        it('TC-F08-04-81: rejects an invalid bulk-parse request before invoking OpenAI', async () => {
            mockRateLimitAllowed = true
            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } }

            const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST',
                body: JSON.stringify({ promptText: { text: 'not a string' }, locale: 'vi' }),
            }))

            expect(res.status).toBe(400)
            await expect(res.json()).resolves.toEqual({ error: 'invalidRequest' })
            expect(OpenAI.prototype.chat.completions.create).not.toHaveBeenCalled()
        })

        it('returns parseError for a malformed AI product row', async () => {
            mockRateLimitAllowed = true
            process.env.OPENAI_API_KEY = 'test-key'
            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } }
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                model: 'gpt-test', usage: {}, choices: [{ message: { content: JSON.stringify({ products: [{ name: 'Hat', sku: {} }] }) } }],
            })

            const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST', body: JSON.stringify({ promptText: 'hat', locale: 'en' }),
            }))

            expect(res.status).toBe(500)
            await expect(res.json()).resolves.toEqual({ error: 'parseError' })
            expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce()
        })

        it('returns fallback data when OPENAI_API_KEY is completely missing', async () => {
            mockRateLimitAllowed = true
            const prev = process.env.OPENAI_API_KEY
            delete process.env.OPENAI_API_KEY
            
            const req = new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST',
                body: JSON.stringify({ promptText: 'Áo thun 50k', locale: 'en' })
            })
            const res = await BulkParsePOST(req)
            const json = await res.json()
            expect(res.status).toBe(200)
            expect(json.products[0].name).toContain('No API Key')
            expect(json.products[0].variants[0].name).toBe('Black - M')
            
            process.env.OPENAI_API_KEY = prev
        })
    it('TC-F08-04-78: returns Malay fallback data when the selected locale is ms and no API key exists', async () => {
      // Arrange
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      // Act
      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({ promptText: 'baju', locale: 'ms' }),
      }));
      const json = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(json.products[0].name).toContain('Tiada Kunci API');
      expect(json.products[0].variants[0].name).toBe('Hitam - M');
      process.env.OPENAI_API_KEY = previousKey;
    });

    it("TC-F08-04-65: includes variant names and option values in the English translation contract sent to OpenAI", async () => {
      mockRateLimitAllowed = true;
      const prev = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";

      const OpenAIMod = await import("openai");
      // The module mock replaces OpenAI's constructor with vi.fn; its production type cannot
      // expose Vitest's mock helpers, so narrow only the mocked completion boundary.
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: "gpt-test",
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ message: { content: JSON.stringify({ products: [] }) } }],
      });

      const req = new NextRequest(
        "http://localhost:3000/api/ai/products-bulk-parse",
        {
          method: "POST",
          body: JSON.stringify({ promptText: "áo thun màu đỏ", locale: "en" }),
        },
      );
      const res = await BulkParsePOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.products).toEqual([]);
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      const call = OpenAI.prototype.chat.completions.create.mock.calls[0][0];
      const systemPrompt = call.messages[0].content as string;
      expect(systemPrompt).toContain(
        "variants[].name, variantConfigs[].name, and variantConfigs[].options[].value",
      );
      expect(systemPrompt).toContain(
        'the variant name MUST be "Red", NOT "Đỏ"',
      );
      expect(systemPrompt).toContain(
        'An array of objects with a "value" string in ENGLISH',
      );
      expect(systemPrompt).not.toContain('use "Áo Thun" instead of "Áo"');

      process.env.OPENAI_API_KEY = prev;
    });

    it("TC-F08-04-66: includes Malay-specific variant and dimension examples in the translation contract sent to OpenAI", async () => {
      mockRateLimitAllowed = true;
      const prev = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";

      const OpenAIMod = await import("openai");
      // The module mock replaces OpenAI's constructor with vi.fn; its production type cannot
      // expose Vitest's mock helpers, so narrow only the mocked completion boundary.
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: "gpt-test",
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ message: { content: JSON.stringify({ products: [] }) } }],
      });

      const req = new NextRequest(
        "http://localhost:3000/api/ai/products-bulk-parse",
        {
          method: "POST",
          body: JSON.stringify({ promptText: "áo thun màu đỏ", locale: "ms" }),
        },
      );
      const res = await BulkParsePOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.products).toEqual([]);
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      const call = OpenAI.prototype.chat.completions.create.mock.calls[0][0];
      const systemPrompt = call.messages[0].content as string;
      expect(systemPrompt).toContain(
        'the variant name MUST be "Merah" and the dimension name MUST be "Warna"',
      );
      expect(systemPrompt).toContain("for Bahasa Melayu");
      expect(systemPrompt).toContain(
        "you MUST output exactly 1 variant in BAHASA MELAYU",
      );

      process.env.OPENAI_API_KEY = prev;
    });

    it("TC-F08-04-72: uses one prompt call for an English-localized draft", async () => {
      mockRateLimitAllowed = true;
      const prev = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";

      const OpenAIMod = await import("openai");
      // The module mock replaces OpenAI's constructor with vi.fn; its production type cannot
      // expose Vitest's mock helpers, so narrow only the mocked completion boundary.
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValue({
        model: "gpt-test",
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                products: [
                  {
                    name: "T-Shirt",
                    slug: "t-shirt",
                    price: 5,
                    category: "Fashion",
                    sku: "TS-001",
                    variants: [
                      { name: "White", price: 5, sku: "TS-W", stock: 0 },
                      { name: "Red", price: 5, sku: "TS-R", stock: 0 },
                    ],
                    variantConfigs: [
                      {
                        name: "Color",
                        options: [{ value: "White" }, { value: "Red" }],
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      });

      const req = new NextRequest(
        "http://localhost:3000/api/ai/products-bulk-parse",
        {
          method: "POST",
          body: JSON.stringify({
            promptText: "áo thun màu trắng, đỏ giá 5rm",
            locale: "en",
          }),
        },
      );
      const res = await BulkParsePOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      expect(json.products[0].name).toBe("T-Shirt");
      expect(
        json.products[0].variants.map(
          (variant: { name: string }) => variant.name,
        ),
      ).toEqual(["White", "Red"]);

      process.env.OPENAI_API_KEY = prev;
    });

    it('TC-F08-04-73: uses one prompt call for a Malay-localized draft', async () => {
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Seluar Lelaki',
            price: 100,
            variants: [{ name: 'Putih - M', price: 100, stock: 0 }],
            variantConfigs: [
              { name: 'Warna', options: [{ value: 'Putih' }] },
              { name: 'Saiz', options: [{ value: 'M' }] },
            ],
          }],
        }) } }],
      });

      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({
          promptText: 'quần tây nam màu trắng size m giá 100',
          locale: 'ms',
        }),
      }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      expect(json.products[0].name).toBe('Seluar Lelaki');
      expect(json.products[0].variants[0].name).toBe('Putih - M');
      expect(json.products[0].variantConfigs[0]).toEqual({
        name: 'Warna',
        options: [{ value: 'Putih' }],
      });
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-84: rejects Vietnamese merchant text for an English store without a repair call', async () => {
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Ao Thun',
            price: 5,
            variants: [
              { name: 'Trang', price: 5, stock: 0 },
              { name: 'Do', price: 5, stock: 0 },
              { name: 'Xam', price: 5, stock: 0 },
            ],
            variantConfigs: [{
              name: 'Mau sac',
              options: [{ value: 'Trang' }, { value: 'Do' }, { value: 'Xam' }],
            }],
          }],
        }) } }],
      });

      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({
          promptText: 'áo thun màu trắng, đỏ, xám giá 5rm',
          locale: 'en',
        }),
      }));

      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({
        error: 'merchantLanguageMismatch',
        retryable: true,
      });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-85: rejects English merchant text for a Malay store without a repair call', async () => {
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Wool Coat',
            description: 'A warm wool coat for men. Soft material for everyday wear.',
            price: 100,
            variants: [{ name: 'Red - Medium', price: 100, stock: 0 }],
            variantConfigs: [
              { name: 'Color', options: [{ value: 'Red' }] },
              { name: 'Size', options: [{ value: 'Medium' }] },
            ],
          }],
        }) } }],
      });

      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({ promptText: 'kot bulu merah saiz sederhana', locale: 'ms' }),
      }));

      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({
        error: 'merchantLanguageMismatch',
        retryable: true,
      });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-87: rejects one Malay variant value for an English store', async () => {
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test',
        usage: {},
        choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Hat',
            variants: [{ name: 'Merah', price: 10, stock: 0 }],
          }],
        }) } }],
      });

      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({ promptText: 'topi merah', locale: 'en' }),
      }));

      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({
        error: 'merchantLanguageMismatch',
        retryable: true,
      });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-88: rejects one English variant value for a Malay store', async () => {
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test',
        usage: {},
        choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Topi',
            variants: [{ name: 'Red', price: 10, stock: 0 }],
          }],
        }) } }],
      });

      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST',
        body: JSON.stringify({ promptText: 'topi merah', locale: 'ms' }),
      }));

      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({
        error: 'merchantLanguageMismatch',
        retryable: true,
      });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-89: rejects a Vietnamese product name even when Malay variants outvote it globally', async () => {
      // Arrange
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test', usage: {}, choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Quan Tay Lelaki',
            variants: [{ name: 'Putih - M', price: 100, stock: 0 }],
            variantConfigs: [
              { name: 'Warna', options: [{ value: 'Putih' }] },
              { name: 'Saiz', options: [{ value: 'M' }] },
            ],
          }],
        }) } }],
      });

      // Act
      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST', body: JSON.stringify({ promptText: 'quần tây nam màu trắng size m', locale: 'ms' }),
      }));

      // Assert
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: 'merchantLanguageMismatch', retryable: true });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-90: rejects a Vietnamese product name even when English variants outvote it globally', async () => {
      // Arrange
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test', usage: {}, choices: [{ message: { content: JSON.stringify({
          products: [{
            name: 'Ao Thun',
            variants: [
              { name: 'White', price: 5, stock: 0 },
              { name: 'Red', price: 5, stock: 0 },
              { name: 'Grey', price: 5, stock: 0 },
            ],
            variantConfigs: [{ name: 'Color', options: [{ value: 'White' }, { value: 'Red' }, { value: 'Grey' }] }],
          }],
        }) } }],
      });

      // Act
      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST', body: JSON.stringify({ promptText: 'áo thun trắng đỏ xám', locale: 'en' }),
      }));

      // Assert
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: 'merchantLanguageMismatch', retryable: true });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-91: rejects an accentless Vietnamese variant omitted by the original marker set', async () => {
      // Arrange
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test', usage: {}, choices: [{ message: { content: JSON.stringify({
          products: [{ name: 'Hat', variants: [{ name: 'Bạc', price: 10, stock: 0 }], variantConfigs: [{ name: 'Color', options: [{ value: 'Bạc' }] }] }],
        }) } }],
      });

      // Act
      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST', body: JSON.stringify({ promptText: 'ao thun bac', locale: 'en' }),
      }));

      // Assert
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: 'merchantLanguageMismatch', retryable: true });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

    it('TC-F08-04-92: rejects malformed variant config fields before locale detection', async () => {
      // Arrange
      mockRateLimitAllowed = true;
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      const OpenAIMod = await import('openai');
      const OpenAI = OpenAIMod.default as unknown as { prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } } };
      OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-test', usage: {}, choices: [{ message: { content: JSON.stringify({
          products: [{ name: 'Hat', variantConfigs: [{ name: 42, options: [{ value: {} }] }] }],
        }) } }],
      });

      // Act
      const res = await BulkParsePOST(new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
        method: 'POST', body: JSON.stringify({ promptText: 'hat', locale: 'en' }),
      }));

      // Assert
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: 'parseError' });
      expect(OpenAI.prototype.chat.completions.create).toHaveBeenCalledOnce();
      process.env.OPENAI_API_KEY = previousKey;
    });

  });

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

        it('[TC-GENPERF-W1-02] blog seeding scheduled via after(), not run in-request', async () => {
            // Arrange
            const { seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert
            expect(res.status).toBe(200)
            await drainEventLoop()
            expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
            await runCapturedAfterTasks()
            expect(vi.mocked(seedBlogPosts)).toHaveBeenCalledTimes(1)
        })

        it('[TC-GENPERF-W1-05] seeder rejection is non-fatal — no captured task ever rejects', async () => {
            // Arrange — both seeders blow up
            const { seedImageLibraryForSite } = await import('@/lib/images/image-library-seeder')
            const { seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(seedImageLibraryForSite).mockRejectedValueOnce(new Error('imglib boom'))
            vi.mocked(seedBlogPosts).mockRejectedValueOnce(new Error('blog boom'))
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert — response unaffected; invoking tasks resolves (route wraps
            // each in .catch), errors logged not propagated
            expect(res.status).toBe(200)
            await expect(runCapturedAfterTasks()).resolves.toBeUndefined()
            expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(seedBlogPosts)).toHaveBeenCalledTimes(1)
            errorSpy.mockRestore()
            warnSpy.mockRestore()
        })

        it('[TC-GENPERF-W1-06] SSE done payload keys unchanged', async () => {
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
                ['pageId', 'siteId', 'siteLanguage', 'siteName', 'timeMs', 'totalBlocks', 'totalPages'],
            )
        })

        it('[TC-GENPERF-W1-07] after() unavailable → fallback executes seeding anyway', async () => {
            // Arrange — simulate no-request-scope (after throws, e.g. Vitest/local)
            const { after } = await import('next/server')
            const { seedImageLibraryForSite } = await import('@/lib/images/image-library-seeder')
            const { seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(after).mockImplementation(() => { throw new Error('after called outside request scope') })

            try {
                // Act
                const res = await GenerateSitePOST(genPerfReq())

                // Assert — route falls back to `void task()`: seeders still invoked
                expect(res.status).toBe(200)
                await vi.waitFor(() => {
                    expect(vi.mocked(seedImageLibraryForSite)).toHaveBeenCalledTimes(1)
                    expect(vi.mocked(seedBlogPosts)).toHaveBeenCalledTimes(1)
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
                { title: 'B', slug: 'b', content: '<p>b</p>' },
                { title: 'C', slug: 'c', content: '<p>c</p>' },
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

        it('[TC-GENPERF-BI-02] tenant already has posts (prep []) → no persist, no legacy seeding', async () => {
            // Arrange — regenerate case
            const { prepareBlogPosts, persistBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            vi.mocked(prepareBlogPosts).mockResolvedValueOnce([])

            // Act
            const res = await GenerateSitePOST(genPerfReq())

            // Assert
            expect(res.status).toBe(200)
            await runCapturedAfterTasks()
            expect(vi.mocked(persistBlogPosts)).not.toHaveBeenCalled()
            expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
        })

        it('[TC-GENPERF-BI-03] prep still running at persist site → done not blocked; posts persist post-response', async () => {
            // Arrange — prep unresolved when the route reaches the grace race;
            // tiny grace so the pending branch fires deterministically
            const { prepareBlogPosts, persistBlogPosts, seedBlogPosts } = await import('@/lib/ai/seed-blog-posts')
            let resolvePrep: (v: Array<{ title: string; slug: string; content: string }>) => void = () => {}
            vi.mocked(prepareBlogPosts).mockReturnValueOnce(new Promise((r) => { resolvePrep = r }))
            process.env.GEN_BLOG_PREP_GRACE_MS = '50'

            try {
                // Act — response returns without waiting for prep
                const res = await GenerateSitePOST(genPerfReq())

                // Assert — nothing persisted in-request
                expect(res.status).toBe(200)
                expect(vi.mocked(persistBlogPosts)).not.toHaveBeenCalled()

                // Prep finishes after the response → captured after() task persists
                resolvePrep([
                    { title: 'A', slug: 'a', content: '<p>a</p>' },
                    { title: 'B', slug: 'b', content: '<p>b</p>' },
                    { title: 'C', slug: 'c', content: '<p>c</p>' },
                ])
                await runCapturedAfterTasks()
                expect(vi.mocked(persistBlogPosts)).toHaveBeenCalledTimes(1)
                expect(vi.mocked(seedBlogPosts)).not.toHaveBeenCalled()
            } finally {
                delete process.env.GEN_BLOG_PREP_GRACE_MS
            }
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

})
