import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET, PATCH, DELETE } from '@/app/api/blogs/[id]/route'

// ─── TC-F17: Blog detail API ─────────────────────────────────────────

const ctx = { params: Promise.resolve({ id: 'blog-1' }) }

describe('GET /api/blogs/[id] [TC-F17]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns blog post owned by user', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', title: 'Post', tenant: 'tenant-1' })
        const res = await GET(new Request('http://localhost'), ctx as any)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.title).toBe('Post')
    })

    it('returns 403 for blog owned by different tenant', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', title: 'Post', tenant: 'other-tenant' })
        const res = await GET(new Request('http://localhost'), ctx as any)
        expect(res.status).toBe(403)
    })

    it('returns 404 when blog not found', async () => {
        mockFindByID.mockRejectedValue(new Error('not found'))
        const res = await GET(new Request('http://localhost'), ctx as any)
        expect(res.status).toBe(404)
    })
})

describe('PATCH /api/blogs/[id] [TC-F17]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('updates blog post', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: 'tenant-1' })
        mockUpdate.mockResolvedValue({ id: 'blog-1', title: 'Updated' })
        const req = { json: () => Promise.resolve({ title: 'Updated' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.title).toBe('Updated')
    })

    it('returns 403 for wrong tenant', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: 'other' })
        const req = { json: () => Promise.resolve({ title: 'X' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        expect(res.status).toBe(403)
    })
})

describe('DELETE /api/blogs/[id] [TC-F17]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('soft-deletes blog post', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: 'tenant-1' })
        mockUpdate.mockResolvedValue({})
        const res = await DELETE(new Request('http://localhost'), ctx as any)
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.deleted).toBe('blog-1')
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'deleted' } }))
    })

    it('returns 403 for wrong tenant', async () => {
        mockFindByID.mockResolvedValue({ id: 'blog-1', tenant: 'other' })
        const res = await DELETE(new Request('http://localhost'), ctx as any)
        expect(res.status).toBe(403)
    })
})
