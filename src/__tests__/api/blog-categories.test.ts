import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind, create: mockCreate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET, POST } from '@/app/api/blog-categories/route'

// ─── TC-F17: Blog categories API ─────────────────────────────────────

describe('GET /api/blog-categories [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns all categories (hard-delete means no soft-deleted in DB)', async () => {
        mockFind.mockResolvedValue({
            docs: [
                { id: 1, name: 'Tech', status: 'active' },
                { id: 2, name: 'News', status: 'active' },
            ],
        })

        const req = new Request('http://localhost')
        const res = await GET(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toHaveLength(2)
        expect(body.data[0].name).toBe('Tech')
    })
})

describe('POST /api/blog-categories [TC-F17]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates category with valid name', async () => {
        mockFind.mockResolvedValue({ docs: [] }) // no duplicate
        mockCreate.mockResolvedValue({ id: 1, name: 'New Category', slug: 'new-category' })

        const req = { json: () => Promise.resolve({ name: 'New Category' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.name).toBe('New Category')
    })

    it('returns 409 for duplicate slug', async () => {
        mockFind.mockResolvedValue({ docs: [{ id: 1 }] }) // existing slug

        const req = { json: () => Promise.resolve({ name: 'Existing' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.code).toBe('DUPLICATE_SLUG')
    })

    it('rejects empty name', async () => {
        const req = { json: () => Promise.resolve({ name: '' }) } as unknown as Request
        const res = await POST(req, {} as any)

        expect(res.status).toBe(400)
    })
})
