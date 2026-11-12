import { jwtVerify } from 'jose'

/** What the "you are viewing as a merchant" banner shows. */
export type MerchantAccessBanner = {
    merchantEmail: string
    /** Who is acting for the merchant; "Prime Support" for sessions minted before the email claim existed. */
    actorEmail: string
    /** ISO time the session token expires. */
    expiresAt: string
}

const FALLBACK_ACTOR = 'Prime Support'

/**
 * Reads the session cookie and returns banner data only for a genuine merchant-access session
 * (valid HS256 signature, unexpired, `impersonated_by` claim present). Anything else — no cookie, bad
 * signature, ordinary session — returns null. Never throws: a broken cookie must not break a layout.
 */
export async function getMerchantAccessBanner(tokenValue: string | null | undefined): Promise<MerchantAccessBanner | null> {
    const secret = process.env.PAYLOAD_SECRET
    if (!tokenValue || !secret) return null
    try {
        const { payload } = await jwtVerify(tokenValue, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
        if (payload.impersonated_by === undefined || typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null
        const actor = payload.impersonated_by_email
        return {
            merchantEmail: payload.email,
            actorEmail: typeof actor === 'string' && actor ? actor : FALLBACK_ACTOR,
            expiresAt: new Date(payload.exp * 1000).toISOString(),
        }
    } catch {
        return null
    }
}
