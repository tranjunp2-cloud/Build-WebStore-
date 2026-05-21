import { createHmac, timingSafeEqual } from 'crypto'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 h

function secret(): string {
    const s = process.env.PAYLOAD_SECRET
    if (!s) throw new Error('PAYLOAD_SECRET is not set')
    return s
}

function sign(orderId: string | number, expiresAt: number): string {
    return createHmac('sha256', secret())
        .update(`${orderId}:${expiresAt}`)
        .digest('hex')
}

/** Generate a 24-hour token tied to a specific order ID. */
export function generateUploadToken(orderId: string | number): string {
    const expiresAt = Date.now() + TTL_MS
    const hmac = sign(orderId, expiresAt)
    return `${orderId}:${expiresAt}:${hmac}`
}

/** Returns true if the token is valid and not expired for this order. */
export function verifyUploadToken(token: string, orderId: string | number): boolean {
    const parts = token.split(':')
    if (parts.length !== 3) return false
    const [tokenOrderId, expiresAtStr, hmac] = parts
    if (String(tokenOrderId) !== String(orderId)) return false
    const expiresAt = Number(expiresAtStr)
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false
    const expected = sign(orderId, expiresAt)
    try {
        return timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
        return false
    }
}

/** Generate a permanent (no-TTL) token for the confirm page, tied to order ID + orderNumber. */
export function generateConfirmToken(orderId: string | number, orderNumber: string): string {
    return createHmac('sha256', secret())
        .update(`confirm:${orderId}:${orderNumber}`)
        .digest('hex')
}

/** Returns true if the confirm page token is valid for this order. */
export function verifyConfirmToken(token: string, orderId: string | number, orderNumber: string): boolean {
    if (!token || token.length !== 64) return false
    const expected = generateConfirmToken(orderId, orderNumber)
    try {
        return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
        return false
    }
}
