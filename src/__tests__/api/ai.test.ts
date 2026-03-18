import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as GenerateSitePOST } from '@/app/api/ai/generate-site/route'
import { POST as EditBlockPOST } from '@/app/api/ai/edit-block/route'
import { POST as RewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as ApplyTemplatePOST } from '@/app/api/ai/apply-template/route'
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

// Mock Database (PayloadCMS)
let mockSiteDB: any[] = []
let mockPageDB: any[] = []

vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            auth: vi.fn().mockResolvedValue({
                user: { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
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


describe('AI Streaming APIs', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockSiteDB = []
        mockPageDB = []
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
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread' }
                 })
             })
             const res = await GenerateSitePOST(req)
             const result = await res.json()

             expect(res.status).toBe(200)
             expect(result.success).toBe(true)
             expect(result.siteName).toBe('AI Bakery')
             expect(mockSiteDB.length).toBe(1) // A site was created
             expect(mockPageDB.length).toBe(1) // A homepage was created
        })

        it('returns text/event-stream response for SSE mode when stream=true', async () => {
             const req = new NextRequest('http://localhost:3000/api/ai/generate-site?stream=true', {
                 method: 'POST',
                 body: JSON.stringify({ 
                     businessInfo: { businessName: 'Bakery', industry: 'Food', products: 'Bread' }
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
            // Mock OpenAI is already handled or we can just expect our mock config to take over
            const req = new NextRequest('http://localhost:3000/api/ai/edit-block', {
                method: 'POST',
                body: JSON.stringify({ instruction: 'Make to dark mode', blockIndex: 0 })
            })
            // Temporary mock openai within this test file if necessary, but openai is not globally mocked in this file yet.
            // Wait, we didn't mock openai in ai.test.ts globally? 
            // Ah, the route uses new OpenAI() inside. Let's mock it.
            vi.mock('openai', () => {
                const OpenAI = vi.fn()
                OpenAI.prototype.chat = {
                    completions: {
                        create: vi.fn().mockResolvedValue({
                            choices: [{ message: { content: JSON.stringify({ action: "update_theme", changes: { colorMode: "dark" } }) } }]
                        })
                    }
                }
                return { default: OpenAI }
            })

            const res = await EditBlockPOST(req)
            expect(res.status).toBe(200)
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

})
