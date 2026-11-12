import { decodeJwt, decodeProtectedHeader } from 'jose'

/**
 * Edge routing hint for the Payload admin panel (TC-PERF-154). Payload's admin pages render the signed-in user with
 * its memberships populated (whole tenant rows: Xendit / EasyParcel / ECH secrets) into the RSC payload, even on
 * the "unauthorized" redirect a tenant user gets. A tenant user's password-step token (Payload's own, no
 * `mfa_verified`) therefore must not reach /admin at all. Unverified decode is enough here: a forged token fails
 * Payload's signature check and renders no user; Payload still enforces `access.admin` (super-admin only).
 */
export function isPreOtpTenantPayloadToken(token: string | undefined | null): boolean {
    if (!token) return false
    try {
        if (decodeProtectedHeader(token).authVersion !== 1) return false // app (OTP / SSO) tokens: Payload ignores them
        const claims = decodeJwt(token) as { mfa_verified?: unknown; roles?: unknown }
        if (claims.mfa_verified === true) return false
        return !(Array.isArray(claims.roles) && claims.roles.includes('super-admin'))
    } catch {
        return false
    }
}
