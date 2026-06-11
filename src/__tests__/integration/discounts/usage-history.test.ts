/**
 * Integration tests for GET /api/v1/discounts/usage-history (TC-F33-31).
 *
 * Covers:
 *   - Search by code (discountCode + discount.code) or order# builds the correct or-clause
 *   - No search → where clause omitted (full tenant history)
 *   - Tenant isolation preserved via overrideAccess:false
 *
 * Mock strategy: mirrors discounts-api.test.ts — getPayload + withAuth mocked at top-level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

const mockUser = {
    id: 'user-123',
    email: 'owner@example.com',
    tenants: [{ tenant: { id: 'tenant-abc' }, role: 'owner' }],
}

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn(
        (handler: (user: unknown, req: unknown, ctx: unknown) => unknown) =>
            (req: unknown, ctx: unknown) =>
                handler(mockUser, req, ctx),
    ),
}))

import { GET } from '@/app/api/v1/discounts/usage-history/route'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── TC-F33-31: Usage history search ───────────────────────────────────────
describe('GET /api/v1/discounts/usage-history — TC-F33-31: Search by code or order#', () => {
    let mockFind: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            find: mockFind,
        } as any)
    })

    it('[TC-F33-31a] GET with ?search=SUMMER builds or-clause across discountCode + discount.code + order.orderNumber', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [
                {
                    id: 'uh-1',
                    discountCode: 'SUMMER20',
                    amountApplied: 2000,
                    usedAt: '2026-06-01T12:00:00Z',
                },
            ],
            totalDocs: 1,
            totalPages: 1,
            page: 1,
            limit: 20,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history?search=SUMMER')

        // Act
        const response = await GET(req as any)
        const data = await response.json()

        // Assert — response shape
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.docs).toHaveLength(1)

        // Assert — find() called with the 3-field or-clause (scenario #34 requirement)
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'discount_usage_history',
                where: {
                    or: [
                        { discountCode: { contains: 'SUMMER' } },
                        { 'discount.code': { contains: 'SUMMER' } },
                        { 'order.orderNumber': { contains: 'SUMMER' } },
                    ],
                },
                // Tenant isolation via overrideAccess:false (Payload enforces its own access control)
                overrideAccess: false,
            }),
        )
    })

    it('[TC-F33-31b] GET with ?search=ORD-123 matches order number field', async () => {
        // Arrange — searching by order number slug
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            totalPages: 0,
            page: 1,
            limit: 20,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history?search=ORD-123')

        // Act
        const response = await GET(req as any)

        // Assert — the where clause targets the order number field too
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    or: expect.arrayContaining([
                        { 'order.orderNumber': { contains: 'ORD-123' } },
                    ]),
                }),
            }),
        )
    })

    it('[TC-F33-31c] GET with no ?search param omits where clause entirely', async () => {
        // Arrange — no search → full tenant history without filtering
        mockFind.mockResolvedValueOnce({
            docs: [
                { id: 'uh-2', discountCode: 'FLAT100', amountApplied: 1000, usedAt: '2026-06-02T00:00:00Z' },
                { id: 'uh-3', discountCode: 'PCT10', amountApplied: 500, usedAt: '2026-06-01T00:00:00Z' },
            ],
            totalDocs: 2,
            totalPages: 1,
            page: 1,
            limit: 20,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history')

        // Act
        const response = await GET(req as any)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.docs).toHaveLength(2)

        // where must be absent (undefined → spread omits it from the find() call)
        const findCall = mockFind.mock.calls[0][0]
        expect(findCall).not.toHaveProperty('where')
    })

    it('[TC-F33-31d] GET with blank ?search= (whitespace only) omits where clause', async () => {
        // Arrange — route trims and treats empty string as no search
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            totalPages: 1,
            page: 1,
            limit: 20,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history?search=   ')

        // Act
        await GET(req as any)

        // Assert — whitespace trimmed → no where clause applied
        const findCall = mockFind.mock.calls[0][0]
        expect(findCall).not.toHaveProperty('where')
    })

    it('[TC-F33-31e] tenant isolation: find() always called with overrideAccess:false and user object', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            totalPages: 1,
            page: 1,
            limit: 20,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history')

        // Act
        await GET(req as any)

        // Assert — Payload enforces tenant isolation via access control when overrideAccess:false
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                user: mockUser,
                overrideAccess: false,
            }),
        )
    })

    it('[TC-F33-31f] respects page and limit query params', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            totalPages: 5,
            page: 3,
            limit: 10,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts/usage-history?page=3&limit=10')

        // Act
        const response = await GET(req as any)

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                page: 3,
                limit: 10,
            }),
        )
    })
})
