/**
 * Integration tests for discount admin API (src/app/api/v1/discounts/route.ts).
 * Mocks getPayload + withAuth; tests tenant forcing, usageCount strip, duplicate handling.
 *
 * TC-F33-10, TC-F33-11, TC-F33-12: create (tenant forced, usageCount=0), list (tenant-scoped), duplicate rejection
 *
 * TC-F33-30..34 deferred — order-create integration tests (usage history, idempotency) live
 * with the Phase 4 order route tests once those routes are implemented.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

const mockUser = {
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

import { POST as createDiscount, GET as listDiscounts } from '@/app/api/v1/discounts/route'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── TC-AICP-260: Create needs the Orders permission (the sidebar permission of Discounts) ─────────────
describe('POST /api/v1/discounts — TC-AICP-260: role check', () => {
    const post = () =>
        createDiscount(new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify({ code: 'ROLE10', type: 'percentage', value: 10 }),
            headers: { 'Content-Type': 'application/json' },
        }))
    const original = mockUser.tenants
    let mockCreate: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockCreate = vi.fn().mockResolvedValue({ id: 'disc-9', tenant: 'tenant-abc', code: 'ROLE10', usageCount: 0 })
        mockGetPayload.mockResolvedValue({ create: mockCreate } as any)
    })
    afterEach(() => {
        mockUser.tenants = original
    })

    it('refuses a custom role without Orders (e.g. products only) and writes nothing', async () => {
        mockUser.tenants = [{ tenant: { id: 'tenant-abc' }, role: 'custom', status: 'active', permissions: ['products'] }] as never

        const res = await post()

        expect(res.status).toBe(403)
        expect((await res.json()).error.code).toBe('FORBIDDEN')
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('lets the owner, an editor and a custom role holding Orders create a code', async () => {
        for (const member of [
            { tenant: { id: 'tenant-abc' }, role: 'owner', status: 'active' },
            { tenant: { id: 'tenant-abc' }, role: 'editor', status: 'active' },
            { tenant: { id: 'tenant-abc' }, role: 'custom', status: 'active', permissions: ['orders'] },
        ]) {
            mockUser.tenants = [member] as never
            expect((await post()).status).toBe(201)
        }
        expect(mockCreate).toHaveBeenCalledTimes(3)
    })
})

// ── TC-F33-10: Create discount forces tenant + zeros usage ──────────────────
describe('POST /api/v1/discounts — TC-F33-10: Create discount', () => {
    let mockCreate: any
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockCreate = vi.fn()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            create: mockCreate,
            find: mockFind,
        } as any)
    })

    it('forces tenant from authenticated user and sets usageCount=0', async () => {
        // Arrange
        const requestBody = {
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            description: 'Summer sale',
        }

        const createdDiscount = {
            id: 'disc-1',
            tenant: 'tenant-abc',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            usageCount: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
        }

        mockCreate.mockResolvedValueOnce(createdDiscount)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.tenant).toBe('tenant-abc')
        expect(data.data.usageCount).toBe(0)

        // Verify create was called with tenant forced and usageCount=0.
        // overrideAccess: true — tenant comes from the authenticated user, so auth is already enforced
        // by withAuth + extractTenantId; false would trip Payload's tenants read-check and reject valid IDs.
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'discounts',
                data: expect.objectContaining({
                    code: 'SUMMER20',
                    type: 'percentage',
                    value: 20,
                    tenant: 'tenant-abc',
                    usageCount: 0,
                }),
                overrideAccess: true,
            }),
        )
    })

    it('ignores client-sent tenant param', async () => {
        // Arrange
        const requestBody = {
            code: 'ATTACK',
            type: 'percentage',
            value: 10,
            tenant: 'hacker-tenant',
        }

        const createdDiscount = {
            id: 'disc-2',
            tenant: 'tenant-abc',
            code: 'ATTACK',
            type: 'percentage',
            value: 10,
            usageCount: 0,
            status: 'active',
        }

        mockCreate.mockResolvedValueOnce(createdDiscount)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(data.data.tenant).toBe('tenant-abc')
    })

    it('ignores client-sent usageCount param', async () => {
        // Arrange
        const requestBody = {
            code: 'FAKE_USED',
            type: 'percentage',
            value: 15,
            usageCount: 100,
        }

        const createdDiscount = {
            id: 'disc-3',
            tenant: 'tenant-abc',
            code: 'FAKE_USED',
            type: 'percentage',
            value: 15,
            usageCount: 0,
            status: 'active',
        }

        mockCreate.mockResolvedValueOnce(createdDiscount)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(data.data.usageCount).toBe(0)
    })

    it('returns 409 Conflict when duplicate code per tenant', async () => {
        // Arrange
        const requestBody = {
            code: 'DUPE',
            type: 'percentage',
            value: 10,
        }

        const duplicateError = new Error('duplicate key value violates unique constraint')
        ;(duplicateError as any).code = '23505'
        mockCreate.mockRejectedValueOnce(duplicateError)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('DUPLICATE_CODE')
    })

    it('returns 400 for invalid request body', async () => {
        // Arrange
        const invalidBody = {
            code: 'GOOD',
            type: 'invalid-type',
            value: 'not-a-number',
        }

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(invalidBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)

        // Assert
        expect(response.status).toBe(400)
    })
})

// ── TC-F33-11: List discounts tenant-scoped ────────────────────────────────
describe('GET /api/v1/discounts — TC-F33-11: List discounts', () => {
    let mockCreate: any
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockCreate = vi.fn()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            create: mockCreate,
            find: mockFind,
        } as any)
    })

    it('returns only discounts for authenticated user tenant', async () => {
        // Arrange
        const discountsTenantABC = [
            {
                id: 'disc-a1',
                code: 'CODESAM',
                tenant: 'tenant-abc',
                type: 'percentage',
                value: 10,
            },
            {
                id: 'disc-a2',
                code: 'CODEFLAT',
                tenant: 'tenant-abc',
                type: 'fixed',
                value: 5000,
            },
        ]

        mockFind.mockResolvedValueOnce({
            docs: discountsTenantABC,
            totalDocs: 2,
            limit: 20,
            totalPages: 1,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts?page=1&limit=20', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.docs).toHaveLength(2)
        expect(data.docs[0].tenant).toBe('tenant-abc')
        expect(data.docs[1].tenant).toBe('tenant-abc')

        // Auth gate: Payload must receive user + overrideAccess:false so its
        // access control enforces tenant isolation — removing either would let
        // cross-tenant data leak even if response looks correct.
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                user: mockUser,
                overrideAccess: false,
            }),
        )
    })

    it('respects status filter', async () => {
        // Arrange
        const activeDiscounts = [
            { id: 'disc-1', code: 'ACTIVE', status: 'active', tenant: 'tenant-abc' },
        ]

        mockFind.mockResolvedValueOnce({
            docs: activeDiscounts,
            totalDocs: 1,
            limit: 20,
            totalPages: 1,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts?status=active', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.docs).toHaveLength(1)
    })

    it('respects search filter', async () => {
        // Arrange
        const searchResults = [
            { id: 'disc-1', code: 'SUMMER', description: 'Summer sale', tenant: 'tenant-abc' },
        ]

        mockFind.mockResolvedValueOnce({
            docs: searchResults,
            totalDocs: 1,
            limit: 20,
            totalPages: 1,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts?search=SUMMER', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)

        // Assert
        expect(response.status).toBe(200)
    })

    it('respects sort order', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            limit: 20,
            totalPages: 0,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts?sort=code', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                sort: 'code',
            }),
        )
    })

    it('caps limit at 100', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            limit: 100,
            totalPages: 0,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts?limit=500', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                limit: 100,
            }),
        )
    })

    it('defaults to page 1 and limit 20', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({
            docs: [],
            totalDocs: 0,
            limit: 20,
            totalPages: 0,
            page: 1,
        })

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'GET',
        })

        // Act
        const response = await listDiscounts(req)

        // Assert
        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                page: 1,
                limit: 20,
            }),
        )
    })
})

// ── TC-F33-12: Duplicate code per tenant rejected ───────────────────────────
describe('POST /api/v1/discounts — TC-F33-12: Duplicate code rejection', () => {
    let mockCreate: any
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockCreate = vi.fn()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            create: mockCreate,
            find: mockFind,
        } as any)
    })

    it('[TC-F33-01-06] returns 409 for the real Payload ValidationError shape (generic message, unique only in data.errors)', async () => {
        // Arrange — shape reproduced against real Postgres: POST UAT50 then uat50
        const err = Object.assign(new Error('The following field is invalid: '), {
            name: 'ValidationError',
            data: { collection: 'discounts', errors: [{ message: 'Value must be unique', path: null, tableName: 'discounts' }] },
        })
        mockCreate.mockRejectedValueOnce(err)
        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify({ code: 'uat50', type: 'percentage', value: 10 }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(data.error.code).toBe('DUPLICATE_CODE')
        expect(data.error.message).toContain('already in use for your tenant')
    })

    it('returns 409 with DUPLICATE_CODE when code exists for tenant', async () => {
        // Arrange
        const requestBody = {
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
        }

        const err = new Error('duplicate key value violates unique constraint "discounts_tenant_id_code_key"')
        ;(err as any).code = '23505'
        mockCreate.mockRejectedValueOnce(err)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(data.error.code).toBe('DUPLICATE_CODE')
        // Message matches story US-F33-01 AC-3 ("…already in use for your tenant…")
        expect(data.error.message).toContain('already in use')
    })

    it('allows same code in different tenants (conceptually)', async () => {
        // Arrange
        const requestBody = {
            code: 'PROMO',
            type: 'percentage',
            value: 10,
        }

        const createdDiscount = {
            id: 'disc-2',
            code: 'PROMO',
            tenant: 'tenant-abc',
            type: 'percentage',
            value: 10,
            usageCount: 0,
            status: 'active',
        }

        mockCreate.mockResolvedValueOnce(createdDiscount)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(data.success).toBe(true)
    })

    it('detects duplicate via "unique" in error message', async () => {
        // Arrange
        const requestBody = {
            code: 'DUP',
            type: 'percentage',
            value: 5,
        }

        const err = new Error('unique constraint violation')
        mockCreate.mockRejectedValueOnce(err)

        const req = new NextRequest('http://localhost/api/v1/discounts', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await createDiscount(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(data.error.code).toBe('DUPLICATE_CODE')
    })
})

// ── TC-PERF-075: effective-status filter reads only the caller's workspaces; search keeps the status filter ──
describe('GET /api/v1/discounts — TC-PERF-075: scoped at-limit ids', () => {
    const list = (query: string) => listDiscounts(new NextRequest(`http://localhost/api/v1/discounts?${query}`), undefined as never)
    let find: ReturnType<typeof vi.fn>
    let execute: ReturnType<typeof vi.fn>
    const sqlText = (query: { queryChunks?: unknown[] }) => JSON.stringify(query)

    const originalTenants = mockUser.tenants
    beforeEach(() => {
        // integer tenant ids, as in the database (the at-limit query compares tenant_id)
        mockUser.tenants = [{ tenant: { id: 42 as never }, role: 'owner', status: 'active' }]
        find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, page: 1 })
        execute = vi.fn().mockResolvedValue({ rows: [{ id: 11 }] })
        mockGetPayload.mockResolvedValue({ find, db: { drizzle: { execute } } } as never)
    })
    afterEach(() => {
        mockUser.tenants = originalTenants
    })

    it('limits the at-limit id query to the caller\'s tenants', async () => {
        // Act
        await list('status=active')

        // Assert
        expect(execute).toHaveBeenCalledTimes(1)
        expect(sqlText(execute.mock.calls[0][0])).toContain('tenant_id IN (')
        expect(find.mock.calls[0][0].where).toEqual({ and: [{ status: { equals: 'active' } }, { id: { not_in: [11] } }] })
    })

    it('keeps the inactive filter when searching (the search used to overwrite it)', async () => {
        // Act
        await list('status=inactive&search=RAYA')

        // Assert
        expect(find.mock.calls[0][0].where).toEqual({
            and: [
                { or: [{ status: { equals: 'inactive' } }, { id: { in: [11] } }] },
                { or: [{ code: { contains: 'RAYA' } }, { description: { contains: 'RAYA' } }] },
            ],
        })
    })

    it('sends a weak ETag and 304s an unchanged list (TC-PERF-080)', async () => {
        // Arrange
        const first = await list('page=1')

        // Act
        const second = await listDiscounts(new NextRequest('http://localhost/api/v1/discounts?page=1', { headers: { 'if-none-match': first.headers.get('ETag')! } }), undefined as never)

        // Assert
        expect(first.headers.get('ETag')).toMatch(/^W\//)
        expect(second.status).toBe(304)
    })
})

// ── TC-PERF-136: the create reply keeps relations as ids; a foreign site is refused ──
describe('POST /api/v1/discounts — TC-PERF-136: no tenant rows, no foreign site', () => {
    let mockCreate: any
    let mockFindByID: any
    const post = (body: Record<string, unknown>) => createDiscount(new NextRequest('http://localhost/api/v1/discounts', {
        method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    }))

    beforeEach(() => {
        vi.clearAllMocks()
        mockCreate = vi.fn().mockResolvedValue({ id: 'disc-1', tenant: 'tenant-abc', code: 'SAVE5' })
        mockFindByID = vi.fn()
        mockGetPayload.mockResolvedValue({ create: mockCreate, find: vi.fn(), findByID: mockFindByID } as any)
    })

    it('creates at depth 0, so the reply never carries the tenant row (payment secrets)', async () => {
        // Act
        const res = await post({ code: 'SAVE5', type: 'fixed', value: 5 })

        // Assert
        expect(res.status).toBe(201)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ depth: 0 }))
    })

    it('refuses a site of another tenant without creating anything', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 9, tenant: 'tenant-other' })

        // Act
        const res = await post({ code: 'SAVE5', type: 'fixed', value: 5, site: 9 })

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('accepts a site of the caller\'s tenant', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 3, tenant: { id: 'tenant-abc' } })

        // Act
        const res = await post({ code: 'SAVE5', type: 'fixed', value: 5, site: 3 })

        // Assert
        expect(res.status).toBe(201)
        expect(mockCreate).toHaveBeenCalledTimes(1)
    })
})
