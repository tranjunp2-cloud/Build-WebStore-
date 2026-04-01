import { checkRateLimit, checkTwoTierRateLimit, clearRateLimitMap } from '@/lib/rateLimit'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Rate Limiter Utility', () => {
    const userId = 'test-user-123'

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-16T10:00:00Z'))
        clearRateLimitMap()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should allow requests within the limit', () => {
        const result = checkRateLimit(userId, 5)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
    })

    it('should block requests exceeding the limit', () => {
        // Use up all 5 requests
        for (let i = 0; i < 5; i++) {
            checkRateLimit(userId, 5)
        }
        
        const blockedResult = checkRateLimit(userId, 5)
        expect(blockedResult.allowed).toBe(false)
        expect(blockedResult.remaining).toBe(0)
    })

    it('should reset limit after the window expires', () => {
        // Use up all requests
        for (let i = 0; i < 5; i++) {
            checkRateLimit(userId, 5, 1000) // 1 second window
        }

        expect(checkRateLimit(userId, 5, 1000).allowed).toBe(false)

        // Advance time by 1.1 seconds using setSystemTime
        const newTime = new Date('2026-03-16T10:00:01.100Z')
        vi.setSystemTime(newTime)

        const resetResult = checkRateLimit(userId, 5, 1000)
        expect(resetResult.allowed).toBe(true)
        expect(resetResult.remaining).toBe(4)
    })

    it('should handle multiple users independently', () => {
        const userA = 'user-a'
        const userB = 'user-b'

        // Exhaust user A
        for (let i = 0; i < 5; i++) {
            checkRateLimit(userA, 5)
        }
        expect(checkRateLimit(userA, 5).allowed).toBe(false)

        // User B should still be allowed
        expect(checkRateLimit(userB, 5).allowed).toBe(true)
    })
})

describe('checkTwoTierRateLimit', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-16T10:00:00Z'))
        clearRateLimitMap()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('allows requests within both tiers', () => {
        const result = checkTwoTierRateLimit('user-1', 5, 20)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBeGreaterThanOrEqual(0)
    })

    it('blocks on burst limit (per-minute) before hourly limit is hit', () => {
        // Hit burst limit (5/min)
        for (let i = 0; i < 5; i++) {
            checkTwoTierRateLimit('user-2', 5, 20)
        }
        const blocked = checkTwoTierRateLimit('user-2', 5, 20)
        expect(blocked.allowed).toBe(false)
        expect(blocked.remaining).toBe(0)
    })

    it('resets burst limit after 1 minute and continues under hourly limit', () => {
        // Hit burst limit
        for (let i = 0; i < 5; i++) {
            checkTwoTierRateLimit('user-3', 5, 20)
        }
        expect(checkTwoTierRateLimit('user-3', 5, 20).allowed).toBe(false)

        // Advance 1 minute — burst window resets
        vi.setSystemTime(new Date('2026-03-16T10:01:01Z'))
        const afterReset = checkTwoTierRateLimit('user-3', 5, 20)
        expect(afterReset.allowed).toBe(true)
    })

    it('blocks on hourly limit even after burst resets', () => {
        // Use 20 hourly credits across multiple burst windows
        for (let minute = 0; minute < 4; minute++) {
            vi.setSystemTime(new Date(Date.now() + minute * 61000))
            for (let i = 0; i < 5; i++) {
                checkTwoTierRateLimit('user-4', 5, 20)
            }
        }
        // Advance to a new burst window but hourly limit exhausted
        vi.setSystemTime(new Date(Date.now() + 5 * 61000))
        const blocked = checkTwoTierRateLimit('user-4', 5, 20)
        expect(blocked.allowed).toBe(false)
    })

    it('returns resetAt for the burst window (sooner than hourly)', () => {
        const result = checkTwoTierRateLimit('user-5', 5, 20)
        expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60_000 + 1)
    })
})
