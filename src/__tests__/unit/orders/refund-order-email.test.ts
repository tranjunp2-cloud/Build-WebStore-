/**
 * TC-F32.101 / TC-F32.102 (GH-2240 follow-up) — the refund email built from a stored order.
 * Real: sendRefundEmail + orderRefundedEmail template. Faked: CMS template config, payload.sendEmail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn(async () => null) }))

import { sendRefundEmail } from '@/lib/orders/refund-order-email'

const sendEmail = vi.fn(async (_args: { to: string; subject: string; html: string }) => undefined)
const payload = { sendEmail, logger: { error: vi.fn() } } as never

// UAT order ORD-MW1YFGLL: 2 × RM27, QATEST5 −RM5 (stored in sen), shipping RM8 → RM57. Items carry no lineTotal.
const order = {
    id: 876,
    orderNumber: 'ORD-MW1YFGLL',
    tenant: { id: 2929, name: 'QA 2240 Shop', slug: 'qa-2240-bcd183' },
    site: { locale: 'ms' },
    customerName: 'QA-TEST E2E Buyer',
    customerEmail: 'qa-2240-buyer@yopmail.com',
    items: [{ productName: 'QA-TEST Portland Cement 50kg', quantity: 2, unitPrice: 27 }],
    subtotal: 54,
    shippingFee: 8,
    discountAmount: 500,
    discountCode: 'QATEST5',
    total: 57,
    paymentMethod: 'cod',
    currency: 'MYR',
    createdAt: '2026-11-04T10:08:00.000Z',
}

const sentHtml = () => sendEmail.mock.calls[0][0].html

describe('refund email built from the order [TC-F32.101] [TC-F32.102]', () => {
    beforeEach(() => sendEmail.mockClear())

    it('[TC-F32.101] line amount is unit price × quantity when the item has no lineTotal', async () => {
        await sendRefundEmail(payload, order, 'UAT test refund GH-2240')

        expect(sentHtml()).toContain('RM54.00')
        expect(sentHtml()).not.toContain('RM0.00')
    })

    it('[TC-F32.101] keeps a stored lineTotal', async () => {
        await sendRefundEmail(payload, { ...order, items: [{ productName: 'Widget', quantity: 2, unitPrice: 27, lineTotal: 50 }] })

        expect(sentHtml()).toContain('RM50.00')
    })

    it('[TC-F32.102] shows the discount converted from sen to RM', async () => {
        await sendRefundEmail(payload, order)

        expect(sentHtml()).toContain('Diskaun')
        expect(sentHtml()).toContain('QATEST5')
        expect(sentHtml()).toContain('-RM5.00')
        expect(sentHtml()).toContain('RM57.00')
    })

    it('[TC-F32.102] has no discount line when the order has no discount', async () => {
        await sendRefundEmail(payload, { ...order, discountAmount: 0, discountCode: null, total: 62 })

        expect(sentHtml()).not.toContain('Diskaun')
        expect(sentHtml()).not.toContain('-RM')
    })
})
