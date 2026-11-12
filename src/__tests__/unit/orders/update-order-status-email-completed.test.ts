/**
 * TC-F32.99 (GH-2211) — the "order completed" email gets the date the buyer placed the order,
 * not the time it was completed. Real: sendStatusEmail. Faked: plan check, CMS config, owner emails, template.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => null),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn(async () => null) }))
vi.mock('@/lib/email/get-tenant-owner-emails', () => ({ getTenantOwnerEmails: vi.fn(async () => ['owner@yopmail.com']) }))
vi.mock('@/lib/email/templates/order-completed', () => ({
    orderCompletedEmail: vi.fn(() => ({ subject: 'Completed', html: '<p>Completed</p>' })),
}))

import { sendStatusEmail } from '@/lib/orders/update-order-status-email'
import { orderCompletedEmail } from '@/lib/email/templates/order-completed'

const ORDER_CREATED_AT = '2026-11-03T07:59:00.000Z'

const payload = {
    findByID: vi.fn(async () => ({ id: 1, name: 'PC test 2025', slug: 'pc-changed' })),
    sendEmail: vi.fn(async () => undefined),
} as never

const order = {
    id: 7,
    orderNumber: 'ORD-MW0ECPGJ',
    tenant: 1,
    customerName: 'QA-TEST E2E Buyer',
    customerEmail: 'qc.e2e01@yopmail.com',
    items: [{ productName: 'Widget', quantity: 1, unitPrice: 50 }],
    subtotal: 50,
    shippingFee: 0,
    total: 50,
    paymentMethod: 'cod',
    currency: 'MYR',
    createdAt: ORDER_CREATED_AT,
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('completed status email dates [TC-F32.99]', () => {
    it('[TC-F32.99] passes the order creation time as orderDate and now as completedDate', async () => {
        // Act
        await sendStatusEmail(payload, order, '7', 'completed', undefined)

        // Assert
        expect(vi.mocked(orderCompletedEmail)).toHaveBeenCalledTimes(1)
        const data = vi.mocked(orderCompletedEmail).mock.calls[0][0]
        expect(data.orderDate).toBe(ORDER_CREATED_AT)
        expect(data.completedDate).not.toBe(ORDER_CREATED_AT)
    })
})
