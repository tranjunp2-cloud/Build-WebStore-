import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/templates/preview/route'
import { NextRequest } from 'next/server'

// ── Payload mock ──────────────────────────────────────────────────────────────
let mockTemplate: any = {
    id: 123,
    name: 'Coffee Shop Template',
    category: ['business'],
    defaultTheme: { primaryColor: '#8B4513', secondaryColor: '#D2B48C', fontHeading: 'Playfair Display', fontBody: 'Lato' },
    defaultBlocks: [
        { blockType: 'hero', headline: 'Welcome to My Coffee Shop', variant: 'centered' },
        { blockType: 'features', features: [{ title: 'Fresh Brew', description: 'Quality coffee' }] },
    ],
}

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => ({
        findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
            if (collection === 'templates' && id === Number(mockTemplate.id)) {
                return mockTemplate
            }
            return null
        }),
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Mock HTML builder
vi.mock('@/lib/htmlBuilder', () => ({
    buildFullHTML: vi.fn().mockReturnValue('<html><body>Template HTML</body></html>'),
}))

vi.mock('@/app/api/preview/renderers', () => ({
    THEMES: {
        business: { primary: '#1f2937', secondary: '#3b82f6', text: '#111827', bg: '#ffffff' },
    },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeGetReq = (query: string = '') =>
    new NextRequest(`http://localhost:3000/api/templates/preview${query}`, { method: 'GET' })

// ── TC-GH1519-03: GET /api/templates/preview ────────────────────────────────
describe('[TC-GH1519-03] GET /api/templates/preview (status code contracts)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockTemplate = {
            id: 123,
            name: 'Coffee Shop Template',
            category: ['business'],
            defaultTheme: { primaryColor: '#8B4513' },
            defaultBlocks: [{ blockType: 'hero', headline: 'Welcome' }],
        }
    })

    it('TC-GH1519-03a: returns 400 when id parameter is missing', async () => {
        // Arrange
        const req = makeGetReq('')

        // Act
        const res = await GET(req)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(400)
        expect(body).toContain('Missing id param')
    })

    it('TC-GH1519-03b: returns 200 with HTML when id is valid', async () => {
        // Arrange
        const req = makeGetReq('?id=123')

        // Act
        const res = await GET(req)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toContain('text/html')
        expect(body).toContain('html')
    })

    it('TC-GH1519-03c: returns 404 when template id does not exist', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockResolvedValue(null),
        } as any)
        const req = makeGetReq('?id=999')

        // Act
        const res = await GET(req)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(404)
        expect(body).toContain('Template not found')
    })

    it('TC-GH1519-03d: returns 404 when Payload throws NotFound error', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockRejectedValue({
                name: 'NotFound',
                message: 'Template not found in collection',
            }),
        } as any)
        const req = makeGetReq('?id=999')

        // Act
        const res = await GET(req)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(404)
        expect(body).toContain('Template not found')
    })

    it('TC-GH1519-03e: returns 404 when NotFoundError variant is thrown', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockRejectedValue({
                name: 'NotFoundError',
                message: 'Document not found',
            }),
        } as any)
        const req = makeGetReq('?id=999')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(404)
    })

    it('TC-GH1519-03f: returns 404 when error.status is 404', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockRejectedValue({
                status: 404,
                message: 'Not found',
            }),
        } as any)
        const req = makeGetReq('?id=999')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(404)
    })

    it('TC-GH1519-03g: returns 500 for non-NotFound errors', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        } as any)
        const req = makeGetReq('?id=123')

        // Act
        const res = await GET(req)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(500)
        expect(body).toContain('Error:')
    })

    it('TC-GH1519-03h: returns 200 with default page when page parameter is missing', async () => {
        // Arrange
        const req = makeGetReq('?id=123')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toContain('text/html')
    })

    it('TC-GH1519-03i: returns 200 with specified page when page parameter is provided', async () => {
        // Arrange
        mockTemplate.templatePages = [
            { slug: 'home', isHomepage: true, layout: [{ blockType: 'hero' }] },
            { slug: 'about', isHomepage: false, layout: [{ blockType: 'text' }] },
        ]
        const req = makeGetReq('?id=123&page=about')

        // Act
        const res = await GET(req)

        // Assert
        expect(res.status).toBe(200)
    })
})
