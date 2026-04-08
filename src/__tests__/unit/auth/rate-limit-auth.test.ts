/**
 * F02 Auth Flow — Rate Limiter Unit Tests
 *
 * QA Coverage Map (docs/qa/F02-auth.md):
 *   TC-F02.26: 60s Resend OTP Cooldown
 *   TC-F02.42: DDoS protection / Rate limiting forgot password
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, clearRateLimitMap } from '@/lib/rateLimit'

beforeEach(() => {
    clearRateLimitMap()
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F02.42: Rate Limiting / Anti-DDoS
// ═══════════════════════════════════════════════════════════════════════════
describe('checkRateLimit (TC-F02.42: rate limiting)', () => {
    it('allows first request', () => {
        const result = checkRateLimit('user-1', 5, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
    })

    it('decrements remaining on each call', () => {
        checkRateLimit('user-2', 5, 60000)
        const result = checkRateLimit('user-2', 5, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(3)
    })

    it('blocks after limit reached (TC-F02.42: 429 traffic)', () => {
        const limit = 3
        checkRateLimit('user-3', limit, 60000)
        checkRateLimit('user-3', limit, 60000)
        checkRateLimit('user-3', limit, 60000) // 3rd = at limit

        const blocked = checkRateLimit('user-3', limit, 60000)
        expect(blocked.allowed).toBe(false)
        expect(blocked.remaining).toBe(0)
    })

    it('tracks users independently', () => {
        checkRateLimit('user-a', 2, 60000)
        checkRateLimit('user-a', 2, 60000)

        // user-a exhausted, but user-b still OK
        const blockedA = checkRateLimit('user-a', 2, 60000)
        const allowedB = checkRateLimit('user-b', 2, 60000)

        expect(blockedA.allowed).toBe(false)
        expect(allowedB.allowed).toBe(true)
    })

    it('provides resetAt timestamp in the future', () => {
        const result = checkRateLimit('user-4', 10, 3600000)
        expect(result.resetAt).toBeGreaterThan(Date.now())
    })

    it('clearRateLimitMap allows requests again (for testing)', () => {
        const limit = 1
        checkRateLimit('user-5', limit, 60000) // exhaust
        const blocked = checkRateLimit('user-5', limit, 60000)
        expect(blocked.allowed).toBe(false)

        clearRateLimitMap()

        const fresh = checkRateLimit('user-5', limit, 60000)
        expect(fresh.allowed).toBe(true)
    })

    it('simulates 40 requests hitting rate limit (TC-F02.42 scenario)', () => {
        const limit = 20 // default limit
        // Fire 20 requests (allowed)
        for (let i = 0; i < limit; i++) {
            const r = checkRateLimit('attacker', limit, 3600000)
            expect(r.allowed).toBe(true)
        }
        // 21st request blocked
        const blocked = checkRateLimit('attacker', limit, 3600000)
        expect(blocked.allowed).toBe(false)
        expect(blocked.remaining).toBe(0)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F02.26: Resend OTP Cooldown (60s anti-spam)
// ═══════════════════════════════════════════════════════════════════════════
describe('checkRateLimit for OTP resend (TC-F02.26: 60s cooldown)', () => {
    it('allows only 1 resend per 60s window', () => {
        const cooldownLimit = 1
        const cooldownWindowMs = 60_000

        const first = checkRateLimit('otp-resend-user1', cooldownLimit, cooldownWindowMs)
        expect(first.allowed).toBe(true)

        const second = checkRateLimit('otp-resend-user1', cooldownLimit, cooldownWindowMs)
        expect(second.allowed).toBe(false)
        expect(second.remaining).toBe(0)
    })
})
