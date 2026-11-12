// @vitest-environment node
/**
 * TC-PERF-181 — `POST /api/users/send-otp` send limits can't be used to lock a user out:
 *   the 60 s cooldown answers first and uses nothing up; the per-address limit (5 / 15 min) counts only real code
 *   emails to an existing user; E2E bypass sends are not counted; a refusal is `429 OTP_RATE_LIMITED` with
 *   `retryAfter` (+ `expiresIn` when the last code can still be entered); the per-IP limit (30 / 10 min) still
 *   answers before the address is looked up.
 * TC-PERF-182 — Upstash failing: both the per-IP and the per-address limit fall back to the in-memory per-instance
 *   counter (same limits, a loud `[send-otp]` log line on every such check), so login keeps working.
 * Real: collections/Users.ts send-otp, lib/email/outbound-email-limits.ts, lib/rateLimit.ts (in-memory counter and
 * the real @upstash/ratelimit client), lib/otp/*. Faked: Payload (one stored user row + sendEmail), the Upstash
 * Redis transport (TC-PERF-182 only: every command fails).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const upstash = vi.hoisted(() => ({ broken: null as unknown }))
vi.mock('@/lib/redis', () => ({
    get redis() {
        return upstash.broken
    },
}))

import { Users } from '@/collections/Users'
import { OTP_RESEND_COOLDOWN_MS } from '@/lib/otp/generate'
import { clearRateLimitMap } from '@/lib/rateLimit'

type StoredUser = { id: number; email: string; roles: string[]; tenants: unknown[]; otpHash?: string; otpExpiresAt?: string | null; otpAttempts?: number }

const sendOtp = (Users.endpoints || []).find((e) => e.path === '/send-otp' && e.method === 'post')!.handler as (req: unknown) => Promise<Response>

let stored: StoredUser | null
const find = vi.fn(async () => ({ docs: stored ? [{ ...stored }] : [] }))
const update = vi.fn(async ({ data }: { data: Partial<StoredUser> }) => {
    stored = { ...stored!, ...data }
    return stored
})
const sendEmail = vi.fn(async () => undefined)

function request(email: string, ip: string | null = '198.51.100.7') {
    return { json: async () => ({ email }), headers: new Headers(ip ? { 'x-real-ip': ip } : {}), payload: { find, update, sendEmail } }
}

/** Moves the stored code's send time back past the 60 s cooldown (the code itself stays valid). */
function passCooldown() {
    stored!.otpExpiresAt = new Date(new Date(stored!.otpExpiresAt!).getTime() - OTP_RESEND_COOLDOWN_MS - 1_000).toISOString()
}

async function errorOf(res: Response) {
    return ((await res.json()) as { errors: Array<Record<string, unknown>> }).errors[0]
}

beforeEach(() => {
    clearRateLimitMap()
    upstash.broken = null
    stored = { id: 7, email: 'owner@shop.my', roles: ['tenant-owner'], tenants: [] }
    find.mockClear()
    update.mockClear()
    sendEmail.mockClear()
    vi.stubEnv('MAIL_HOST', 'smtp.test')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('send-otp limits can not lock a user out [TC-PERF-181]', () => {
    it('cooldown answers do not use up the address allowance', async () => {
        // Arrange: one real send, then a burst of requests inside the cooldown (other tabs, an attacker)
        expect((await sendOtp(request('owner@shop.my'))).status).toBe(200)
        for (let i = 0; i < 10; i++) {
            const res = await sendOtp(request('owner@shop.my'))
            expect(res.status).toBe(429)
            expect((await errorOf(res)).code).toBe('OTP_COOLDOWN')
        }

        // Act: 4 more sends after each cooldown, the whole allowance is still there
        for (let i = 0; i < 4; i++) {
            passCooldown()
            expect((await sendOtp(request('owner@shop.my'))).status).toBe(200)
        }

        // Assert
        expect(sendEmail).toHaveBeenCalledTimes(5)
    })

    it('requests for unknown addresses never count against anyone', async () => {
        stored = null
        for (let i = 0; i < 8; i++) expect((await sendOtp(request('nobody@shop.my', `203.0.113.${i}`))).status).toBe(200)

        stored = { id: 7, email: 'nobody@shop.my', roles: ['tenant-owner'], tenants: [] }
        expect((await sendOtp(request('nobody@shop.my'))).status).toBe(200)
        expect(sendEmail).toHaveBeenCalledTimes(1)
    })

    it('the 6th real send in 15 min → 429 OTP_RATE_LIMITED with retryAfter and the still-valid code expiry, no email', async () => {
        // Arrange
        for (let i = 0; i < 5; i++) {
            if (i) passCooldown()
            await sendOtp(request('owner@shop.my'))
        }
        passCooldown()
        sendEmail.mockClear()
        update.mockClear()

        // Act
        const res = await sendOtp(request('owner@shop.my'))
        const error = await errorOf(res)

        // Assert
        expect(res.status).toBe(429)
        expect(error.code).toBe('OTP_RATE_LIMITED')
        expect(error.retryAfter).toBeGreaterThan(0)
        expect(error.retryAfter).toBeLessThanOrEqual(15 * 60)
        expect(error.expiresIn).toBeGreaterThan(0)
        expect(res.headers.get('Retry-After')).toBe(String(error.retryAfter))
        expect(sendEmail).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled() // the code already emailed stays valid
    })

    it('no expiresIn when the last code can no longer be entered (attempts used up)', async () => {
        for (let i = 0; i < 5; i++) {
            if (i) passCooldown()
            await sendOtp(request('owner@shop.my'))
        }
        passCooldown()
        stored!.otpAttempts = 5

        const error = await errorOf(await sendOtp(request('owner@shop.my')))

        expect(error.code).toBe('OTP_RATE_LIMITED')
        expect(error).not.toHaveProperty('expiresIn')
    })

    it('E2E bypass sends (no email) are not counted', async () => {
        vi.stubEnv('E2E_OTP_BYPASS_ENABLED', 'true')
        vi.stubEnv('E2E_TEST_OTP_CODE', '424242')
        vi.stubEnv('TEST_EMAIL', 'owner@shop.my')

        for (let i = 0; i < 8; i++) {
            if (i) passCooldown()
            expect((await sendOtp(request('owner@shop.my'))).status).toBe(200)
        }
        expect(sendEmail).not.toHaveBeenCalled()
    })

    it('per-IP limit still answers 429 OTP_RATE_LIMITED before the address is looked up', async () => {
        stored = null
        for (let i = 0; i < 30; i++) await sendOtp(request(`u${i}@shop.my`, '192.0.2.1'))
        find.mockClear()

        const res = await sendOtp(request('owner@shop.my', '192.0.2.1'))
        const error = await errorOf(res)

        expect(res.status).toBe(429)
        expect(error.code).toBe('OTP_RATE_LIMITED')
        expect(error).not.toHaveProperty('expiresIn')
        expect(find).not.toHaveBeenCalled()
    })
})

describe('send-otp with Upstash failing [TC-PERF-182]', () => {
    /** An Upstash client whose every command fails (outage / bad token); client setup (telemetry) is a no-op. */
    const failingRedis = () =>
        new Proxy({}, {
            get: (_target, prop) => {
                if (prop === 'then') return undefined
                if (prop === 'addTelemetry') return () => undefined
                return () => Promise.reject(new Error('upstash down'))
            },
        })

    it('per-IP limit falls back to the in-memory counter: the code is sent and the fallback is logged', async () => {
        // Arrange
        upstash.broken = failingRedis()

        // Act
        const res = await sendOtp(request('owner@shop.my', '198.51.100.9'))

        // Assert
        expect(res.status).toBe(200)
        expect(sendEmail).toHaveBeenCalledTimes(1)
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[send-otp] per-IP OTP send limit: Upstash unavailable'))
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[send-otp] per-address OTP send limit: Upstash unavailable'))
    })

    it('per-IP limit keeps its 30 / 10 min cap in memory: the 31st request → 429 OTP_RATE_LIMITED before any lookup', async () => {
        // Arrange
        upstash.broken = failingRedis()
        stored = null
        for (let i = 0; i < 30; i++) expect((await sendOtp(request(`u${i}@shop.my`, '192.0.2.44'))).status).toBe(200)
        find.mockClear()

        // Act
        const res = await sendOtp(request('owner@shop.my', '192.0.2.44'))

        // Assert
        expect(res.status).toBe(429)
        expect((await errorOf(res)).code).toBe('OTP_RATE_LIMITED')
        expect(find).not.toHaveBeenCalled()
    })

    it('per-address limit fails open to the in-memory counter (still capped at 5)', async () => {
        upstash.broken = failingRedis()

        // no client IP header: only the per-address limit applies
        const statuses: number[] = []
        for (let i = 0; i < 6; i++) {
            if (i) passCooldown()
            statuses.push((await sendOtp(request('owner@shop.my', null))).status)
        }

        expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
        expect(sendEmail).toHaveBeenCalledTimes(5)
    })
})
