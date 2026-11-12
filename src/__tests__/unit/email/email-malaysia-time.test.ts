import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatDate } from '@/lib/email/templates/shared/email-utils'
import { orderRefundedEmail, type OrderRefundedData } from '@/lib/email/templates/order-refunded'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'

// GH-2158: the server runs in UTC, so buyer emails must say Malaysia time (UTC+8) explicitly.
const ORDER_CREATED_UTC = '2026-10-30T08:36:00.000Z' // 16:36 in Malaysia
const REFUNDED_UTC = '2026-10-30T08:11:00.000Z' // 16:11 in Malaysia

const refundData: OrderRefundedData = {
    shopName: 'My Shop',
    orderNumber: 'ORD-001',
    customerName: 'Siti',
    customerEmail: 'siti@test.com',
    items: [{ name: 'Widget', quantity: 1, unitPrice: 50, lineTotal: 50 }],
    subtotal: 50,
    shippingFee: 0,
    total: 50,
    refundAmount: 50,
    paymentMethod: 'cod',
    orderDate: ORDER_CREATED_UTC,
    refundDate: REFUNDED_UTC,
    shopUrl: 'https://shop.example.com',
    currency: 'MYR',
    locale: 'en',
}

describe('buyer emails use Malaysia time [TC-F32.95]', () => {
    it('[TC-F32.95] formatDate renders an instant in Malaysia time for en and ms', () => {
        expect(formatDate(ORDER_CREATED_UTC, 'en')).toContain('16:36')
        expect(formatDate(ORDER_CREATED_UTC, 'ms')).toMatch(/0?4:36\s*[pP][mM]/)
    })

    it('[TC-F32.95] a date that is still the day before in UTC lands on the right Malaysia day', () => {
        // 17:30 UTC on 29 Oct is 01:30 on 30 Oct in Malaysia
        expect(formatDate('2026-10-29T17:30:00.000Z', 'en')).toContain('30 October 2026')
    })

    it('[TC-F32.95] refund email shows order and refund time in Malaysia time', () => {
        const { html } = orderRefundedEmail(refundData)

        expect(html).toContain('16:36')
        expect(html).toContain('16:11')
        expect(html).not.toContain('08:36')
        expect(html).not.toContain('08:11')
    })

    it('[TC-F32.95] order confirmation email shows the order time in Malaysia time', () => {
        const { html } = orderConfirmationEmail({
            shopName: 'My Shop',
            orderNumber: 'ORD-001',
            customerName: 'Siti',
            customerEmail: 'siti@test.com',
            items: [{ name: 'Widget', quantity: 1, unitPrice: 50, lineTotal: 50 }],
            subtotal: 50,
            shippingFee: 0,
            total: 50,
            paymentMethod: 'cod',
            orderDate: ORDER_CREATED_UTC,
            orderPageUrl: 'https://example.com/orders/ORD-001',
            currency: 'MYR',
            locale: 'en',
        })

        expect(html).toContain('16:36')
        expect(html).not.toContain('08:36')
    })

    it('[TC-F32.95] no email template formats a date without an explicit time zone', () => {
        const dir = join(process.cwd(), 'src/lib/email/templates')
        const files = [
            ...readdirSync(dir).filter((name) => name.endsWith('.ts')).map((name) => join(dir, name)),
            join(dir, 'shared', 'email-utils.ts'),
        ]
        const offenders = files.filter((file) => {
            const source = readFileSync(file, 'utf8')
            // Every formatting call needs its own timeZone: a file with two calls and one timeZone still fails.
            const calls = source.match(/\.toLocale(Date|Time)?String\(/g)?.length ?? 0
            const zones = source.match(/timeZone:/g)?.length ?? 0
            return calls > zones
        })

        expect(offenders).toEqual([])
    })
})

describe('refund email shows the refund note [TC-F10.R19]', () => {
    it('[TC-F10.R19] renders the reason the seller gave', () => {
        const { html } = orderRefundedEmail({ ...refundData, refundNote: 'UAT test refund' })

        expect(html).toContain('UAT test refund')
    })

    it('[TC-F10.R19] escapes HTML in the reason', () => {
        const { html } = orderRefundedEmail({ ...refundData, refundNote: '<b>damaged</b>' })

        expect(html).toContain('&lt;b&gt;damaged&lt;/b&gt;')
        expect(html).not.toContain('<b>damaged</b>')
    })

    it('[TC-F10.R19] falls back to a dash when there is no reason', () => {
        const { html } = orderRefundedEmail({ ...refundData, refundNote: null })

        expect(html).toContain('—')
    })
})
