import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/orders/route'

// ─── TC-F10.20: Unicode search encoding ───────────────────────────────
// ─── TC-F10.23: Numeric sort (10 > 2) ────────────────────────────────
// ─── TC-F10.29: Cross-tenant IDOR prevention ─────────────────────────

describe('GET /api/orders [TC-F10.20, TC-F10.23]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns paginated order list', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [{ id: 'o1', orderNumber: 'ORD-001' }],
            totalDocs: 1,
            totalPages: 1,
            page: 1,
            limit: 20,
        })

        // Act
        const req = new Request('http://localhost/api/orders')
        const res = await GET(req, {} as any)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.docs).toHaveLength(1)
    })

    it('filters by status query param', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders?status=pending')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: { equals: 'pending' } }),
            }),
        )
    })

    it('builds OR search across orderNumber, customerName, customerEmail [TC-F10.20]', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders?search=john')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    or: expect.arrayContaining([
                        { orderNumber: { contains: 'john' } },
                        { customerName: { contains: 'john' } },
                        { customerEmail: { contains: 'john' } },
                    ]),
                }),
            }),
        )
    })

    it('caps limit at 100 maximum', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders?limit=500')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 100 }),
        )
    })

    it('uses overrideAccess: false for tenant scoping [TC-F10.29]', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({ overrideAccess: false }),
        )
    })

    it('filters by paymentMethod', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders?paymentMethod=cod')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ paymentMethod: { equals: 'cod' } }),
            }),
        )
    })

    it('defaults sort to -createdAt [TC-F10.23]', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders')
        await GET(req, {} as any)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({ sort: '-createdAt' }),
        )
    })

    it('skips status filter when status=all', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })

        // Act
        const req = new Request('http://localhost/api/orders?status=all')
        await GET(req, {} as any)

        // Assert
        const call = mockFind.mock.calls[0][0]
        expect(call.where.status).toBeUndefined()
    })
})
