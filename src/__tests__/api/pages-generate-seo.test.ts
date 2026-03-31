import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        findByID: mockFindByID,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: vi.fn().mockResolvedValue({
        title: 'Generated SEO Title',
        description: 'Generated SEO description for the page.',
    }),
}))

import { POST } from '@/app/api/sites/[siteId]/pages/[pageId]/generate-seo/route'

// ─── TC-F05.13: Page-level SEO AI generation ─────────────────────────

const ctx = { params: Promise.resolve({ siteId: '1', pageId: '10' }) }

describe('POST /api/sites/[siteId]/pages/[pageId]/generate-seo [TC-F05.13]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('generates SEO title and description', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, title: 'About Us', layout: [], _status: 'published' }) // page
            .mockResolvedValueOnce({ id: '1', name: 'My Store', tenant: 'tenant-1' }) // site
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] }) // auth

        const req = new Request('http://localhost')
        const res = await POST(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.title).toBe('Generated SEO Title')
        expect(body.description).toBe('Generated SEO description for the page.')
    })

    it('generates slug for draft pages', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, title: 'New Page', layout: [], _status: 'draft' })
            .mockResolvedValueOnce({ id: '1', name: 'Store', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })

        const req = new Request('http://localhost')
        const res = await POST(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(body.slug).toBeDefined()
        expect(typeof body.slug).toBe('string')
    })

    it('returns 404 when page not on site', async () => {
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 999, title: 'X' }) // wrong site

        const req = new Request('http://localhost')
        const res = await POST(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(404)
    })

    it('returns 403 for unauthorized site', async () => {
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, title: 'X' })
            .mockResolvedValueOnce({ id: '1', name: 'X', tenant: 'tenant-1' })
        mockFind.mockResolvedValueOnce({ docs: [] }) // no matching tenant

        const req = new Request('http://localhost')
        const res = await POST(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(403)
    })

    it('returns 400 for invalid params', async () => {
        const badCtx = { params: Promise.resolve({ siteId: 'abc', pageId: 'xyz' }) }
        const req = new Request('http://localhost')
        const res = await POST(req, badCtx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(400)
    })
})
