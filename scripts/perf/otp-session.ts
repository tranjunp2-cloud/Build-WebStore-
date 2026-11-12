/**
 * Signed-in session for the measurement scripts, as the login screen ends it: POST /api/users/verify-otp.
 * The password step alone (POST /api/users/login) no longer opens app routes for a tenant user (TC-PERF-142).
 *
 * The code is E2E_TEST_OTP_CODE when it is six digits (the server's E2E bypass, TEST_EMAIL only), else 000000,
 * which a local `next dev` server (NODE_ENV=development) accepts for any account — the rule e2e/auth.setup.ts uses.
 * send-otp is not called, like the k6 scripts here: neither bypass needs a stored code, and it would mail the
 * throwaway benchmark addresses and run into the per-IP send limit.
 */
export type OtpSession = {
    /** `payload-token=<jwt>` for a Cookie header. */
    cookie: string
    /** The target's origin: a cookie-authenticated write without a same-host Origin is refused (TC-PERF-162). */
    origin: string
}

export function otpBypassCode(): string {
    const configured = process.env.E2E_TEST_OTP_CODE
    return configured && /^\d{6}$/.test(configured) ? configured : '000000'
}

export async function createOtpSession(base: string, email: string, otp: string = otpBypassCode()): Promise<OtpSession> {
    const response = await fetch(`${base}/api/users/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
    })
    if (!response.ok) throw new Error(`verify-otp failed: ${response.status} ${await response.text()}`)
    const { token } = await response.json() as { token?: unknown }
    if (typeof token !== 'string' || !token) throw new Error('verify-otp returned no session token')
    return { cookie: `payload-token=${token}`, origin: new URL(base).origin }
}
