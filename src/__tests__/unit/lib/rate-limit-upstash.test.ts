/**
 * TC-PERF-033..035 — Upstash is required on staging / production; runtime failures fail open, outbound email closed.
 * TC-PERF-033: without Upstash on VERCEL_ENV production / preview (staging = preview + VERCEL_TARGET_ENV=staging) the
 *              mode is "memory (NOT shared)", logged once per instance and shown by /api/health?deep=1; local = "memory".
 * TC-PERF-034: Upstash throws or times out (the library's `reason: "timeout"`) → a normal limit counts in memory (fails
 *              open), a `failClosed` limit refuses with `unavailable`; failures logged at most once a minute; the
 *              limiter is built with a 1 s timeout.
 * TC-PERF-035: the Upstash client is built with retry { retries: 1 } and a fresh 1 s AbortSignal per command.
 * Real: rateLimit.ts, redis.ts, upstash-config.ts, the health route. Faked: @upstash/ratelimit (limit() scripted), @upstash/redis
 * constructor (captured), the Upstash env.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
    limit: vi.fn(),
    limiterOptions: [] as Array<Record<string, unknown>>,
    redisOptions: [] as Array<Record<string, unknown>>,
}))

vi.mock('@upstash/ratelimit', () => ({
    Ratelimit: class {
        static slidingWindow = vi.fn(() => 'sliding')
        limit = h.limit
        constructor(options: Record<string, unknown>) {
            h.limiterOptions.push(options)
        }
    },
}))
vi.mock('@upstash/redis', () => ({
    Redis: class {
        constructor(options: Record<string, unknown>) {
            h.redisOptions.push(options)
        }
    },
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: vi.fn(async () => ({ docs: [] })) })) }))
vi.mock('@/payload.config', () => ({ default: {} }))

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VERCEL_ENV', 'VERCEL_TARGET_ENV'] as const
const saved: Record<string, string | undefined> = {}

async function loadRateLimit(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
    for (const key of ENV_KEYS) delete process.env[key]
    Object.assign(process.env, env)
    vi.resetModules()
    return import('@/lib/rateLimit')
}

beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    h.limit.mockReset()
    h.limiterOptions.length = 0
    h.redisOptions.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T03:00:00Z'))
})
afterEach(() => {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
    }
    vi.useRealTimers()
    vi.restoreAllMocks()
})

const UPSTASH = { UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'token' }

describe('Upstash required on deployed environments [TC-PERF-033]', () => {
    it('reports "memory (NOT shared)" on production / preview / staging without Upstash, "memory" locally, "upstash" when set', async () => {
        const { rateLimitMode } = await loadRateLimit({})

        expect(rateLimitMode({ VERCEL_ENV: 'production' } as NodeJS.ProcessEnv, false)).toBe('memory (NOT shared)')
        expect(rateLimitMode({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging' } as NodeJS.ProcessEnv, false)).toBe('memory (NOT shared)')
        expect(rateLimitMode({ VERCEL_ENV: 'development' } as NodeJS.ProcessEnv, false)).toBe('memory')
        expect(rateLimitMode({} as NodeJS.ProcessEnv, false)).toBe('memory')
        expect(rateLimitMode({ VERCEL_ENV: 'production' } as NodeJS.ProcessEnv, true)).toBe('upstash')
    })

    it('logs one error at startup on staging without Upstash (not again), none locally', async () => {
        // Arrange
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        // Act — module load = instance startup
        const staging = await loadRateLimit({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging' })
        const again = staging.reportRateLimitMode()
        const startupLogs = error.mock.calls.length
        await loadRateLimit({})

        // Assert
        expect(startupLogs).toBe(1)
        expect(String(error.mock.calls[0][0])).toContain('NOT shared')
        expect(String(error.mock.calls[0][0])).toContain('staging')
        expect(again).toBe(false)
        expect(error).toHaveBeenCalledTimes(1)
    })

    it('/api/health?deep=1 shows rateLimit "memory (NOT shared)" on production without Upstash', async () => {
        // Arrange
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        await loadRateLimit({ VERCEL_ENV: 'production' })
        const { GET } = await import('@/app/api/health/route')
        const { NextRequest } = await import('next/server')

        // Act
        const res = await GET(new NextRequest(new URL('http://localhost:3000/api/health?deep=1')))
        const body = await res.json()

        // Assert
        expect(body.rateLimit).toBe('memory (NOT shared)')
        expect(body.sharedCache).toBe('memory')
    })
})

describe('Upstash failing at runtime [TC-PERF-034]', () => {
    it('a normal limit fails open to the in-memory counter; the limiter has a 1 s timeout', async () => {
        // Arrange
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        h.limit.mockRejectedValue(new Error('fetch failed'))
        const { checkRateLimit } = await loadRateLimit({ ...UPSTASH, VERCEL_ENV: 'production' })

        // Act
        const results = [await checkRateLimit('k', 2, 60_000), await checkRateLimit('k', 2, 60_000), await checkRateLimit('k', 2, 60_000)]

        // Assert — counted in memory: 2 allowed, the 3rd refused
        expect(results.map((r) => r.allowed)).toEqual([true, true, false])
        expect(results.some((r) => r.unavailable)).toBe(false)
        expect(h.limiterOptions[0]).toMatchObject({ timeout: 1_000 })
        expect(error).toHaveBeenCalledTimes(1) // once a minute, not per call
    })

    it('a failClosed limit (outbound email) refuses with unavailable on an error or a timeout answer', async () => {
        // Arrange
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const { checkRateLimit } = await loadRateLimit({ ...UPSTASH, VERCEL_ENV: 'production' })
        h.limit.mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce({ success: true, remaining: 19, reset: 0, reason: 'timeout' })

        // Act
        const onError = await checkRateLimit('lead-reply:1', 20, 3_600_000, { failClosed: true })
        const onTimeout = await checkRateLimit('lead-reply:1', 20, 3_600_000, { failClosed: true })

        // Assert
        expect(onError).toMatchObject({ allowed: false, unavailable: true })
        expect(onTimeout).toMatchObject({ allowed: false, unavailable: true })
    })

    it('logs the runtime failure again after a minute', async () => {
        // Arrange
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        h.limit.mockRejectedValue(new Error('fetch failed'))
        const { checkRateLimit } = await loadRateLimit({ ...UPSTASH })

        // Act
        await checkRateLimit('a', 5, 60_000)
        vi.advanceTimersByTime(30_000)
        await checkRateLimit('a', 5, 60_000)
        vi.advanceTimersByTime(30_001)
        await checkRateLimit('a', 5, 60_000)

        // Assert
        expect(error).toHaveBeenCalledTimes(2)
    })

    it('a healthy Upstash answer is used as is', async () => {
        h.limit.mockResolvedValue({ success: false, remaining: 0, reset: 123 })
        const { checkRateLimit } = await loadRateLimit({ ...UPSTASH })

        expect(await checkRateLimit('a', 5, 60_000, { failClosed: true })).toEqual({ allowed: false, remaining: 0, resetAt: 123 })
    })
})

describe('Upstash client: 1 retry, 1 s per command [TC-PERF-035]', () => {
    it('builds the client with retry { retries: 1 } and a fresh 1 s timeout signal per command', async () => {
        // Act
        await loadRateLimit({ ...UPSTASH })
        const options = h.redisOptions[0] as { retry: { retries: number; backoff: (n: number) => number }; signal: () => AbortSignal }
        const first = options.signal()
        const second = options.signal()
        vi.useRealTimers()
        await new Promise((resolve) => setTimeout(resolve, 1_100))

        // Assert
        expect(h.redisOptions).toHaveLength(1)
        expect(options.retry.retries).toBe(1)
        expect(options.retry.backoff(0)).toBe(100)
        expect(first).not.toBe(second)
        expect(first.aborted).toBe(true)
    })

    it('builds no client without both Upstash values', async () => {
        await loadRateLimit({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' })

        expect(h.redisOptions).toHaveLength(0)
    })
})
