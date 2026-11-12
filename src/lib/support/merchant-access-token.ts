import { SignJWT, jwtVerify } from 'jose'

/**
 * One-time handoff token behind a merchant CMS access link (/sso/merchant-access?token=…).
 *
 * The token only says "actor X may open merchant Y once, for the next few minutes". It deliberately carries
 * no `collection` / `id` / `mfa_verified` claims, so getCurrentUser() and the edge guards can never accept it
 * as a session: the session for the merchant is minted only after the link is redeemed (see redeem route).
 */
export const MERCHANT_ACCESS_LINK_TTL_SECONDS = 10 * 60
/** How long the merchant session lasts once a link is redeemed: enough for one site-building sitting. */
export const MERCHANT_ACCESS_SESSION_TTL_SECONDS = 4 * 60 * 60

const AUDIENCE = 'merchant-access'
const TOKEN_TYPE = 'merchant-access-link'

export type MerchantAccessClaims = {
    jti: string
    targetUserId: number
    actorUserId: number
}

function secretKey(): Uint8Array {
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) throw new Error('PAYLOAD_SECRET is required')
    return new TextEncoder().encode(secret)
}

export async function signMerchantAccessToken(claims: MerchantAccessClaims): Promise<string> {
    return new SignJWT({ typ: TOKEN_TYPE, act: claims.actorUserId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(claims.targetUserId))
        .setAudience(AUDIENCE)
        .setJti(claims.jti)
        .setIssuedAt()
        .setExpirationTime(`${MERCHANT_ACCESS_LINK_TTL_SECONDS}s`)
        .sign(secretKey())
}

/** Returns the claims of a valid, unexpired link token, or null for anything else. */
export async function verifyMerchantAccessToken(token: string): Promise<MerchantAccessClaims | null> {
    try {
        const { payload } = await jwtVerify(token, secretKey(), { audience: AUDIENCE, algorithms: ['HS256'] })
        const targetUserId = Number(payload.sub)
        const actorUserId = Number(payload.act)
        if (payload.typ !== TOKEN_TYPE || typeof payload.jti !== 'string') return null
        if (!Number.isInteger(targetUserId) || !Number.isInteger(actorUserId)) return null
        return { jti: payload.jti, targetUserId, actorUserId }
    } catch {
        // Bad signature, wrong audience or expired: the link is simply not valid.
        return null
    }
}

/** Session token for the merchant, same shape the SSO session mints, plus who is acting on their behalf. */
export async function signMerchantSessionToken(
    user: { id: number; email: string },
    actorUserId: number,
    actorEmail?: string,
): Promise<string> {
    return new SignJWT({
        id: user.id,
        email: user.email,
        collection: 'users',
        mfa_verified: true,
        impersonated_by: actorUserId,
        // Display only (banner): who is acting. The guards trust `impersonated_by`, never this.
        ...(actorEmail ? { impersonated_by_email: actorEmail } : {}),
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${MERCHANT_ACCESS_SESSION_TTL_SECONDS}s`)
        .sign(secretKey())
}
