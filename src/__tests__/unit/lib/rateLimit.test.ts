import { checkRateLimit, clearRateLimitMap } from '@/lib/rateLimit'
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
