import { checkRateLimit, type RateLimitResult } from '@/lib/rateLimit'

/**
 * Rate limits in front of every email a request can make us send (OTP codes, buyer upload links, contact-form
 * notices). They are `failClosed`: when the shared counter (Upstash) cannot be read, no email goes out, so an
 * outage can't turn the endpoints into an unmetered mail relay (TC-PERF-159). Exception: the OTP send limits
 * (per IP and per address), which fall back to the per-instance counter so login keeps working during an Upstash
 * outage (TC-PERF-182), see `checkOtpSendIp` / `checkOtpSendEmail`.
 */
export const OTP_SEND_PER_EMAIL = { limit: 5, windowMs: 15 * 60_000 }
export const OTP_SEND_PER_IP = { limit: 30, windowMs: 10 * 60_000 }

/** The client IP Vercel / the proxy set (rightmost forwarded entry), or null when none was set. */
export function requestIp(headers: Pick<Headers, 'get'> | null | undefined): string | null {
    return headers?.get?.('x-real-ip')?.trim() || headers?.get?.('x-forwarded-for')?.split(',').at(-1)?.trim() || null
}

/** One fail-closed check per key; false = do not send. */
export async function allowOutboundEmail(key: string, limit: number, windowMs: number): Promise<boolean> {
    const result = await checkRateLimit(`email:${key}`, limit, windowMs, { failClosed: true })
    return result.allowed
}

/** Answer of one OTP send limit: `retryAfter` in whole seconds. */
export type OtpLimitCheck = { allowed: true } | { allowed: false; retryAfter: number }

function toOtpLimitCheck(result: RateLimitResult): OtpLimitCheck {
    if (result.allowed) return { allowed: true }
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)) }
}

/** Loud line on every OTP limit check that ran on this instance's own counter because Upstash failed. */
function logOtpLimitFallback(limitName: 'per-IP' | 'per-address') {
    return (error: unknown) => {
        console.error(
            `[send-otp] ${limitName} OTP send limit: Upstash unavailable (${error instanceof Error ? error.message : String(error)}); counting on this instance only (limits not shared across instances) until it answers`,
        )
    }
}

/**
 * OTP send, per client IP (30 / 10 min): checked first, before the address is looked up, so the answer says nothing
 * about it. When Upstash fails it falls back to the per-instance counter with the same limit and logs it on every
 * check (TC-PERF-182): refusing would lock everybody out of login during an Upstash outage, while the per-instance
 * count, the per-address limit and the 60 s cooldown on the user row still cap the mail sent.
 */
export async function checkOtpSendIp(ip: string | null): Promise<OtpLimitCheck> {
    if (!ip) return { allowed: true }
    return toOtpLimitCheck(await checkRateLimit(`email:otp-ip:${ip}`, OTP_SEND_PER_IP.limit, OTP_SEND_PER_IP.windowMs, {
        onMemoryFallback: logOtpLimitFallback('per-IP'),
    }))
}

/**
 * OTP send, per address: counted only for an existing user and only for a code that is really sent (after the
 * 60 s cooldown answered), so nobody can use up an address's allowance with requests that send nothing
 * (TC-PERF-181). Fail-OPEN to the per-instance counter when Upstash fails (logged on every check): the
 * 60 s cooldown stored on the user row still caps a single address at one email a minute, and refusing here would
 * lock every user out of login during an Upstash outage (TC-PERF-182).
 */
export async function checkOtpSendEmail(email: string): Promise<OtpLimitCheck> {
    return toOtpLimitCheck(await checkRateLimit(`email:otp:${email.trim().toLowerCase()}`, OTP_SEND_PER_EMAIL.limit, OTP_SEND_PER_EMAIL.windowMs, {
        onMemoryFallback: logOtpLimitFallback('per-address'),
    }))
}
