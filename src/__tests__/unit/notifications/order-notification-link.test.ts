/**
 * TC-F16-2296-01..03 (#2296): order notifications link to the order they are about (`/orders/<id>`),
 * not the order list, so clicking the bell or the push opens that order.
 * Real: upload-proof + upload-proof-direct routes, sendOrderPaidEmailsAndNotify, handlePaymentFailed.
 * The COD/QR create path of TC-F16-2296-01 (Orders.afterChange) is covered in notification-triggers.test.ts.
 * Faked: Payload, token checks, email sending, owner notifications; after-response tasks run inline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const notifyTenantOwners = vi.fn(async () => {})
vi.mock('@/lib/notifications/notify-tenant-owners', () => ({
    notifyTenantOwners: (...args: unknown[]) => notifyTenantOwners(...(args as [])),
}))
vi.mock('@/lib/runtime/run-after-response', () => ({
    runAfterResponse: (_label: string, task: () => Promise<void>) => task(),
}))

const find = vi.fn()
const findByID = vi.fn()
const update = vi.fn()
const create = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find, findByID, update, create, delete: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth/order-token', () => ({
    verifyOrderToken: vi.fn(async () => ({ ok: true, orderId: '41' })),
    signOrderToken: vi.fn(async () => 'token'),
}))
vi.mock('@/lib/orders/upload-token', () => ({ verifyUploadToken: vi.fn(() => true) }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => true) }))
vi.mock('@/lib/email/get-tenant-owner-emails', () => ({ getTenantOwnerEmails: vi.fn(async () => []) }))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn(async () => ({ enabled: false })) }))
vi.mock('@/app/api/webhooks/stripe/handlers/verify-account-ownership', () => ({
    verifyConnectedAccountOwnership: vi.fn(async () => true),
}))

import { POST as uploadProof } from '@/app/api/orders/[id]/upload-proof/route'
import { POST as uploadProofDirect } from '@/app/api/orders/[id]/upload-proof-direct/route'
import { sendOrderPaidEmailsAndNotify, type PaidOrderDoc } from '@/lib/payment/reconcile-order-paid-emails'
import { handlePaymentFailed } from '@/app/api/webhooks/stripe/handlers/payment-failed'
import { paymentProofAlt } from '@/lib/orders/proof-filename'

const order = {
    id: 41,
    orderNumber: 'ORD-041',
    customerName: 'Aina',
    currency: 'MYR',
    total: 100,
    tenant: 5,
    status: 'pending_payment',
    paymentStatus: 'awaiting_payment',
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
}

/** The actionUrl of the single notification the code sent (some sites load the notifier lazily). */
async function sentActionUrl() {
    await vi.waitFor(() => expect(notifyTenantOwners).toHaveBeenCalledTimes(1))
    const [, , notification] = notifyTenantOwners.mock.calls[0] as unknown as [unknown, unknown, { actionUrl: string }]
    return notification.actionUrl
}

beforeEach(() => {
    notifyTenantOwners.mockClear()
    find.mockReset().mockResolvedValue({ docs: [{ ...order }] })
    findByID.mockReset().mockResolvedValue(null)
    update.mockReset().mockResolvedValue({})
    create.mockReset().mockResolvedValue({ id: 88 })
})

describe('[TC-F16-2296-02] payment proof uploaded → notification opens that order', () => {
    it('upload-proof links to /orders/<id>', async () => {
        // Arrange: the attached id is this order's own private receipt, not on another order
        find.mockReset().mockResolvedValueOnce({ docs: [{ ...order }] }).mockResolvedValue({ docs: [] })
        findByID.mockResolvedValue({ id: 42, tenant: 5, private: true, alt: paymentProofAlt(order.orderNumber) })

        // Act
        const res = await uploadProof(
            { json: async () => ({ token: 'valid', paymentProofImage: 42 }) } as unknown as Request,
            { params: Promise.resolve({ id: '41' }) },
        )

        // Assert
        expect(res.status).toBe(200)
        expect(await sentActionUrl()).toBe('/orders/41')
    })

    it('upload-proof-direct links to /orders/<id>', async () => {
        // Arrange
        const form = new FormData()
        form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) as BlobPart], 'r.jpg', { type: 'image/jpeg' }))
        form.append('token', 'upload-token')

        // Act
        const res = await uploadProofDirect(
            new Request('http://shop.test/api/orders/41/upload-proof-direct', { method: 'POST', body: form }),
            { params: Promise.resolve({ id: '41' }) },
        )

        // Assert
        expect(res.status).toBe(200)
        expect(await sentActionUrl()).toBe('/orders/41')
    })
})

describe('[TC-F16-2296-01] new paid order (Stripe reconcile) → notification opens that order', () => {
    it('links to /orders/<id>', async () => {
        // Arrange
        const payload = { findByID } as unknown as Payload
        const paid = { ...order, customerEmail: 'buyer@yopmail.com', subtotal: 100, tax: 0, items: [] } as PaidOrderDoc

        // Act
        await sendOrderPaidEmailsAndNotify(payload, paid)

        // Assert
        expect(await sentActionUrl()).toBe('/orders/41')
    })
})

describe('[TC-F16-2296-03] payment failed (Stripe) → notification opens that order', () => {
    it('links to /orders/<id>', async () => {
        // Arrange
        const payload = { find, findByID, update, logger: { error: vi.fn() } } as unknown as Payload

        // Act
        await handlePaymentFailed(payload, {
            provider: 'stripe',
            type: 'payment_failed',
            data: { id: 'pi_041', metadata: {} },
            rawEvent: {},
            connectedAccountId: 'acct_1',
        })

        // Assert
        expect(await sentActionUrl()).toBe('/orders/41')
    })
})
