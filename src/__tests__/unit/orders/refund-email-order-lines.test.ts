/**
 * TC-F32.104 (GH-2240 review) — every path that sends the refund email uses the same money lines:
 * line amount = unit price × quantity, discount from sen to RM. Covers the shared helper and the
 * Xendit cancel path. Real: refundEmailOrderLines, sendCancelEmails, both templates.
 * Faked: CMS template config, payload.findByID / sendEmail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: vi.fn(async () => null) }))

import { refundEmailOrderLines } from '@/lib/orders/refund-email-order-lines'
import { sendCancelEmails } from '@/lib/orders/cancel-order-emails'

// 2 × RM27, QATEST5 −RM5 (stored in sen), shipping RM8 → RM57. Items carry no lineTotal.
const order = {
    id: 878,
    orderNumber: 'ORD-QA2240X',
    tenant: 2929,
    site: { locale: 'ms' },
    customerName: 'QA-TEST E2E Buyer',
    customerEmail: 'qa-2240-buyer@yopmail.com',
    items: [{ productName: 'QA-TEST Portland Cement 50kg', quantity: 2, unitPrice: 27 }],
    subtotal: 54,
    shippingFee: 8,
    discountAmount: 500,
    discountCode: 'QATEST5',
    total: 57,
    paymentMethod: 'xendit',
    currency: 'MYR',
    createdAt: '2026-11-04T10:08:00.000Z',
}

const sendEmail = vi.fn(async (_args: { to: string; subject: string; html: string }) => undefined)
const payload = {
    findByID: vi.fn(async () => ({ id: 2929, name: 'QA 2240 Shop', slug: 'qa-2240-bcd183' })),
    sendEmail,
} as never

describe('shared refund email money lines [TC-F32.104]', () => {
    beforeEach(() => sendEmail.mockClear())

    it('[TC-F32.104] derives line amounts and converts the discount to RM', () => {
        const lines = refundEmailOrderLines(order)

        expect(lines.items[0]).toMatchObject({ quantity: 2, unitPrice: 27, lineTotal: 54 })
        expect(lines).toMatchObject({ subtotal: 54, shippingFee: 8, discountAmount: 5, discountCode: 'QATEST5', total: 57 })
    })

    it('[TC-F32.104] no discount gives null fields', () => {
        const lines = refundEmailOrderLines({ ...order, discountAmount: 0, discountCode: undefined })

        expect(lines.discountAmount).toBeNull()
        expect(lines.discountCode).toBeNull()
    })

    it('[TC-F32.104] Xendit cancel refund email shows the line amount and the discount', async () => {
        await sendCancelEmails(payload, order, 'Buyer asked to cancel', 'xrf_test_1')

        const refund = sendEmail.mock.calls.map((c) => c[0]).find((m) => /bayaran balik/.test(m.subject))
        expect(refund).toBeDefined()
        expect(refund!.html).toContain('RM54.00')
        expect(refund!.html).not.toContain('RM0.00')
        expect(refund!.html).toContain('QATEST5')
        expect(refund!.html).toContain('-RM5.00')
    })
})
