import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

import { GET } from '@/app/api/v1/discounts/[id]/route'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

describe('GET /api/v1/discounts/[id] — GH-1572 missing id returns 404', () => {
    let mockFindByID: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockGetPayload.mockResolvedValue({
            findByID: mockFindByID,
        } as any)
    })

    it('[TC-GH1572-01] returns 404 when discount id does not exist', async () => {
        // Arrange
        mockFindByID.mockResolvedValueOnce(null)
        const req = new NextRequest('http://localhost/api/v1/discounts/999999')
        const ctx = { params: Promise.resolve({ id: '999999' }) }

        // Act
        const response = await GET(req as any, ctx as any)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(404)
        expect(data).toEqual({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Discount not found' },
        })
        expect(mockFindByID).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'discounts',
                id: '999999',
                disableErrors: true,
            }),
        )
    })

    it('[TC-GH1572-02] returns 200 when discount exists', async () => {
        // Arrange
        const discount = {
            id: 'disc-1',
            code: 'SUMMER10',
            type: 'percentage',
            value: 10,
        }
        mockFindByID.mockResolvedValueOnce(discount)
        const req = new NextRequest('http://localhost/api/v1/discounts/disc-1')
        const ctx = { params: Promise.resolve({ id: 'disc-1' }) }

        // Act
        const response = await GET(req as any, ctx as any)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data).toEqual({ success: true, data: discount })
    })
})
