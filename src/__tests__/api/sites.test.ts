import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH as SavePATCH } from '@/app/api/sites/[siteId]/save/route'
import { PATCH as PublishPATCH, DELETE as UnpublishDELETE } from '@/app/api/sites/[siteId]/publish/route'
import { GET as EditorDataGET } from '@/app/api/sites/[siteId]/editor-data/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

// Mock cookies từ next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'mock-valid-token' }),
        set: vi.fn(),
        delete: vi.fn()
    })
}))

// Mock auth module globally so we can control auth in editor-data tests
vi.mock('@/lib/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/auth')>()
    return {
        ...actual,
        getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@example.com' }),
        withAuth: vi.fn().mockImplementation((handler: any) => {
            return async (req: any, ctx: any) => {
                const user = { id: 'user-1', email: 'admin@example.com' }
                return handler(user, req, ctx)
            }
        })
    }
})

// Mock Payload CMS Database và Auth function
vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            auth: vi.fn().mockImplementation(async ({ headers }) => {
                const token = headers.get('Authorization')
                // Nếu header auth hợp lệ (mocked ở trên) -> Cho phép user đi tiếp
                if (token === 'JWT mock-valid-token') {
                    return { user: { id: 'user-1', email: 'admin@example.com' } }
                }
                return { user: null }
            }),
            find: vi.fn().mockResolvedValue({
                docs: [
                    { id: 'page-home', isHomepage: true, layout: [] }
                ]
            }),
            update: vi.fn().mockResolvedValue({ id: 'site-123' })
        })
    }
})

describe('Sites APIs', () => {

    describe('PATCH /api/sites/[siteId]/save', () => {
        
        // Mock clear các giá trị cũ sau mỗi test
        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('returns 401 Unauthorized if token is missing or invalid', async () => {
             // Sửa lại mock next/headers cho riêng test case này (trả về undefined token)
             const nextHeadersMock = await import('next/headers')
             // @ts-ignore
             nextHeadersMock.cookies.mockResolvedValueOnce({
                 get: () => undefined
             })

             const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                 method: 'PATCH',
                 body: JSON.stringify({ blocks: [{ blockType: 'hero' }] })
             })
             
             // Gọi API handler với Dynamic params { siteId: '123' }
             const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
             
             expect(res.status).toBe(401)
        })

        it('returns 200 and updates blocks if valid token is provided', async () => {
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({ blocks: [{ blockType: 'hero', headline: 'Updated Hero' }] })
            })
            
            // Giả lập Promise.resolve cho params theo chuẩn App Router v15
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            const result = await res.json()
            
            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.message).toBe('Saved successfully')
        })
    })

    describe('PATCH & DELETE /api/sites/[siteId]/publish', () => {
        
        beforeEach(() => { vi.clearAllMocks() })

        it('returns 401 if token is missing when publishing', async () => {
            const nextHeadersMock = await import('next/headers')
            // @ts-ignore
            nextHeadersMock.cookies.mockResolvedValueOnce({ get: () => undefined })

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(401)
        })

        it('returns 404 if site is not found when publishing', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
                findByID: vi.fn().mockResolvedValue(null) // Mock Not found
            })

            const req = new NextRequest('http://localhost:3000/api/sites/999/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '999' }) })
            expect(res.status).toBe(404)
        })

        it('returns 200 and successfully publishes the site', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
                findByID: vi.fn().mockResolvedValue({ id: '123', status: 'draft' }),
                update: vi.fn().mockResolvedValue({ id: '123', status: 'published', publishedAt: new Date().toISOString() })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.success).toBe(true)
            expect(result.data.status).toBe('published')
        })
        
        it('returns 200 and successfully unpublishes the site', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
                findByID: vi.fn().mockResolvedValue({ id: '123', status: 'published' }),
                update: vi.fn().mockResolvedValue({ id: '123', status: 'draft' })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'DELETE' })
            const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.success).toBe(true)
            expect(result.data.status).toBe('draft')
        })
    })

    describe('GET /api/sites/[siteId]/editor-data', () => {

        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('returns 404 if site is not found', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockResolvedValue({ docs: [] }),
            })

            const req = new NextRequest('http://localhost:3000/api/sites/999/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '999' }) })
            expect(res.status).toBe(404)
        })

        it('returns 200 with site and page data', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue({ id: '123', name: 'Test Site', status: 'draft', siteType: 'business' }),
                find: vi.fn().mockResolvedValue({
                    docs: [{ id: 'page-1', title: 'Home', layout: [{ blockType: 'hero' }] }]
                })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.site.name).toBe('Test Site')
            expect(result.page.layout[0].blockType).toBe('hero')
        })
    })

})
