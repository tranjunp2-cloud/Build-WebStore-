import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        findByID: mockFindByID,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { PATCH } from '@/app/api/sites/[siteId]/pages/[pageId]/route'

// ─── TC-F05.02: Page update API ──────────────────────────────────────

const ctx = { params: Promise.resolve({ siteId: '1', pageId: '10' }) }

describe('PATCH /api/sites/[siteId]/pages/[pageId] [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('updates page visibility', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About' })
        mockUpdate.mockResolvedValue({
            id: '10', title: 'About', slug: '/about',
            _status: 'draft', isVisible: false, seo: {}, updatedAt: '2026-04-01',
        })

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.isVisible).toBe(false)
    })

    it('updates page SEO fields', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About' })
        mockUpdate.mockResolvedValue({
            id: '10', title: 'About', slug: '/about',
            _status: 'draft', isVisible: true,
            seo: { title: 'New SEO', description: 'New desc' },
            updatedAt: '2026-04-01',
        })

        const req = { json: () => Promise.resolve({ seoTitle: 'New SEO', seoDescription: 'New desc' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.seoTitle).toBe('New SEO')
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] })

        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, ctx as any)

        expect(res.status).toBe(403)
    })

    it('returns 404 when page not on site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 999 }) // wrong site

        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, ctx as any)

        expect(res.status).toBe(404)
    })

    it('returns 400 for invalid params', async () => {
        const badCtx = { params: Promise.resolve({ siteId: 'abc', pageId: 'xyz' }) }
        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, badCtx as any)

        expect(res.status).toBe(400)
    })

    it('returns 400 for 404 page slug change', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/404', title: '404 Not Found' })

        const req = { json: () => Promise.resolve({ slug: 'new-slug' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toContain('404')
    })

    it('returns 400 for duplicate slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] }) // auth
            .mockResolvedValueOnce({ docs: [{ id: '20' }] }) // duplicate slug found
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/old', title: 'Old' })

        const req = { json: () => Promise.resolve({ slug: 'existing' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toContain('duplicate')
    })

    it('returns 400 when no fields to update', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About' })

        const req = { json: () => Promise.resolve({}) } as unknown as Request
        const res = await PATCH(req, ctx as any)

        expect(res.status).toBe(400)
    })
})
