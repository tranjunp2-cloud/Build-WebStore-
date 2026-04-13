import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (top of file per convention) ───────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, find: mockFind, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { PATCH, DELETE } from '@/app/api/blog-categories/[id]/route'

// ─── TC-F17.020: Category soft-delete fallback ────────────────────────
// ─── TC-F17.020b: Category name uniqueness ────────────────────────────
// ─── TC-F19.38: Cross-tenant isolation (IDOR prevention) ──────────────

const ctx = { params: Promise.resolve({ id: 'cat-1' }) }

describe('PATCH /api/blog-categories/[id] [TC-F17.020b]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates category with valid data', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: 'tenant-1', name: 'Old' })
        mockUpdate.mockResolvedValue({ id: 'cat-1', name: 'New Name' })

        // Act
        const req = { json: () => Promise.resolve({ name: 'New Name' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.name).toBe('New Name')
    })

    it('returns 403 for cross-tenant access [TC-F19.38]', async () => {
        // Arrange — category belongs to different tenant
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: 'other-tenant' })

        // Act
        const req = { json: () => Promise.resolve({ name: 'Hack' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when category not found', async () => {
        // Arrange
        mockFindByID.mockRejectedValue(new Error('not found'))

        // Act
        const req = { json: () => Promise.resolve({ name: 'X' }) } as unknown as Request
        const res = await PATCH(req, ctx as any)

        // Assert
        expect(res.status).toBe(404)
    })
})

describe('DELETE /api/blog-categories/[id] [TC-F17.020]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deletes category and cascades unset on posts (TC-F17-05-06)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: 'tenant-1' })
        mockFind.mockResolvedValue({ docs: [{ id: 'blog-1' }, { id: 'blog-2' }] })
        mockUpdate.mockResolvedValue({})

        // Act
        const res = await DELETE(new Request('http://localhost'), ctx as any)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.deleted).toBe('cat-1')
        expect(body.data.affectedPosts).toBe(2)
        // Cascade: unset category on 2 blogs
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blogs', id: 'blog-1', data: { category: null } }))
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blogs', id: 'blog-2', data: { category: null } }))
        // Soft delete the category itself
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blog_categories', data: { status: 'deleted' } }))
    })

    it('returns 403 for IDOR attempt [TC-F19.38]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'cat-1', tenant: 'other-tenant' })

        // Act
        const res = await DELETE(new Request('http://localhost'), ctx as any)

        // Assert
        expect(res.status).toBe(403)
    })

    it('returns 404 when category not found', async () => {
        // Arrange
        mockFindByID.mockRejectedValue(new Error('not found'))

        // Act
        const res = await DELETE(new Request('http://localhost'), ctx as any)

        // Assert
        expect(res.status).toBe(404)
    })
})
