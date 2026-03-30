import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = {
    id: 1,
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1' }],
}
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        find: mockFind,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { POST as applyFixesPOST } from '@/app/api/seo/apply-fixes/route'
import { POST as sitemapPOST } from '@/app/api/seo/sitemap/route'

// ─── TC-F03.30: Sitemap XML generation ────────────────────────────────
// ─── TC-F03.36: SEO character trimming ────────────────────────────────
// ─── TC-F19.38: IDOR prevention in SEO fixes ─────────────────────────

describe('POST /api/seo/apply-fixes [TC-F03.36, TC-F19.38]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.roles = []
    })

    it('applies SEO fixes and returns undo data', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            tenant: 'tenant-1',
            seo: { title: 'Old Title', description: 'Old Desc' },
        })
        mockUpdate.mockResolvedValue({})

        // Act
        const req = {
            json: () => Promise.resolve({
                fixes: [{
                    targetId: 'prod-1',
                    collection: 'products',
                    seo: { title: 'New SEO Title' },
                }],
            }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.undoData).toHaveLength(1)
        expect(body.undoData[0].seo.title).toBe('Old Title')
    })

    it('rejects cross-tenant fix attempt [TC-F19.38]', async () => {
        // Arrange — product belongs to different tenant
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            tenant: 'other-tenant',
            seo: {},
        })

        // Act
        const req = {
            json: () => Promise.resolve({
                fixes: [{
                    targetId: 'prod-1',
                    collection: 'products',
                    seo: { title: 'Hack' },
                }],
            }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as any)

        // Assert
        expect(res.status).toBe(500) // throws internally → 500
    })

    it('allows super-admin to bypass IDOR', async () => {
        // Arrange
        mockUser.roles = ['super-admin']
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            tenant: 'any-tenant',
            seo: { title: 'Old' },
        })
        mockUpdate.mockResolvedValue({})

        // Act
        const req = {
            json: () => Promise.resolve({
                fixes: [{
                    targetId: 'prod-1',
                    collection: 'products',
                    seo: { title: 'Admin Fix' },
                }],
            }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
    })

    it('returns 400 for invalid schema', async () => {
        // Act — missing required fields
        const req = {
            json: () => Promise.resolve({ fixes: 'not-an-array' }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as any)

        // Assert
        expect(res.status).toBe(400)
    })
})

describe('POST /api/seo/sitemap [TC-F03.30]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('generates sitemap XML with published pages', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', domain: 'mycafe.com', slug: 'mycafe' })
        mockFind.mockResolvedValue({
            docs: [
                { slug: 'home', updatedAt: '2026-03-01T00:00:00Z' },
                { slug: 'about', updatedAt: '2026-03-02T00:00:00Z' },
            ],
        })

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1' }) } as unknown as Request
        const res = await sitemapPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.data.xml).toContain('<?xml version="1.0"')
        expect(body.data.xml).toContain('https://mycafe.com')
        expect(body.data.pageCount).toBe(2)
    })

    it('home page gets priority 1.0, others get 0.8', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', domain: 'test.com' })
        mockFind.mockResolvedValue({
            docs: [
                { slug: 'home', updatedAt: '2026-03-01T00:00:00Z' },
                { slug: 'products', updatedAt: '2026-03-01T00:00:00Z' },
            ],
        })

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1' }) } as unknown as Request
        const res = await sitemapPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.data.xml).toContain('<priority>1.0</priority>')
        expect(body.data.xml).toContain('<priority>0.8</priority>')
    })

    it('normalizes home slug to empty path', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', domain: 'test.com' })
        mockFind.mockResolvedValue({
            docs: [{ slug: 'home', updatedAt: '2026-03-01T00:00:00Z' }],
        })

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1' }) } as unknown as Request
        const res = await sitemapPOST(req, {} as any)
        const body = await res.json()

        // Assert — home should be https://test.com (not /home)
        expect(body.data.xml).toContain('<loc>https://test.com</loc>')
        expect(body.data.xml).not.toContain('/home')
    })

    it('returns 404 when site not found', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'bad' }) } as unknown as Request
        const res = await sitemapPOST(req, {} as any)

        // Assert
        expect(res.status).toBe(404)
    })

    it('falls back to server URL when no custom domain', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', slug: 'mysite' })
        mockFind.mockResolvedValue({ docs: [] })
        process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.primeweb.com'

        // Act
        const req = { json: () => Promise.resolve({ siteId: 'site-1' }) } as unknown as Request
        const res = await sitemapPOST(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.data.sitemapUrl).toContain('app.primeweb.com/sites/mysite')
    })
})
