/**
 * Distributed rate limiter using Upstash Redis.
 * Falls back to in-memory Map if Upstash is unavailable.
 *
 * Vercel serverless = each request may run on a different instance,
 * so in-memory rate limiting doesn't work. Upstash Redis provides
 * shared state across all instances via REST API (no TCP connection).
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
}

// ── Upstash Redis (distributed) ─────────────────────────────────────────
const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = hasUpstash
    ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null

// Pre-configured limiters for common use cases
const limiters = new Map<string, Ratelimit>()

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
    if (!redis) return null
    const key = `${limit}:${windowMs}`
    if (!limiters.has(key)) {
        const windowStr = windowMs >= 3600000 ? `${windowMs / 3600000}h`
            : windowMs >= 60000 ? `${windowMs / 60000}m`
            : `${windowMs / 1000}s`
        limiters.set(key, new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, windowStr as Parameters<typeof Ratelimit.slidingWindow>[1]),
            prefix: 'rl',
        }))
    }
    return limiters.get(key)!
}

// ── In-memory fallback ──────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimitMemory(
    key: string,
    limit: number,
    windowMs: number
): RateLimitResult {
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
        const newEntry = { count: 1, resetAt: now + windowMs }
        rateLimitMap.set(key, newEntry)
        return { allowed: true, remaining: limit - 1, resetAt: newEntry.resetAt }
    }

    if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ── Public API (same interface as before) ───────────────────────────────

/**
 * Check rate limit. Uses Upstash Redis if available, falls back to in-memory.
 */
export async function checkRateLimit(
    key: string,
    limit: number = 20,
    windowMs: number = 3600000
): Promise<RateLimitResult> {
    const limiter = getUpstashLimiter(limit, windowMs)
    if (limiter) {
        try {
            const result = await limiter.limit(key)
            return {
                allowed: result.success,
                remaining: result.remaining,
                resetAt: result.reset,
            }
        } catch {
            // Upstash down → fail-open with in-memory
            return checkRateLimitMemory(key, limit, windowMs)
        }
    }
    return checkRateLimitMemory(key, limit, windowMs)
}

/**
 * Two-tier rate limit: burst (per minute) + sustained (per hour).
 */
export async function checkTwoTierRateLimit(
    userId: string,
    burstLimit: number = 5,
    sustainedLimit: number = 20
): Promise<RateLimitResult> {
    const minuteResult = await checkRateLimit(`${userId}:minute`, burstLimit, 60_000)
    if (!minuteResult.allowed) return minuteResult

    const hourResult = await checkRateLimit(`${userId}:hour`, sustainedLimit, 3_600_000)
    if (!hourResult.allowed) return hourResult

    return {
        allowed: true,
        remaining: Math.min(minuteResult.remaining, hourResult.remaining),
        resetAt: minuteResult.resetAt,
    }
}

/**
 * Clears the in-memory rate limit map (used for testing).
 */
export function clearRateLimitMap(): void {
    rateLimitMap.clear()
}
