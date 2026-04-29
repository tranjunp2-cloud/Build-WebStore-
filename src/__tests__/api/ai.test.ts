import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { POST as GenerateSitePOST } from '@/app/api/ai/generate-site/route'
import { POST as EditBlockPOST } from '@/app/api/ai/edit-block/route'
import { POST as RewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as ApplyTemplatePOST } from '@/app/api/ai/apply-template/route'
import { POST as SeoGeneratePOST } from '@/app/api/ai/seo-generate/route'
import { POST as BulkParsePOST } from '@/app/api/ai/products-bulk-parse/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

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

// Mock AI Generator (SSE logic)
vi.mock('@/lib/ai/openai-generator', () => ({
    generateSiteWithAI: vi.fn().mockResolvedValue({
        result: {
            siteName: 'AI Bakery',
            siteType: 'ecommerce',
            theme: { primaryColor: '#000' },
            seo: { title: 'SEO Bakery', description: 'Desc Bakery' },
            blocks: [{ blockType: 'hero', headline: 'Welcome to Bakery' }]
        },
        events: [
            { event: 'theme_generated', data: { color: 'blue' } },
            { event: 'content_generated', data: { block: 'hero' } }
        ]
    })
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

        it('returns 402 when a free-plan tenant has already used the AI generation quota', async () => {
             mockTenant = { id: 'tenant-1', plan: 'free', aiGenerationsCount: 1 }

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

             expect(res.status).toBe(402)
             expect(body.code).toBe('PAYMENT_REQUIRED')
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
        it('returns 429 when rate limit is hit (Stress Protection)', async () => {
            mockRateLimitAllowed = false
            const req = new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST',
                body: JSON.stringify({ promptText: 'Áo thun 50k' })
            })
            const res = await BulkParsePOST(req)
            expect(res.status).toBe(429)
        })

        it('returns fallback data when OPENAI_API_KEY is completely missing', async () => {
            mockRateLimitAllowed = true
            const prev = process.env.OPENAI_API_KEY
            delete process.env.OPENAI_API_KEY
            
            const req = new NextRequest('http://localhost:3000/api/ai/products-bulk-parse', {
                method: 'POST',
                body: JSON.stringify({ promptText: 'Áo thun 50k' })
            })
            const res = await BulkParsePOST(req)
            const json = await res.json()
            expect(res.status).toBe(200)
            expect(json.products[0].name).toContain('Không API Key')
            
            process.env.OPENAI_API_KEY = prev
        })
    })

})
