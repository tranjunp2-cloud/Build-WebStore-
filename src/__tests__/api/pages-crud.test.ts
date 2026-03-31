import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
        findByID: mockFindByID,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET, POST } from '@/app/api/sites/[siteId]/pages/route'

// ─── TC-F05.02: Page Manager CRUD ────────────────────────────────────

const ctx = { params: Promise.resolve({ siteId: 'site-1' }) }

describe('GET /api/sites/[siteId]/pages [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns pages list for authorized site', async () => {
        // Arrange — site belongs to user's tenant
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] }) // sites
            .mockResolvedValueOnce({ docs: [
                { id: 'p1', title: 'Home', slug: '/', _status: 'published', isHomepage: true, updatedAt: '2026-04-01' },
                { id: 'p2', title: 'About', slug: '/about', _status: 'draft', updatedAt: '2026-04-01' },
            ]}) // pages

        // Act
        const req = new Request('http://localhost/api/sites/site-1/pages')
        const res = await GET(req, ctx as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.pages).toHaveLength(2)
        expect(body.pages[0].title).toBe('Home')
        expect(body.pages[0].isHomepage).toBe(true)
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] }) // no matching site

        const req = new Request('http://localhost/api/sites/other-site/pages')
        const res = await GET(req, ctx as any)

        expect(res.status).toBe(403)
    })
})

describe('POST /api/sites/[siteId]/pages [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('creates page with valid data', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] }) // auth
            .mockResolvedValueOnce({ docs: [] }) // no duplicate slug
        mockCreate.mockResolvedValue({
            id: 'p-new', title: 'Contact', slug: '/contact',
            _status: 'draft', isHomepage: false, isVisible: true,
            seo: {}, updatedAt: '2026-04-01',
        })

        const req = { json: () => Promise.resolve({ title: 'Contact', slug: 'contact' }) } as unknown as Request
        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.title).toBe('Contact')
        expect(body.page.slug).toBe('/contact')
    })

    it('returns 409 for duplicate slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] })
            .mockResolvedValueOnce({ docs: [{ id: 'existing' }] }) // duplicate

        const req = { json: () => Promise.resolve({ title: 'About', slug: 'about' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(409)
    })

    it('returns 400 for invalid slug', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'site-1', tenant: 'tenant-1' }] })

        const req = { json: () => Promise.resolve({ title: 'Bad', slug: 'Bad Slug!!!' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(400)
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] })

        const req = { json: () => Promise.resolve({ title: 'X', slug: 'x' }) } as unknown as Request
        const res = await POST(req, ctx as any)

        expect(res.status).toBe(403)
    })
})
