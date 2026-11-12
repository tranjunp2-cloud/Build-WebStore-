/**
 * TC-PERF-177 — the buyer who placed the order keeps seeing their own name, phone and street address on the
 * tracking page after leaving the confirm page; a stranger with the order number still gets the masked view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ORDER_VIEW_TTL_SEC,
    generateOrderViewToken,
    isOrderBuyerBrowser,
    verifyOrderViewToken,
} from '@/lib/orders/order-view-token'
import { generateConfirmToken } from '@/lib/orders/upload-token'

const order = { id: 78, orderNumber: 'ORD-ABC123' }

beforeEach(() => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-payload-secret')
})
afterEach(() => {
    vi.unstubAllEnvs()
})

describe('order view token [TC-PERF-177]', () => {
    it('accepts its own order within 24 h and refuses it afterwards', () => {
        // Arrange
        const now = 1_800_000_000_000
        const token = generateOrderViewToken(order.id, order.orderNumber, now)

        // Act + Assert
        expect(verifyOrderViewToken(token, order.id, order.orderNumber, now + 1000)).toBe(true)
        expect(verifyOrderViewToken(token, order.id, order.orderNumber, now + ORDER_VIEW_TTL_SEC * 1000 + 1)).toBe(false)
    })

    it('is bound to the order id and number and cannot be extended or forged', () => {
        // Arrange
        const now = Date.now()
        const token = generateOrderViewToken(order.id, order.orderNumber, now)
        const [, hmac] = token.split('.')

        // Act + Assert
        expect(verifyOrderViewToken(token, 79, order.orderNumber)).toBe(false)
        expect(verifyOrderViewToken(token, order.id, 'ORD-OTHER')).toBe(false)
        expect(verifyOrderViewToken(`${now + 365 * 86_400_000}.${hmac}`, order.id, order.orderNumber)).toBe(false)
        expect(verifyOrderViewToken(`${now + 1000}.${'0'.repeat(64)}`, order.id, order.orderNumber)).toBe(false)
        expect(verifyOrderViewToken('', order.id, order.orderNumber)).toBe(false)
        expect(verifyOrderViewToken(undefined, order.id, order.orderNumber)).toBe(false)
    })
})

describe('isOrderBuyerBrowser [TC-PERF-177]', () => {
    const jar = (cookies: Record<string, string>) => (name: string) => cookies[name]

    it('treats the confirm cookie or the view cookie as the buyer', () => {
        // Arrange
        const ct = generateConfirmToken(order.id, order.orderNumber)
        const ov = generateOrderViewToken(order.id, order.orderNumber)

        // Act + Assert
        expect(isOrderBuyerBrowser(jar({ ct_78: ct }), order)).toBe(true)
        expect(isOrderBuyerBrowser(jar({ ov_78: ov }), order)).toBe(true)
    })

    it('masks for a stranger: no cookie, or cookies for another order', () => {
        // Arrange
        const otherCt = generateConfirmToken(79, 'ORD-OTHER')
        const otherOv = generateOrderViewToken(79, 'ORD-OTHER')

        // Act + Assert
        expect(isOrderBuyerBrowser(jar({}), order)).toBe(false)
        expect(isOrderBuyerBrowser(jar({ ct_78: otherCt, ov_78: otherOv }), order)).toBe(false)
    })
})
