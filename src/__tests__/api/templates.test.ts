import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as ListGET } from '@/app/api/templates/list/route'
import { GET as PreviewGET } from '@/app/api/templates/preview/route'
import { POST as SeedPOST } from '@/app/api/templates/seed/route'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
    cookies: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'mock-valid-token' }),
        set: vi.fn(),
        delete: vi.fn()
    })
}))

// Mock helper function sinh HTML giao diện từ payload CMS layout
vi.mock('@/app/api/preview/[siteId]/route', () => ({
    buildFullHTML: vi.fn().mockReturnValue('<html><body>Mocked Theme HTML</body></html>')
}))

// Cung cấp Fake Array Template ảo cho Payload Seed API import trực tiếp
vi.mock('@/lib/ai/seed-templates', () => ({
    SEED_TEMPLATES: [
        { name: 'Mock Template 1', defaultTheme: 'dark' }
    ]
}))

// Trạng thái của Fake DB để có thể test Seed Force Delete
let mockTemplateDB: any[] = []

vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockImplementation(async () => ({
            auth: vi.fn().mockImplementation(async ({ headers }) => {
                const token = headers.get('Authorization')
                if (token === 'JWT mock-valid-token') {
                     return { user: { id: 'user-1', email: 'admin@example.com' } }
                }
                return { user: null }
            }),
            find: vi.fn().mockImplementation(async () => {
                return { docs: mockTemplateDB, totalDocs: mockTemplateDB.length }
            }),
            findByID: vi.fn().mockImplementation(async ({ id }) => {
                if (id === 1 || id === '1') {
                     return { id: 1, name: 'Template Đã mock', defaultBlocks: [], category: 'business' }
                }
                return null
            }),
            create: vi.fn().mockImplementation(async ({ data }) => {
                const newDoc = { id: Date.now(), ...data }
                mockTemplateDB.push(newDoc)
                return newDoc
            }),
            delete: vi.fn().mockImplementation(async () => {
                mockTemplateDB = []
                return true
            })
        }))
    }
})


describe('Templates APIs', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        // Đặt lại DB trước mỗi block
        mockTemplateDB = []
    })
    
    describe('GET /api/templates/list', () => {
        it('returns 200 with list of templates', async () => {
            // Nhét trước 2 mẫu vào Fake DB
            mockTemplateDB = [{ id: 1, name: 'T1' }, { id: 2, name: 'T2' }]
            
            const req = new NextRequest('http://localhost:3000/api/templates/list?limit=10')
            const response = await ListGET(req)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.docs.length).toBe(2)
            expect(result.totalDocs).toBe(2)
        })

        it('returns 200 with empty docs array when no templates exist', async () => {
            // Đảm bảo DB rỗng
            mockTemplateDB = []
            
            const req = new NextRequest('http://localhost:3000/api/templates/list?limit=10')
            const response = await ListGET(req)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.docs.length).toBe(0)
            expect(result.totalDocs).toBe(0)
        })
    })

    describe('GET /api/templates/preview', () => {
        it('returns 400 if id param is missing', async () => {
            const req = new NextRequest('http://localhost:3000/api/templates/preview')
            const response = await PreviewGET(req)
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.error).toBe('Missing id param')
        })

        it('returns 404 if template id not found in db', async () => {
            const req = new NextRequest('http://localhost:3000/api/templates/preview?id=999')
            const response = await PreviewGET(req)
            const text = await response.text()

            expect(response.status).toBe(404)
            expect(text).toBe('Template not found')
        })

        it('returns 200 text/html preview for valid template id', async () => {
            const req = new NextRequest('http://localhost:3000/api/templates/preview?id=1')
            const response = await PreviewGET(req)

            expect(response.status).toBe(200)
            expect(response.headers.get('Content-Type')).toContain('text/html')
            
            const text = await response.text()
            expect(text).toContain('Mocked Theme HTML')
        })
    })

    describe('POST /api/templates/seed', () => {
        it('returns 200 and seeds database if empty', async () => {
             const req = new NextRequest('http://localhost:3000/api/templates/seed')
             const response = await SeedPOST(req)
             const result = await response.json()
             
             expect(response.status).toBe(200)
             expect(result.success).toBe(true)
             expect(result.data.count).toBe(1) // Chỉ có 1 mock template
        })

        it('returns 409 Conflict if already seeded and no force flag', async () => {
             // DB ảo đang có sẵn đồ
             mockTemplateDB = [{ id: 999, name: 'Existing' }]

             const req = new NextRequest('http://localhost:3000/api/templates/seed')
             const response = await SeedPOST(req)
             const result = await response.json()
             
             expect(response.status).toBe(409)
             expect(result.success).toBe(false)
             expect(result.error.code).toBe('ALREADY_SEEDED')
        })

        it('returns 200 and re-seeds if force=true flag is provided', async () => {
             // DB ảo đang có đồ
             mockTemplateDB = [{ id: 999, name: 'Existing' }]

             const req = new NextRequest('http://localhost:3000/api/templates/seed?force=true')
             const response = await SeedPOST(req)
             const result = await response.json()
             
             expect(response.status).toBe(200)
             expect(result.success).toBe(true)
             expect(result.data.reseeded).toBe(true)
             expect(mockTemplateDB.length).toBe(1) // Khôi phục về đúng 1 mock
             expect(mockTemplateDB[0].name).toBe('Mock Template 1')
        })
    })

})
