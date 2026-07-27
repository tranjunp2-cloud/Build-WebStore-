import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUser = { id: 11, email: 'owner@example.com', tenants: [{ tenant: 68 }] }
const mockFind = vi.fn()

vi.mock('@/lib/auth', () => ({
    tenantIdForQuery: vi.fn(() => 68),
    withAuth: vi.fn((handler: (user: typeof mockUser, request: Request) => Promise<Response>) =>
        async (request: Request) => handler(mockUser, request)),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/dashboard/products/route'

describe('GET /api/dashboard/products [TC-GH1432-PERF-03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: [{ id: 1, name: 'Product A' }] })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns the canonical Products Dashboard result without pagination', async () => {
        // Arrange
        const request = new Request('http://localhost/api/dashboard/products')

        // Act
        const response = await GET(request, {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(body).toEqual({ success: true, data: [{ id: 1, name: 'Product A' }] })
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            user: mockUser,
            overrideAccess: false,
            pagination: false,
            limit: 100,
            depth: 1,
            sort: '-createdAt',
            where: {
                and: [
                    { deletedAt: { exists: false } },
                    { tenant: { equals: 68 } },
                ],
            },
        }))
    })

    it('returns a stable server error without exposing internal details', async () => {
        // Arrange
        const request = new Request('http://localhost/api/dashboard/products')
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mockFind.mockRejectedValue(new Error('database connection details'))

        // Act
        const response = await GET(request, {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(500)
        expect(body).toEqual({
            success: false,
            error: { code: 'SERVER_ERROR', details: 'Failed to load products' },
        })
        expect(JSON.stringify(body)).not.toContain('database connection details')
        expect(consoleError).toHaveBeenCalledWith(
            '[GET /api/dashboard/products] failed',
            { userId: 11, errorType: 'Error' },
        )
    })
})
