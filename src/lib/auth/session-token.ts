import { decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose'

/**
 * Which session a token proves, decided once per token:
 * - `payload`: Payload's own login token (`POST /api/users/login`), signed with Payload's derived secret
 *   (`payload.secret`), protected header `authVersion: 1`, carries the session id `sid`.
 * - `app`: the tokens this app mints after the OTP step / SSO (verify-otp, sso-session, refresh-token,
 *   pw1-publish), signed with the raw PAYLOAD_SECRET or a peer's SSO_SHARED_SECRET, `mfa_verified: true`.
 * Pure (no Payload, no DB): unit-tested with real signed tokens.
 */
export type SessionClaims =
    | { kind: 'payload'; id: string | number; sid?: string; mfaVerified: boolean }
    | { kind: 'app'; id: string | number; mfaVerified: true }

export interface SessionSecrets {
    /** Payload's derived signing secret (`payload.secret`). */
    payloadSecret: string
    /** Raw PAYLOAD_SECRET, then SSO_SHARED_SECRET when set and different. */
    appSecrets: string[]
}

/** Payload's JWT_AUTH_VERSION (payload/dist/auth/jwtAuth.js); a mismatch makes Payload reject the token too. */
export const PAYLOAD_JWT_AUTH_VERSION = 1

const APP_ID_PATTERN = /^[a-zA-Z0-9-]+$/

export class SessionSignatureError extends Error {
    constructor() {
        super('JWT signature verification failed against all candidate secrets')
        this.name = 'SessionSignatureError'
    }
}

/** `Authorization: Bearer|JWT <token>` (API calls), else null. */
export function readAuthorizationToken(req: Pick<Request, 'headers'> | undefined): string | null {
    const header = req?.headers.get('authorization')
    if (header?.startsWith('Bearer ') || header?.startsWith('JWT ')) return header.split(' ')[1] || null
    return null
}

/** The app secrets in the order getCurrentUser has always tried them. */
export function appSessionSecrets(env: { PAYLOAD_SECRET?: string; SSO_SHARED_SECRET?: string }): string[] {
    const secrets: string[] = []
    if (env.PAYLOAD_SECRET) secrets.push(env.PAYLOAD_SECRET)
    if (env.SSO_SHARED_SECRET && env.SSO_SHARED_SECRET !== env.PAYLOAD_SECRET) secrets.push(env.SSO_SHARED_SECRET)
    return secrets
}

const encode = (secret: string) => new TextEncoder().encode(secret)

/** Payload's own rule (strategies/jwt.js getJWTAuthenticationReference), limited to the `users` collection. */
function payloadClaims(decoded: JWTPayload): SessionClaims | null {
    const { id, collection, sid } = decoded as JWTPayload & { id?: unknown; collection?: unknown; sid?: unknown }
    if (collection !== 'users') return null
    if (typeof id !== 'number' && typeof id !== 'string') return null
    if (sid !== undefined && typeof sid !== 'string') return null
    return { kind: 'payload', id, ...(sid ? { sid } : {}), mfaVerified: decoded.mfa_verified === true }
}

/** The app-token rule getCurrentUser has always applied: id pattern, users collection, OTP step passed. */
function appClaims(decoded: JWTPayload): SessionClaims | null {
    const id = (decoded as { id?: unknown }).id
    const idValid = typeof id === 'number' || (typeof id === 'string' && APP_ID_PATTERN.test(id))
    if (!idValid || decoded.collection !== 'users' || decoded.mfa_verified !== true) return null
    return { kind: 'app', id: id as string | number, mfaVerified: true }
}

/**
 * Verifies the token once and says which session it is. Returns null for a valid signature whose claims do not
 * describe a session; throws SessionSignatureError when no secret matches; jose errors (expired, malformed)
 * propagate. All of those mean "not signed in" to the caller.
 */
export async function verifySessionToken(token: string, secrets: SessionSecrets): Promise<SessionClaims | null> {
    let header: ReturnType<typeof decodeProtectedHeader> | null = null
    try {
        header = decodeProtectedHeader(token)
    } catch {
        return null
    }

    if (header.authVersion === PAYLOAD_JWT_AUTH_VERSION && secrets.payloadSecret) {
        try {
            // `exp` required: Payload always sets it; a token without one would be a forever credential.
            const { payload } = await jwtVerify(token, encode(secrets.payloadSecret), { requiredClaims: ['exp'] })
            return payloadClaims(payload)
        } catch {
            // Not Payload's signature: fall through to the app secrets, as payload.auth() → fallback did.
        }
    }

    // A secret whose signature matched but whose claims failed (expired, no exp) says more than "wrong secret".
    let claimError: unknown = null
    for (const secret of secrets.appSecrets) {
        try {
            // `exp` is required: a peer/custom token with no expiry would be a forever credential.
            const { payload } = await jwtVerify(token, encode(secret), { requiredClaims: ['exp'] })
            return appClaims(payload)
        } catch (error) {
            if ((error as { code?: string }).code !== 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') claimError ??= error
        }
    }
    if (claimError) throw claimError
    throw new SessionSignatureError()
}
