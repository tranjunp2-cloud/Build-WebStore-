import { createHmac, timingSafeEqual } from 'crypto'
import { verifyConfirmToken } from './upload-token'

/**
 * Short-lived "this browser placed the order" proof for the public tracking page.
 *
 * The confirm cookie `ct_<id>` is dropped when the buyer leaves the confirm page (Track order, cancel payment)
 * so Back can't return to it. The tracking page shows the buyer's full name, phone and street address only to
 * the buyer's own browser (TC-PERF-140), so the same response sets `ov_<id>` with this token instead
 * (TC-PERF-177). Bound to order id + order number, HMAC-signed, 24 h.
 */
export const ORDER_VIEW_TTL_SEC = 24 * 60 * 60

export const orderViewCookieName = (orderId: string | number): string => `ov_${orderId}`

function secret(): string {
    const s = process.env.PAYLOAD_SECRET
    if (!s) throw new Error('PAYLOAD_SECRET is not set')
    return s
}

function sign(orderId: string | number, orderNumber: string, expiresAt: number): string {
    return createHmac('sha256', secret())
        .update(`order_view:${orderId}:${orderNumber}:${expiresAt}`)
        .digest('hex')
}

export function generateOrderViewToken(orderId: string | number, orderNumber: string, now = Date.now()): string {
    const expiresAt = now + ORDER_VIEW_TTL_SEC * 1000
    return `${expiresAt}.${sign(orderId, orderNumber, expiresAt)}`
}

export function verifyOrderViewToken(
    token: string | undefined | null,
    orderId: string | number,
    orderNumber: string,
    now = Date.now(),
): boolean {
    if (!token) return false
    const [expiresAtStr, hmac, extra] = token.split('.')
    if (extra !== undefined || !hmac || hmac.length !== 64) return false
    const expiresAt = Number(expiresAtStr)
    if (!Number.isFinite(expiresAt) || now > expiresAt) return false
    try {
        return timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(sign(orderId, orderNumber, expiresAt), 'hex'))
    } catch {
        return false
    }
}

/** Cookie options for `ov_<id>`: HttpOnly, whole site, 24 h. */
export const orderViewCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ORDER_VIEW_TTL_SEC,
    path: '/',
})

/**
 * True when this browser placed the order: a valid confirm cookie `ct_<id>` (set at checkout) or a valid view
 * cookie `ov_<id>` (swapped in when the buyer left the confirm page). Anyone else gets the masked tracking page.
 */
export function isOrderBuyerBrowser(
    readCookie: (name: string) => string | undefined,
    order: { id: string | number; orderNumber: string },
): boolean {
    const confirmCookie = readCookie(`ct_${order.id}`)
    if (confirmCookie && verifyConfirmToken(confirmCookie, order.id, order.orderNumber)) return true
    return verifyOrderViewToken(readCookie(orderViewCookieName(order.id)), order.id, order.orderNumber)
}
