import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────
// Auth strategy: this file exercises the REAL withAuth wrapper and mocks payload.auth
// (integration-level — verifies withAuth→auth chaining). orders-refund.test.ts mocks
// @/lib/auth directly for handler-unit isolation. Both strategies are intentional.

const mockAuth = vi.fn()
const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockRefundsCreate = vi.fn()
const mockDrizzleExecute = vi.fn()
const mockSendEmail = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        auth: mockAuth,
        findByID: mockFindByID,
        update: mockUpdate,
        sendEmail: mockSendEmail,
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
        db: { drizzle: { execute: mockDrizzleExecute } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/payment/stripe', () => ({
    getStripeClient: vi.fn(() => ({
        refunds: { create: mockRefundsCreate },
    })),
}))

import { POST } from '@/app/api/orders/[id]/refund/route'

// ─── Test Helpers ─────────────────────────────────────────────────────

function createRequest() {
    return { headers: new Headers({ Authorization: 'Bearer testtoken' }) } as any
}

function createContext(id: string) {
    return { params: Promise.resolve({ id }) }
}

const AUTHED_USER = {
    id: 'user-1',
    email: 'merchant@test.com',
    tenants: [
        { tenant: 'tenant-1' },
        { tenant: { id: 'tenant-2' } },
    ],
}

const PAID_ORDER = {
    id: 'order-123',
    orderNumber: 'ORD-123ABC',
    tenant: {
        id: 'tenant-1',
        stripeAccountId: 'acct_test_stripe',
    },
    status: 'shipped', // refund gate now requires shipped or completed
    stripePaymentIntentId: 'pi_test_intent_123',
    stripeChargeId: 'ch_test_charge_123',
    total: 15000,
    createdAt: '2026-06-02T00:00:00Z',
}

const REFUND_RESPONSE = {
    id: 'refund_test_123',
    amount: 15000,
    payment_intent: 'pi_test_intent_123',
    status: 'succeeded',
}

// ─── TC-F13: Stripe Refund ────────────────────────────────────────────

describe('POST /api/orders/[id]/refund [TC-F13]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAuth.mockReset()
        mockFindByID.mockReset()
        mockUpdate.mockReset()
        mockRefundsCreate.mockReset()
        mockDrizzleExecute.mockReset()
        // Default: auth succeeds with AUTHED_USER
        mockAuth.mockResolvedValue({ user: AUTHED_USER })
        // Default: CAS succeeds
        mockDrizzleExecute.mockResolvedValue({ rows: [{ id: 'order-123' }] })
    })

    // ─── TC-F13.21: Full refund success ──────────────────────────────
    it('[TC-F13.21] processes full refund for paid order with correct Stripe args', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(PAID_ORDER)
        mockRefundsCreate.mockResolvedValue(REFUND_RESPONSE)

        // Act
        const req = createRequest()
        const ctx = createContext('order-123')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.refundId).toBe('refund_test_123')

        // Verify Stripe refund called with correct payment intent, account, and idempotency key
        expect(mockRefundsCreate).toHaveBeenCalledWith(
            { payment_intent: 'pi_test_intent_123' },
            { stripeAccount: 'acct_test_stripe', idempotencyKey: 'refund-order-123' },
        )
    })

    // ─── TC-F13.28: Pending order rejection ──────────────────────────
    it('[TC-F13.28] returns 400 ORDER_NOT_REFUNDABLE for pending order', async () => {
        // Arrange
        const pendingOrder = { ...PAID_ORDER, status: 'pending' }
        mockFindByID.mockResolvedValue(pendingOrder)

        // Act
        const req = createRequest()
        const ctx = createContext('order-pending')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('ORDER_NOT_REFUNDABLE')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── TC-F13.158: IDOR protection ─────────────────────────────────
    it('[TC-F13.158] returns 403 FORBIDDEN when user does not own order tenant (IDOR)', async () => {
        // Arrange — order belongs to tenant-3, user only has tenant-1 and tenant-2
        const otherTenantOrder = {
            ...PAID_ORDER,
            tenant: { id: 'tenant-3', stripeAccountId: 'acct_other' },
        }
        mockFindByID.mockResolvedValue(otherTenantOrder)

        // Act
        const req = createRequest()
        const ctx = createContext('order-other-tenant')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── Edge: No auth user ──────────────────────────────────────────
    it('returns 401 UNAUTHORIZED when user is not authenticated', async () => {
        // Arrange — auth returns no user
        mockAuth.mockResolvedValue({ user: null })

        // Act
        const req = createRequest()
        const ctx = createContext('order-123')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert — withAuth returns { error: 'Unauthorized' } on 401
        expect(res.status).toBe(401)
        expect(body.error).toBe('Unauthorized')
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    // ─── Edge: Order not found ───────────────────────────────────────
    it('returns 404 NOT_FOUND when order does not exist', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        // Act
        const req = createRequest()
        const ctx = createContext('order-nonexistent')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── Edge: No stripePaymentIntentId ──────────────────────────────
    it('[TC-F13.159] returns 400 NO_PAYMENT_INTENT when order has no Stripe payment intent', async () => {
        // Arrange
        const orderNoPaymentIntent = {
            ...PAID_ORDER,
            stripePaymentIntentId: null,
        }
        mockFindByID.mockResolvedValue(orderNoPaymentIntent)

        // Act
        const req = createRequest()
        const ctx = createContext('order-no-intent')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('NO_PAYMENT_INTENT')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── Edge: No stripeAccountId on tenant ──────────────────────────
    it('returns 400 PAYMENT_NOT_CONFIGURED when tenant has no Stripe account', async () => {
        // Arrange
        const orderNoAccount = {
            ...PAID_ORDER,
            tenant: {
                id: 'tenant-1',
                stripeAccountId: null,
            },
        }
        mockFindByID.mockResolvedValue(orderNoAccount)

        // Act
        const req = createRequest()
        const ctx = createContext('order-no-account')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('PAYMENT_NOT_CONFIGURED')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── Refund failure handling ─────────────────────────────────────
    it('returns 502 REFUND_FAILED when Stripe refund API fails', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(PAID_ORDER)
        mockRefundsCreate.mockRejectedValue(new Error('Stripe API error: Invalid request'))
        mockUpdate.mockResolvedValue({})

        // Act
        const req = createRequest()
        const ctx = createContext('order-123')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(502)
        expect(body.error.code).toBe('REFUND_FAILED')
    })

    // ─── Refunded order idempotency ──────────────────────────────────
    it('returns 400 ALREADY_REFUNDED when trying to refund already-refunded order', async () => {
        // Arrange — order already refunded
        const refundedOrder = { ...PAID_ORDER, status: 'refunded' }
        mockFindByID.mockResolvedValue(refundedOrder)

        // Act
        const req = createRequest()
        const ctx = createContext('order-already-refunded')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(400)
        expect(body.error.code).toBe('ALREADY_REFUNDED')
        expect(mockRefundsCreate).not.toHaveBeenCalled()
    })

    // ─── User with multiple tenants (correct one) ────────────────────
    it('allows refund when user owns the order tenant (multiple tenant user)', async () => {
        // Arrange — user has multiple tenants, order belongs to one of them
        mockFindByID.mockResolvedValue(PAID_ORDER)
        mockRefundsCreate.mockResolvedValue(REFUND_RESPONSE)

        // Act
        const req = createRequest()
        const ctx = createContext('order-123')
        const res = await POST(req, ctx)
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
    })

    // ─── Tenant ID resolution (expanded vs ID string) ────────────────
    it('resolves stripeAccountId from expanded tenant object', async () => {
        // Arrange — tenant field is an expanded object (depth: 1)
        const orderWithExpandedTenant = {
            id: 'order-123',
            status: 'shipped', // refund gate now requires shipped or completed
            stripePaymentIntentId: 'pi_test',
            tenant: {
                id: 'tenant-1',
                stripeAccountId: 'acct_expanded_123',
            },
        }
        mockFindByID.mockResolvedValue(orderWithExpandedTenant)
        mockRefundsCreate.mockResolvedValue(REFUND_RESPONSE)

        // Act
        const req = createRequest()
        const ctx = createContext('order-123')
        const res = await POST(req, ctx)

        // Assert
        expect(res.status).toBe(200)
        expect(mockRefundsCreate).toHaveBeenCalledWith(
            expect.any(Object),
            { stripeAccount: 'acct_expanded_123', idempotencyKey: 'refund-order-123' },
        )
    })
})
