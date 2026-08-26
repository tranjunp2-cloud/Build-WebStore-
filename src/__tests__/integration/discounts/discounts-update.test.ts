/**
 * Integration tests for PUT /api/v1/discounts/[id] (BR-08, TC-F33-02-03).
 *
 * Verifies that usageCount and tenant are stripped from PUT request bodies
 * (client-writable fields defence-in-depth) and that the route forwards only
 * safe fields to payload.update.
 *
 * Mock strategy: mirrors discounts-api.test.ts — getPayload + withAuth mocked
 * at top-level; parseRequest is real (via the actual validation schema).
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
    extractTenantId: vi.fn((user: any) => {
        if (user?.tenants?.[0]?.tenant?.id) {
            return user.tenants[0].tenant.id
        }
        return null
    }),
}))

import { PUT } from '@/app/api/v1/discounts/[id]/route'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── TC-F33-02-03: PUT update strips usageCount and tenant ─────────────────
describe('PUT /api/v1/discounts/[id] — TC-F33-02-03: Protected field stripping', () => {
    let mockFindByID: ReturnType<typeof vi.fn>
    let mockUpdate: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockUpdate = vi.fn()
        mockGetPayload.mockResolvedValue({
            findByID: mockFindByID,
            update: mockUpdate,
        } as any)
    })

    it('[TC-F33-02-03] strips usageCount and tenant from PUT body before payload.update', async () => {
        // Arrange
        const existingDiscount = {
            id: 'disc-1',
            code: 'OLD',
            type: 'percentage',
            value: 10,
            usageCount: 5,
            tenant: 'tenant-abc',
            status: 'active',
        }
        const updatedDiscount = {
            id: 'disc-1',
            code: 'NEWSUMMER',
            type: 'percentage',
            value: 20,
            usageCount: 5,
            tenant: 'tenant-abc',
            status: 'active',
        }

        mockFindByID.mockResolvedValueOnce(existingDiscount)
        mockUpdate.mockResolvedValueOnce(updatedDiscount)

        // Body includes usageCount and tenant — both must be stripped before reaching payload.update
        const requestBody = {
            code: 'NEWSUMMER',
            type: 'percentage',
            value: 20,
            usageCount: 9999,
            tenant: 'other-tenant',
        }

        const req = new NextRequest('http://localhost/api/v1/discounts/disc-1', {
            method: 'PUT',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        const ctx = { params: Promise.resolve({ id: 'disc-1' }) }

        // Act
        const response = await PUT(req as any, ctx)
        const data = await response.json()

        // Assert — 200 OK with updated record
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)

        // payload.update must NOT receive usageCount or tenant in its data
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'discounts',
                id: 'disc-1',
                data: expect.not.objectContaining({ usageCount: expect.anything() }),
            }),
        )
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.not.objectContaining({ tenant: expect.anything() }),
            }),
        )

        // The safe code field IS forwarded
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ code: 'NEWSUMMER' }),
            }),
        )
    })

    it('[TC-F33-02-03b] strips usageCount=0 too (cannot reset counter via PUT)', async () => {
        // Arrange — attacker tries to reset usageCount to 0 after consuming the discount
        const existingDiscount = {
            id: 'disc-2',
            code: 'PROMO',
            type: 'fixed',
            value: 500,
            usageCount: 42,
            tenant: 'tenant-abc',
        }
        const updatedDiscount = { ...existingDiscount, value: 600 }

        mockFindByID.mockResolvedValueOnce(existingDiscount)
        mockUpdate.mockResolvedValueOnce(updatedDiscount)

        const requestBody = { value: 600, usageCount: 0 }

        const req = new NextRequest('http://localhost/api/v1/discounts/disc-2', {
            method: 'PUT',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })
        const ctx = { params: Promise.resolve({ id: 'disc-2' }) }

        // Act
        const response = await PUT(req as any, ctx)
        const responseData = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(responseData.success).toBe(true)

        // usageCount stripped even when value is 0
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.not.objectContaining({ usageCount: expect.anything() }),
            }),
        )
    })

    it('[TC-F33-02-03c] returns 404 when discount not found', async () => {
        // Arrange — findByID returns null (no access or doesn't exist)
        mockFindByID.mockResolvedValueOnce(null)

        const req = new NextRequest('http://localhost/api/v1/discounts/nonexistent', {
            method: 'PUT',
            body: JSON.stringify({ code: 'X', type: 'percentage', value: 10 }),
            headers: { 'Content-Type': 'application/json' },
        })
        const ctx = { params: Promise.resolve({ id: 'nonexistent' }) }

        // Act
        const response = await PUT(req as any, ctx)
        const responseData = await response.json()

        // Assert
        expect(response.status).toBe(404)
        expect(responseData.error.code).toBe('NOT_FOUND')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('[TC-F33-02-03d] returns 409 DUPLICATE_CODE on unique constraint violation', async () => {
        // Arrange — updating code to one that already exists for the tenant
        const existingDiscount = {
            id: 'disc-3',
            code: 'OLD',
            type: 'percentage',
            value: 10,
            tenant: 'tenant-abc',
        }
        mockFindByID.mockResolvedValueOnce(existingDiscount)

        const duplicateError = new Error('duplicate key value violates unique constraint')
        ;(duplicateError as any).code = '23505'
        mockUpdate.mockRejectedValueOnce(duplicateError)

        const req = new NextRequest('http://localhost/api/v1/discounts/disc-3', {
            method: 'PUT',
            body: JSON.stringify({ code: 'DUPE', type: 'percentage', value: 10 }),
            headers: { 'Content-Type': 'application/json' },
        })
        const ctx = { params: Promise.resolve({ id: 'disc-3' }) }

        // Act
        const response = await PUT(req as any, ctx)
        const responseData = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(responseData.error.code).toBe('DUPLICATE_CODE')
    })

    it('[TC-F33-02-03e] returns 409 DUPLICATE_CODE on "unique" constraint message', async () => {
        // Arrange — error without PG code but with "unique" in message
        const existingDiscount = {
            id: 'disc-4',
            code: 'OLD',
            type: 'percentage',
            value: 10,
            tenant: 'tenant-abc',
        }
        mockFindByID.mockResolvedValueOnce(existingDiscount)

        const uniqueError = new Error('unique constraint violation on discounts')
        mockUpdate.mockRejectedValueOnce(uniqueError)

        const req = new NextRequest('http://localhost/api/v1/discounts/disc-4', {
            method: 'PUT',
            body: JSON.stringify({ code: 'TAKEN', type: 'percentage', value: 5 }),
            headers: { 'Content-Type': 'application/json' },
        })
        const ctx = { params: Promise.resolve({ id: 'disc-4' }) }

        // Act
        const response = await PUT(req as any, ctx)
        const responseData = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(responseData.error.code).toBe('DUPLICATE_CODE')
    })
})
