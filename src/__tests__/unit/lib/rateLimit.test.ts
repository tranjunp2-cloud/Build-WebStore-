import { checkRateLimit, checkTwoTierRateLimit, clearRateLimitMap } from '@/lib/rateLimit'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock payload to avoid DB calls — tests use in-memory fallback
vi.mock('payload', () => ({
    getPayload: vi.fn().mockRejectedValue(new Error('No DB in tests')),
}))
vi.mock('@payload-config', () => ({ default: {} }))

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

    it('should allow requests within the limit', async () => {
        const result = await checkRateLimit(userId, 5)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
    })

    it('should block requests exceeding the limit', async () => {
        for (let i = 0; i < 5; i++) {
            await checkRateLimit(userId, 5)
        }

        const blockedResult = await checkRateLimit(userId, 5)
        expect(blockedResult.allowed).toBe(false)
        expect(blockedResult.remaining).toBe(0)
    })

    it('should reset limit after the window expires', async () => {
        for (let i = 0; i < 5; i++) {
            await checkRateLimit(userId, 5, 1000)
        }

        expect((await checkRateLimit(userId, 5, 1000)).allowed).toBe(false)

        const newTime = new Date('2026-03-16T10:00:01.100Z')
        vi.setSystemTime(newTime)

        const resetResult = await checkRateLimit(userId, 5, 1000)
        expect(resetResult.allowed).toBe(true)
        expect(resetResult.remaining).toBe(4)
    })

    it('should handle multiple users independently', async () => {
        const userA = 'user-a'
        const userB = 'user-b'

        for (let i = 0; i < 5; i++) {
            await checkRateLimit(userA, 5)
        }
        expect((await checkRateLimit(userA, 5)).allowed).toBe(false)

        expect((await checkRateLimit(userB, 5)).allowed).toBe(true)
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

    it('allows requests within both tiers', async () => {
        const result = await checkTwoTierRateLimit('user-1', 5, 20)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBeGreaterThanOrEqual(0)
    })

    it('blocks on burst limit (per-minute) before hourly limit is hit', async () => {
        for (let i = 0; i < 5; i++) {
            await checkTwoTierRateLimit('user-2', 5, 20)
        }
        const blocked = await checkTwoTierRateLimit('user-2', 5, 20)
        expect(blocked.allowed).toBe(false)
        expect(blocked.remaining).toBe(0)
    })

    it('resets burst limit after 1 minute and continues under hourly limit', async () => {
        for (let i = 0; i < 5; i++) {
            await checkTwoTierRateLimit('user-3', 5, 20)
        }
        expect((await checkTwoTierRateLimit('user-3', 5, 20)).allowed).toBe(false)

        vi.setSystemTime(new Date('2026-03-16T10:01:01Z'))
        const afterReset = await checkTwoTierRateLimit('user-3', 5, 20)
        expect(afterReset.allowed).toBe(true)
    })

    it('blocks on hourly limit even after burst resets', async () => {
        for (let minute = 0; minute < 4; minute++) {
            vi.setSystemTime(new Date(Date.now() + minute * 61000))
            for (let i = 0; i < 5; i++) {
                await checkTwoTierRateLimit('user-4', 5, 20)
            }
        }
        vi.setSystemTime(new Date(Date.now() + 5 * 61000))
        const blocked = await checkTwoTierRateLimit('user-4', 5, 20)
        expect(blocked.allowed).toBe(false)
    })

    it('returns resetAt for the burst window (sooner than hourly)', async () => {
        const result = await checkTwoTierRateLimit('user-5', 5, 20)
        expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60_000 + 1)
    })
})
