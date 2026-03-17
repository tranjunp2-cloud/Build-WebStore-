import { describe, it, expect, vi } from 'vitest'
import { POST as AnalyzePOST } from '@/app/api/seo/analyze/route'
import { POST as FixPOST } from '@/app/api/seo/fix/route'
import { NextRequest } from 'next/server'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-1', email: 'admin@example.com' }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@example.com' }),
}))

// Giả lập OpenAI cho tính năng SEO Fix
vi.mock('openai', () => {
    const OpenAI = vi.fn()
    OpenAI.prototype.chat = {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            metaTitle: "AI SEO Title",
                            metaDescription: "AI generated SEO description for testing"
                        })
                    }
                }]
            })
        }
    }
    return { default: OpenAI }
})

// Giả lập Payload CMS cho cả 2 APIs (Analyze và Fix)
vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'sites' && id === 'site-valid') {
                    return { id: 'site-valid', name: 'Mock Site', seo: {} }
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
    
    describe('POST /api/seo/analyze', () => {
        it('returns 400 if siteId is omitted', async () => {
            const req = new NextRequest('http://localhost:3000/api/seo/analyze', {
                method: 'POST',
                body: JSON.stringify({})
            })
            const res = await AnalyzePOST(req)
            expect(res.status).toBe(400)
            expect((await res.json()).success).toBe(false)
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

        it('returns 200 and fixes pages using OpenAI if missing SEO info', async () => {
            const req = new NextRequest('http://localhost:3000/api/seo/fix', {
                method: 'POST',
                body: JSON.stringify({ siteId: 'site-valid' })
            })
            const res = await FixPOST(req)
            const result = await res.json()

            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.totalPages).toBeGreaterThan(0)
            
            // OpenAI phải fix được ít nhất 1 trang vì mock có trang thiếu info
            expect(result.data.fixedPages).toBeGreaterThan(0)
            expect(result.data.results[0].metaTitle).toBe("AI SEO Title")
        })
    })

})
