import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, roles: [] as string[], tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: vi.fn().mockResolvedValue({
        title: 'Generated Title',
        description: 'Generated description for SEO.',
    }),
}))

import { POST } from '@/app/api/seo/fix-all/route'

// ─── TC-F03.33: SEO title template for homepage ──────────────────────
// ─── TC-F03.34: SEO title template for product ──────────────────────

describe('POST /api/seo/fix-all [TC-F03.33, TC-F03.34]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.roles = []
    })

    it('generates SEO proposals for missing fields', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            name: 'My Store',
            tenant: 'tenant-1',
        })

        // Act
        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                missingSeo: [{
                    collection: 'products',
                    id: 'prod-1',
                    title: 'Nasi Lemak',
                    missingFields: ['title', 'description'],
                }],
            }),
        } as unknown as Request

        const res = await POST(req, {} as any)
        const text = await res.text()
        const dataLines = text.split('\n').filter(line => line.startsWith('data: '))
        const parsedData = dataLines.map(line => JSON.parse(line.replace('data: ', '')))

        // Assert
        expect(res.status).toBe(200)
        expect(parsedData).toHaveLength(1)
        expect(parsedData[0].proposedTitle).toBe('Generated Title')
        expect(parsedData[0].proposedDescription).toBeDefined()
    })

    it('returns 404 when site not found', async () => {
        mockFindByID.mockResolvedValue(null)

        const req = {
            json: () => Promise.resolve({
                siteId: 'bad',
                missingSeo: [],
            }),
        } as unknown as Request

        const res = await POST(req, {} as any)
        expect(res.status).toBe(404)
    })

    it('returns 403 for cross-tenant access [TC-F19.38]', async () => {
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'other-tenant',
        })

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                missingSeo: [],
            }),
        } as unknown as Request

        const res = await POST(req, {} as any)
        expect(res.status).toBe(403)
    })

    it('accepts blogs collection and generates proposals [TC-F03.40]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            name: 'My Store',
            tenant: 'tenant-1',
        })

        // Act
        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                missingSeo: [{
                    collection: 'blogs',
                    id: 'blog-1',
                    title: 'How to Cook Nasi Lemak',
                    missingFields: ['title', 'description'],
                }],
            }),
        } as unknown as Request

        // Route context unused by handler — safe to stub as empty object
        const res = await POST(req, {} as any)
        const text = await res.text()
        const dataLines = text.split('\n').filter(line => line.startsWith('data: '))
        const parsedData = dataLines.map(line => JSON.parse(line.replace('data: ', '')))

        // Assert
        expect(res.status).toBe(200)
        expect(parsedData).toHaveLength(1)
        expect(parsedData[0].collection).toBe('blogs')
        expect(parsedData[0].proposedTitle).toBe('Generated Title')
        expect(parsedData[0].proposedDescription).toBeDefined()
    })

    it('skips proposedTitle when not in missingFields', async () => {
        mockFindByID.mockResolvedValue({ id: 'site-1', name: 'Store', tenant: 'tenant-1' })

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                missingSeo: [{
                    collection: 'pages',
                    id: 'page-1',
                    title: 'About',
                    missingFields: ['description'], // only description missing
                }],
            }),
        } as unknown as Request

        const res = await POST(req, {} as any)
        const text = await res.text()
        const dataLines = text.split('\n').filter(line => line.startsWith('data: '))
        const parsedData = dataLines.map(line => JSON.parse(line.replace('data: ', '')))

        expect(parsedData[0].proposedTitle).toBeUndefined()
        expect(parsedData[0].proposedDescription).toBeDefined()
    })
})
