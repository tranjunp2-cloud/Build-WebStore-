/**
 * Integration tests for storefront discount preview API
 * (src/app/api/storefront/discounts/apply/route.ts).
 *
 * Mocks getPayload; tests advisory discount preview, case-insensitive matching,
 * silent rejection, always HTTP 200.
 *
 * TC-F33-20..23: success shape, failure silent reject, always 200, case-insensitive
 *
 * TC-F33-30..34 deferred — order-create integration tests (usage history, idempotency) live
 * with the Phase 4 order route tests once those routes are implemented.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() + 60000 }),
}))

import { POST } from '@/app/api/storefront/discounts/apply/route'
import { getPayload } from 'payload'
import { checkRateLimit } from '@/lib/rateLimit'
import { isTenantUnavailable } from '@/lib/storefront/store-availability'
// #2179: store availability has its own tests (store-unavailable.test.ts); here a store is unavailable only when suspended.
vi.mock('@/lib/storefront/store-availability', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/storefront/store-availability')>()),
    isTenantUnavailable: vi.fn(async (_payload: unknown, tenant: { status?: unknown } | null) => tenant?.status === 'suspended'),
    isTenantIdUnavailable: vi.fn(async () => false),
}))

const mockGetPayload = vi.mocked(getPayload)
const mockCheckRateLimit = vi.mocked(checkRateLimit)

// ── TC-F33-20: Success response shape ──────────────────────────────────────
describe('POST /api/storefront/discounts/apply — TC-F33-20: Success response', () => {
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            find: mockFind,
        } as any)
    })

    it('returns 200 with full discount object on success', async () => {
        // Arrange
        const mockTenantResult = {
            docs: [{ id: 'tenant-1', slug: 'mysite' }],
        }

        const mockDiscount = {
            id: 'disc-1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        const mockDiscountResult = {
            docs: [mockDiscount],
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce(mockDiscountResult)

        const requestBody = {
            siteSlug: 'mysite',
            code: 'SUMMER20',
            subtotalSen: 100000,
        }

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(true)
        expect(data.discountSen).toBe(20000)
        expect(data.discount).toEqual({
            id: 'disc-1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
        })
    })

    it('[TC-F09.283] unavailable store: silent ok:false, discount never looked up', async () => {
        // Arrange
        mockFind.mockResolvedValueOnce({ docs: [{ id: 'tenant-1', slug: 'mysite', status: 'active' }] })
        vi.mocked(isTenantUnavailable).mockResolvedValueOnce(true)

        // Act
        const response = await POST(new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({ siteSlug: 'mysite', code: 'SUMMER20', subtotalSen: 100000 }),
            headers: { 'Content-Type': 'application/json' },
        }))

        // Assert
        expect(await response.json()).toEqual({ ok: false })
        expect(mockFind).toHaveBeenCalledTimes(1)
    })

    it('returns discount object with id, code, type, value only', async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-fixed',
            code: 'FLAT50',
            type: 'fixed',
            value: 5000,
            status: 'active',
            usageLimit: 100,
            usageCount: 50,
            startsAt: '2026-06-01T00:00:00Z',
            expiresAt: '2026-12-31T23:59:59Z',
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'FLAT50',
                subtotalSen: 50000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(true)
        expect(data.discount).toHaveProperty('id', 'disc-fixed')
        expect(data.discount).toHaveProperty('code', 'FLAT50')
        expect(data.discount).toHaveProperty('type', 'fixed')
        expect(data.discount).toHaveProperty('value', 5000)
        expect(data.discount).not.toHaveProperty('usageLimit')
        expect(data.discount).not.toHaveProperty('usageCount')
        expect(data.discount).not.toHaveProperty('status')
    })
})

// ── TC-F33-21: Failure response — coarse reason only ─────────────────────────
// Reject reveals only 'at-limit' (exhausted) vs 'unavailable' (everything else collapsed:
// inactive/expired/not-found/wrong-tenant/not-started) so real-vs-fake codes can't be enumerated.
describe('POST /api/storefront/discounts/apply — TC-F33-21: Failure coarse reason', () => {
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            find: mockFind,
        } as any)
    })

    it("returns 200 with ok:false + reason 'unavailable' for nonexistent code", async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscountResult = { docs: [] }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce(mockDiscountResult)

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'BADCODE',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
        expect(data.reason).toBe('unavailable') // collapsed — indistinguishable from a real-but-unavailable code
        expect(data).not.toHaveProperty('discountSen')
        expect(data).not.toHaveProperty('discount')
    })

    it("returns 200 with ok:false + reason 'unavailable' for expired code", async () => {
        // Arrange
        const pastDate = new Date(Date.now() - 86400000).toISOString()
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'EXPIRED',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: pastDate,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'EXPIRED',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
        expect(data.reason).toBe('unavailable')
    })

    it("returns 200 with ok:false + reason 'unavailable' for inactive discount", async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'INACTIVE',
            type: 'percentage',
            value: 10,
            status: 'inactive',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'INACTIVE',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
        expect(data.reason).toBe('unavailable')
    })

    it("returns 200 with ok:false + reason 'at-limit' for usage limit reached", async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'USED_UP',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: 5,
            usageCount: 5,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'USED_UP',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
        expect(data.reason).toBe('at-limit') // the ONE distinct reason — exhausted voucher
    })

    it("returns 200 with ok:false + reason 'unavailable' for wrong tenant", async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'WRONGTEN',
            type: 'percentage',
            value: 10,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-2',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'WRONGTEN',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
        expect(data.reason).toBe('unavailable') // wrong-tenant collapsed with not-found → no enumeration
    })

    it('returns 200 with ok:false for nonexistent site (no leak)', async () => {
        // Arrange
        const mockTenantResult = { docs: [] }

        mockFind.mockResolvedValueOnce(mockTenantResult)

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'nonexistent',
                code: 'CODE',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(false)
    })
})

// ── TC-F33-22: Always HTTP 200 (except rate-limit and parse error) ──────────
describe('POST /api/storefront/discounts/apply — TC-F33-22: HTTP status handling', () => {
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            find: mockFind,
        } as any)
    })

    it('returns 400 for invalid JSON', async () => {
        // Arrange
        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: 'not json',
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)

        // Assert
        expect(response.status).toBe(400)
    })

    it('returns 400 for missing required fields', async () => {
        // Arrange
        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                code: 'CODE',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)

        // Assert
        expect(response.status).toBe(400)
    })

    it('returns 400 for invalid subtotalSen (negative)', async () => {
        // Arrange
        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'CODE',
                subtotalSen: -1000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)

        // Assert
        expect(response.status).toBe(400)
    })

    it('returns 429 with Retry-After when rate limited', async () => {
        // Arrange — override top-level mock for this test only
        const resetAt = Date.now() + 30000
        mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, resetAt })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'CODE',
                subtotalSen: 10000,
            }),
            headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(429)
        expect(data.ok).toBe(false)
        expect(response.headers.get('Retry-After')).toBeTruthy()
    })
})

// ── TC-F33-23: Code matching case-insensitive ──────────────────────────────
describe('POST /api/storefront/discounts/apply — TC-F33-23: Case-insensitive code', () => {
    let mockFind: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn()
        mockGetPayload.mockResolvedValue({
            find: mockFind,
        } as any)
    })

    it('matches code case-insensitively (lowercase request)', async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'summer20',
                subtotalSen: 100000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(true)
        expect(data.discount.code).toBe('SUMMER20')

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    and: expect.arrayContaining([
                        expect.objectContaining({
                            code: { equals: 'SUMMER20' },
                        }),
                    ]),
                }),
            }),
        )
    })

    it('matches code case-insensitively (mixed case request)', async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: 'SuMmEr20',
                subtotalSen: 100000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(true)
    })

    it('trims code whitespace before uppercasing', async () => {
        // Arrange
        const mockTenantResult = { docs: [{ id: 'tenant-1' }] }
        const mockDiscount = {
            id: 'disc-1',
            code: 'SUMMER20',
            type: 'percentage',
            value: 20,
            status: 'active',
            usageLimit: null,
            usageCount: 0,
            startsAt: null,
            expiresAt: null,
            tenant: 'tenant-1',
        }

        mockFind
            .mockResolvedValueOnce(mockTenantResult)
            .mockResolvedValueOnce({ docs: [mockDiscount] })

        const req = new NextRequest('http://localhost/api/storefront/discounts/apply', {
            method: 'POST',
            body: JSON.stringify({
                siteSlug: 'shop',
                code: '  summer20  ',
                subtotalSen: 100000,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        // Act
        const response = await POST(req)
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.ok).toBe(true)

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    and: expect.arrayContaining([
                        expect.objectContaining({
                            code: { equals: 'SUMMER20' },
                        }),
                    ]),
                }),
            }),
        )
    })
})
