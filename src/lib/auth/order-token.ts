/**
 * Magic-link JWT helper for post-order bank-transfer upload flow.
 *
 * Uses HS256 (per-order secret = magicLinkSecret field) so secret rotation
 * on Reject automatically invalidates old links — no global revocation list needed.
 *
 * Payload: { sub: orderId, scope: 'order_upload', iat, exp }
 * No PII in token.
 */

import { SignJWT, jwtVerify } from 'jose'

/**
 * Encode a string to Uint8Array for use as a jose HMAC key.
 * Uses Buffer.from (Node.js native) which is guaranteed to return a true
 * Uint8Array instance, avoiding jsdom's TextEncoder cross-realm issues.
 */
const enc = (s: string): Uint8Array => Buffer.from(s, 'utf-8')

export interface SignOrderTokenOpts {
    orderId: number | string
    secret: string
    /** Absolute Unix epoch seconds for expiry (e.g. Math.floor(paymentExpiresAt.getTime() / 1000)) */
    expSec: number
}

/**
 * Sign a magic-link JWT for bank-transfer upload.
 * TC-F10-06-07, TC-F10-06-08
 */
export async function signOrderToken(opts: SignOrderTokenOpts): Promise<string> {
    return await new SignJWT({ scope: 'order_upload' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(opts.orderId))
        .setIssuedAt()
        .setExpirationTime(opts.expSec)
        .sign(enc(opts.secret))
}

export type VerifyOrderTokenResult =
    | { ok: true; orderId: string }
    | { ok: false; error: 'expired' | 'invalid' }

/**
 * Verify a magic-link JWT. Enforces:
 * - HS256 algorithm (rejects alg:none)
 * - scope === 'order_upload' (prevents cross-feature reuse)
 * - exp claim (strictly enforced by jose)
 *
 * TC-F10-06-08, TC-F10-06-09
 */
export async function verifyOrderToken(opts: {
    token: string
    secret: string
}): Promise<VerifyOrderTokenResult> {
    try {
        const { payload } = await jwtVerify(opts.token, enc(opts.secret), {
            algorithms: ['HS256'],
        })

        if (payload.scope !== 'order_upload' || !payload.sub) {
            return { ok: false, error: 'invalid' }
        }

        return { ok: true, orderId: String(payload.sub) }
    } catch (e: unknown) {
        const code = (e as { code?: string })?.code
        if (code === 'ERR_JWT_EXPIRED') return { ok: false, error: 'expired' }
        return { ok: false, error: 'invalid' }
    }
}
