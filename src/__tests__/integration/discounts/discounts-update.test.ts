/**
 * Integration tests for PUT /api/v1/discounts/[id] (BR-08, TC-F33-02-03).
 *
 * Verifies that usageCount and tenant are stripped from PUT request bodies
 * (client-writable fields defence-in-depth) and that the route forwards only
 * safe fields to payload.update.
 *
 * TC-AICP-349 — PUT and DELETE have the same role gate as create: the Orders permission on an ACTIVE membership
 * of the dashboard's workspace; anything else is 403 FORBIDDEN and nothing is read or written. A platform
 * super-admin keeps Payload's own access rules.
 * TC-AICP-350 — a viewer can not change or delete a discount (read only).
 *
 * Mock strategy: mirrors discounts-api.test.ts — getPayload + withAuth mocked
 * at top-level; parseRequest, the gate (discount-write-access + area-access) and the discount service are real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

const mockUser: { id: string; email: string; tenants: unknown[]; roles?: string[] } = {
    id: 'user-123',
    email: 'owner@example.com',
    tenants: [{ tenant: { id: 'tenant-abc' }, role: 'owner', status: 'active' }],
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

import { DELETE, PUT } from '@/app/api/v1/discounts/[id]/route'
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

// ── TC-AICP-349 / TC-AICP-350: PUT / DELETE role gate (same as create) ─────────────────────────────
describe('PUT / DELETE /api/v1/discounts/[id] — TC-AICP-349: role gate', () => {
    const original = mockUser.tenants
    const ctx = { params: Promise.resolve({ id: 'disc-1' }) }
    const put = () =>
        PUT(new NextRequest('http://localhost/api/v1/discounts/disc-1', {
            method: 'PUT',
            body: JSON.stringify({ value: 15 }),
            headers: { 'Content-Type': 'application/json' },
        }) as any, ctx)
    const del = () => DELETE(new NextRequest('http://localhost/api/v1/discounts/disc-1', { method: 'DELETE' }) as any, ctx)
    let mockFindByID: ReturnType<typeof vi.fn>
    let mockUpdate: ReturnType<typeof vi.fn>
    let mockDelete: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn().mockResolvedValue({ id: 'disc-1', code: 'OLD', tenant: 'tenant-abc', updatedAt: '2026-10-01T00:00:00.000Z' })
        mockUpdate = vi.fn().mockResolvedValue({ id: 'disc-1', value: 15 })
        mockDelete = vi.fn().mockResolvedValue({ id: 'disc-1' })
        mockGetPayload.mockResolvedValue({ findByID: mockFindByID, update: mockUpdate, delete: mockDelete } as any)
    })
    afterEach(() => {
        mockUser.tenants = original
        delete mockUser.roles
    })

    it.each([
        ['a custom role without Orders', { tenant: { id: 'tenant-abc' }, role: 'custom', status: 'active', permissions: ['products'] }],
        ['a pending owner', { tenant: { id: 'tenant-abc' }, role: 'owner', status: 'pending' }],
        ['a suspended admin', { tenant: { id: 'tenant-abc' }, role: 'admin', status: 'suspended' }],
    ])('[TC-AICP-349] refuses %s on PUT and DELETE and touches nothing', async (_label, membership) => {
        // Arrange
        mockUser.tenants = [membership]

        // Act
        const [putRes, delRes] = [await put(), await del()]

        // Assert
        expect(putRes.status).toBe(403)
        expect((await putRes.json()).error.code).toBe('FORBIDDEN')
        expect(delRes.status).toBe(403)
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('[TC-AICP-349] refuses a user without any workspace', async () => {
        // Arrange
        mockUser.tenants = []

        // Act
        const res = await put()

        // Assert
        expect(res.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it.each([
        ['an owner', { tenant: { id: 'tenant-abc' }, role: 'owner', status: 'active' }],
        ['an editor', { tenant: { id: 'tenant-abc' }, role: 'editor', status: 'active' }],
        ['a custom role holding Orders', { tenant: { id: 'tenant-abc' }, role: 'custom', status: 'active', permissions: ['orders'] }],
    ])('[TC-AICP-349] lets %s change and delete a code', async (_label, membership) => {
        // Arrange
        mockUser.tenants = [membership]

        // Act
        const [putRes, delRes] = [await put(), await del()]

        // Assert
        expect(putRes.status).toBe(200)
        expect(delRes.status).toBe(204)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
        expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('[TC-AICP-349] a platform super-admin keeps Payload access (no membership needed)', async () => {
        // Arrange
        mockUser.tenants = []
        mockUser.roles = ['super-admin']

        // Act
        const res = await put()

        // Assert
        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('[TC-AICP-350] a viewer can not change or delete a discount', async () => {
        // Arrange
        mockUser.tenants = [{ tenant: { id: 'tenant-abc' }, role: 'viewer', status: 'active' }]

        // Act
        const [putRes, delRes] = [await put(), await del()]

        // Assert
        expect(putRes.status).toBe(403)
        expect((await putRes.json()).error.message).toBe('Viewers cannot change discounts')
        expect(delRes.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockDelete).not.toHaveBeenCalled()
    })
})
