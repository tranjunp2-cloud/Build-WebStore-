import { decodeJwt } from 'jose'
import { candidateTokens } from '@/lib/auth/payload-rest-otp-guard'

/**
 * Detects a "merchant access" session (support / super-admin acting as a merchant, claim `impersonated_by`).
 * Used only to RESTRICT: every candidate token (Authorization header AND cookie) is decoded without verifying
 * its signature, so a forged claim can only limit its own sender, and a fake `Authorization: Bearer x` header
 * cannot hide the real impersonation cookie (TC-F15.39).
 */
export const IMPERSONATION_FORBIDDEN = 'impersonation_forbidden_action'

type HeaderSource = { headers: Pick<Headers, 'get'> }

/** `impersonated_by` of the first candidate token that carries the claim, else null. Bad tokens are skipped. */
export function getMerchantAccessActorId(source: HeaderSource): string | number | null {
    if (typeof source?.headers?.get !== 'function') return null
    for (const token of candidateTokens(source as Pick<Request, 'headers'>)) {
        try {
            const claim = (decodeJwt(token) as { impersonated_by?: unknown }).impersonated_by
            if (claim !== undefined) return typeof claim === 'number' ? claim : String(claim)
        } catch {
            // not a JWT: ignore
        }
    }
    return null
}

export function isMerchantAccessSession(source: HeaderSource): boolean {
    return getMerchantAccessActorId(source) !== null
}

/** Server-action variant: reads the current request's headers. */
export async function isMerchantAccessSessionFromHeaders(): Promise<boolean> {
    // Loaded on use: Users.ts imports this module and must not pull next/headers into the Payload config graph.
    const { headers } = await import('next/headers')
    return isMerchantAccessSession({ headers: await headers() })
}

/** Payload-style 403 for the Users staff endpoints. */
export function impersonationForbiddenResponse(): Response {
    return Response.json(
        { errors: [{ message: IMPERSONATION_FORBIDDEN }] },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
}
