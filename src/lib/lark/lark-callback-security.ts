/**
 * Authenticating requests Lark sends to us (card button callbacks).
 *
 * The callback URL is public and a request that passes here may change a Base row, so nothing is
 * trusted until it proves it came from our app:
 * - Verification Token (required): Lark puts the app's token in every payload. Unset = refuse all.
 * - Encrypt Key (recommended): Lark AES-encrypts the payload and signs the raw body. With it set,
 *   a payload that is not encrypted is refused outright.
 */
import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

export const MAX_CALLBACK_BODY_BYTES = 64 * 1024

/** Shape differs between callback v1 / v2; the caller narrows each field it reads. */
export type LarkPayload = Record<string, unknown>
export type OpenResult = { ok: true; payload: LarkPayload } | { ok: false; reason: string }

/** Constant-time string comparison; false on any length mismatch or missing value. */
export function secretsMatch(given: unknown, expected: string | undefined): boolean {
    if (typeof given !== 'string' || !expected) return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

/** Lark: AES-256-CBC, key = SHA-256(Encrypt Key), IV = first 16 bytes of the payload. */
export function decryptPayload(encrypted: string, encryptKey: string): string {
    const key = createHash('sha256').update(encryptKey).digest()
    const buffer = Buffer.from(encrypted, 'base64')
    const decipher = createDecipheriv('aes-256-cbc', key, buffer.subarray(0, 16))
    return Buffer.concat([decipher.update(buffer.subarray(16)), decipher.final()]).toString('utf8')
}

/** Lark: X-Lark-Signature = hex SHA-256 of timestamp + nonce + Encrypt Key + raw body. */
export function signatureValid(headers: Headers, rawBody: string, encryptKey: string): boolean {
    const timestamp = headers.get('x-lark-request-timestamp')
    const nonce = headers.get('x-lark-request-nonce')
    const signature = headers.get('x-lark-signature')
    if (!timestamp || !nonce || !signature) return false
    const expected = createHash('sha256').update(`${timestamp}${nonce}${encryptKey}${rawBody}`).digest('hex')
    return secretsMatch(signature, expected)
}

/** Turns the raw request into the trusted payload, or says why not. */
export function openPayload(headers: Headers, rawBody: string): OpenResult {
    let outer: LarkPayload
    try {
        outer = JSON.parse(rawBody || '{}')
    } catch {
        return { ok: false, reason: 'invalid-json' }
    }
    if (!outer || typeof outer !== 'object') return { ok: false, reason: 'invalid-json' }

    const encryptKey = process.env.LARK_CALLBACK_ENCRYPT_KEY
    let payload = outer
    if (encryptKey) {
        if (typeof outer.encrypt !== 'string') return { ok: false, reason: 'not-encrypted' }
        // Lark signs callbacks it encrypts; a present signature must verify.
        if (headers.get('x-lark-signature') && !signatureValid(headers, rawBody, encryptKey)) {
            return { ok: false, reason: 'bad-signature' }
        }
        try {
            payload = JSON.parse(decryptPayload(outer.encrypt, encryptKey))
        } catch {
            return { ok: false, reason: 'decrypt-failed' }
        }
    } else if (outer.encrypt) {
        return { ok: false, reason: 'encrypted-but-no-key' }
    }

    // v2 callbacks carry the token in `header`; v1 and url_verification at the top level.
    const header = payload.header && typeof payload.header === 'object' ? (payload.header as Record<string, unknown>) : {}
    const token = header.token ?? payload.token
    if (!secretsMatch(token, process.env.LARK_CALLBACK_VERIFICATION_TOKEN)) return { ok: false, reason: 'bad-token' }
    return { ok: true, payload }
}
