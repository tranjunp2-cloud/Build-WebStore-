import { describe, it, expect } from 'vitest'
import { newOrderSellerEmail, type NewOrderSellerData } from '@/lib/email/templates/new-order-seller'
import { orderCompletedEmail, type OrderCompletedData } from '@/lib/email/templates/order-completed'
import { orderRefundedEmail, type OrderRefundedData } from '@/lib/email/templates/order-refunded'

// GH-2240: order email content bugs found in the production audit of 03/11/2026.

// Order ORD-MW0ECPGJ from the audit: 2 × RM27, code QATEST5 (−RM5), shipping RM8 → total RM57.
const sellerData: NewOrderSellerData = {
    shopName: 'PC test 2025',
    orderNumber: 'ORD-MW0ECPGJ',
    customerName: 'QA-TEST E2E Buyer',
    orderPageUrl: 'https://example.com/orders',
    items: [{ name: 'QA-TEST Portland Cement 50kg', quantity: 2, lineTotal: 54 }],
    orderTotal: 57,
    shippingFee: 8,
    discountAmount: 5,
    discountCode: 'QATEST5',
    currency: 'MYR',
    locale: 'en',
}

describe('seller new order email shows the discount line [TC-F32.98]', () => {
    it('[TC-F32.98] shows the discount code and amount in RM', () => {
        const { html } = newOrderSellerEmail(sellerData)

        expect(html).toContain('Discount')
        expect(html).toContain('QATEST5')
        expect(html).toContain('-MYR 5.00')
        expect(html).toContain('MYR 57.00')
    })

    it('[TC-F32.98] has no discount line when the order has no discount', () => {
        const { html } = newOrderSellerEmail({ ...sellerData, discountAmount: null, discountCode: null, orderTotal: 62 })

        expect(html).not.toContain('Discount')
        expect(html).not.toContain('-MYR')
    })

    it('[TC-F32.98] uses the Malay label in ms', () => {
        const { html } = newOrderSellerEmail({ ...sellerData, locale: 'ms' })

        expect(html).toContain('Diskaun')
    })

    it('[TC-F32.98] escapes HTML in the discount code', () => {
        const { html } = newOrderSellerEmail({ ...sellerData, discountCode: '<b>X</b>' })

        expect(html).toContain('&lt;b&gt;X&lt;/b&gt;')
        expect(html).not.toContain('<b>X</b>')
    })
})

const completedData: OrderCompletedData = {
    shopName: 'PC test 2025',
    orderNumber: 'ORD-MW0ECPGJ',
    customerName: 'QA-TEST E2E Buyer',
    customerEmail: 'qc.e2e01@yopmail.com',
    items: [{ name: 'Widget', quantity: 1, unitPrice: 50, lineTotal: 50 }],
    subtotal: 50,
    shippingFee: 0,
    total: 50,
    paymentMethod: 'cod',
    orderDate: '2026-11-03T07:59:00.000Z', // 15:59 in Malaysia
    completedDate: '2026-11-03T08:01:00.000Z', // 16:01 in Malaysia
    orderPageUrl: 'https://example.com/orders/ORD-MW0ECPGJ',
    currency: 'MYR',
    locale: 'en',
}

describe('order completed email shows the real order date [TC-F32.99]', () => {
    it('[TC-F32.99] shows the order date and the completed date separately', () => {
        const { html } = orderCompletedEmail(completedData)

        expect(html).toContain('15:59')
        expect(html).toContain('16:01')
    })
})

const refundData: OrderRefundedData = {
    shopName: 'PC test 2025',
    orderNumber: 'ORD-MW0ECPGJ',
    customerName: 'QA-TEST E2E Buyer',
    customerEmail: 'qc.e2e01@yopmail.com',
    items: [{ name: 'Widget', quantity: 1, unitPrice: 50, lineTotal: 50 }],
    subtotal: 50,
    shippingFee: 0,
    total: 50,
    refundAmount: 50,
    paymentMethod: 'cod',
    orderDate: '2026-11-03T07:59:00.000Z',
    refundDate: '2026-11-03T08:11:00.000Z',
    shopUrl: 'https://example.com',
    currency: 'MYR',
    locale: 'en',
}

describe('refund email greets the customer once [TC-F32.100]', () => {
    it('[TC-F32.100] en greeting has the name once', () => {
        const { html } = orderRefundedEmail(refundData)

        expect(html).toContain('Hi QA-TEST E2E Buyer,')
        expect(html).not.toContain('QA-TEST E2E Buyer QA-TEST E2E Buyer')
    })

    it('[TC-F32.100] ms greeting has the name once', () => {
        const { html } = orderRefundedEmail({ ...refundData, locale: 'ms' })

        expect(html).toContain('Hai QA-TEST E2E Buyer,')
        expect(html).not.toContain('QA-TEST E2E Buyer QA-TEST E2E Buyer')
    })

    it('[TC-F32.100] a CMS greeting override keeps the name once', () => {
        const { html } = orderRefundedEmail(refundData, { greeting: 'Dear {customerName}' } as never)

        expect(html).toContain('Dear QA-TEST E2E Buyer,')
        expect(html).not.toContain('QA-TEST E2E Buyer QA-TEST E2E Buyer')
    })
})

describe('refund email discount line [TC-F32.102]', () => {
    it('[TC-F32.102] shows the discount code (escaped) and amount', () => {
        const { html } = orderRefundedEmail({ ...refundData, discountAmount: 5, discountCode: '<b>QA</b>', total: 45, refundAmount: 45 })

        expect(html).toContain('Discount')
        expect(html).toContain('&lt;b&gt;QA&lt;/b&gt;')
        expect(html).not.toContain('<b>QA</b>')
        expect(html).toContain('-MYR 5.00')
    })
})

describe('refund email wording is translated [TC-F32.103]', () => {
    // The Malay body copy is owned by the GH-1701 approved-copy contract, so only the label is checked here.
    it('[TC-F32.103] ms uses the Malay refunded amount label', () => {
        const { html } = orderRefundedEmail({ ...refundData, locale: 'ms' })

        expect(html).toContain('Jumlah dibayar balik')
        expect(html).not.toMatch(/>\s*Refunded\s*</)
    })

    it('[TC-F32.103] en keeps the Refunded label', () => {
        const { html } = orderRefundedEmail(refundData)

        expect(html).toMatch(/>\s*Refunded\s*</)
        expect(html).toContain('has been refunded')
    })
})
