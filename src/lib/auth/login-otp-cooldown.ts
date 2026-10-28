/**
 * Helpers for the login → send-otp handoff (GH-2053).
 * Pure/browser-safe: no React, no Next imports.
 */

/** sessionStorage keys shared with /verify-otp countdown hydration. */
export const OTP_RESEND_END_KEY = 'otp_resend_end'
export const OTP_EXPIRY_END_KEY = 'otp_expiry_end'

export type OtpSendFailure =
    | { kind: 'cooldown'; retryAfter: number; expiresIn: number }
    | { kind: 'failed' }

/** Classify a non-ok /api/users/send-otp response. */
export function parseOtpSendFailure(status: number, body: unknown): OtpSendFailure {
    const err = (body as { errors?: Array<{ code?: string; retryAfter?: unknown; expiresIn?: unknown }> } | null)?.errors?.[0]
    if (status === 429 && err?.code === 'OTP_COOLDOWN') {
        const retryAfter = Number(err.retryAfter)
        const expiresIn = Number(err.expiresIn)
        return {
            kind: 'cooldown',
            retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60,
            expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? Math.ceil(expiresIn) : 300,
        }
    }
    return { kind: 'failed' }
}

/** Seed /verify-otp countdowns so they reflect the OTP that was already sent. */
export function seedOtpTimers(retryAfter: number, expiresIn: number, now: number = Date.now()): void {
    sessionStorage.setItem(OTP_RESEND_END_KEY, String(now + retryAfter * 1000))
    sessionStorage.setItem(OTP_EXPIRY_END_KEY, String(now + expiresIn * 1000))
}
