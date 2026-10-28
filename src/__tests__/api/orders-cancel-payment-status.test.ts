/**
 * TC-AICP-263 — cancelling an order that was not paid (lib/orders/cancel-order.ts, the plain cancel path used by
 * POST /api/orders/[id]/cancel and the copilot) moves the payment status to `cancelled` too, as the Orders
 * `update-payment-status` hook does for a Payload update (this path writes by SQL and bypassed it): a bank
 * transfer cancelled while its proof was "pending verification" no longer reads "Payment proof to check".
 * A paid manual order keeps `paid` (the merchant pays the buyer back by hand).
 * Real: the route, the cancel service, drizzle's SQL rendering. Faked: auth, Payload, mail, Stripe / Xendit, plan.
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
const mockFindByID = vi.fn()
const mockDrizzleExecute = vi.fn()
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

vi.mock('@/lib/auth', () => ({ withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)) }))
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: vi.fn(), sendEmail: vi.fn().mockResolvedValue(undefined), db: { drizzle: { execute: mockDrizzleExecute } }, logger: mockLogger })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/email/templates/order-cancelled', () => ({ orderCancelledEmail: vi.fn(() => ({ subject: 'Order cancelled', html: '<p>cancelled</p>' })) }))
vi.mock('@/lib/email/templates/order-refunded', () => ({ orderRefundedEmail: vi.fn(() => ({ subject: 'Order refunded', html: '<p>refunded</p>' })) }))
vi.mock('@/lib/payment/stripe', () => ({ getStripeClient: vi.fn() }))
vi.mock('@/lib/payment/xendit', () => ({ createRefund: vi.fn() }))
vi.mock('@/app/api/orders/lib/stock-utils', () => ({ restockItem: vi.fn(async () => ({ productId: 'p', restocked: 1 })) }))
vi.mock('@/lib/discounts/release-discount-redemption', () => ({ releaseDiscountRedemption: vi.fn() }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ plan: 'PROFESSIONAL_TM_USER' }),
    canUse: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({ withFeatureGuard: vi.fn(() => (h: any) => h) }))

import { POST } from '@/app/api/orders/[id]/cancel/route'

const ctx = { params: Promise.resolve({ id: 'order-1' }) }
const req = { json: () => Promise.resolve({ reason: 'Buyer never paid' }) } as unknown as Request
const dialect = new PgDialect()
const casSql = () => dialect.sqlToQuery(mockDrizzleExecute.mock.calls[0][0]).sql

beforeEach(() => {
    vi.clearAllMocks()
    mockFindByID.mockReset()
    mockDrizzleExecute.mockReset().mockResolvedValue({ rows: [{ id: 1 }] })
})

describe('cancelling an order nothing was paid for [TC-AICP-263]', () => {
    it.each([['pending_verification'], ['unpaid'], ['awaiting_payment']])('moves payment status %s to cancelled, in the same atomic write and in the answer', async (paymentStatus) => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'pending', paymentMethod: 'bank_transfer', paymentStatus, items: [] })

        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'cancelled', cancelReason: 'Buyer never paid' })
        const text = casSql()
        expect(text).toContain("payment_status = CASE WHEN payment_status IN ('unpaid', 'awaiting_payment', 'pending_verification') THEN 'cancelled'::enum_orders_payment_status ELSE payment_status END")
        expect(text).toContain("SET status = 'cancelled'")
    })

    it('keeps a paid bank-transfer order paid (the merchant refunds it by hand), in the answer too', async () => {
        mockFindByID.mockResolvedValue({ id: 'order-1', status: 'confirmed', paymentMethod: 'bank_transfer', paymentStatus: 'paid', items: [] })

        const res = await POST(req, ctx as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.paymentStatus).toBe('paid')
        // the CASE only rewrites the unpaid states, so a paid row is written back as it is
        expect(casSql()).toContain('ELSE payment_status END')
    })
})
