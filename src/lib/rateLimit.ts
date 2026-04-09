/**
 * Simple in-memory rate limiter for AI routes.
 * In a production environment with multiple instances, this should be replaced
 * with a Redis-based rate limiter.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const CLEANUP_INTERVAL = 3600000 // 1 hour

// Run cleanup every hour to prevent memory leaks
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of rateLimitMap.entries()) {
            if (now > entry.resetAt) {
                rateLimitMap.delete(key)
            }
        }
    }, CLEANUP_INTERVAL)
}

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
}

/**
 * Checks if a user has exceeded the rate limit.
 *
 * @param key    Unique key (userId, IP, or composite key like `${userId}:minute`)
 * @param limit  Maximum number of requests allowed in the window (default: 20)
 * @param windowMs Time window in milliseconds (default: 1 hour)
 * @returns RateLimitResult
 */
export function checkRateLimit(
    key: string,
    limit: number = 20,
    windowMs: number = 3600000 // 1 hour
): RateLimitResult {
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
        const newEntry = { count: 1, resetAt: now + windowMs }
        rateLimitMap.set(key, newEntry)
        return {
            allowed: true,
            remaining: limit - 1,
            resetAt: newEntry.resetAt,
        }
    }

    if (entry.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
        }
    }

    entry.count++
    return {
        allowed: true,
        remaining: limit - entry.count,
        resetAt: entry.resetAt,
    }
}

/**
 * Two-tier rate limit check: burst (per minute) + sustained (per hour).
 * Returns the first failing tier, or allowed if both pass.
 *
 * @param userId         Unique user ID
 * @param burstLimit     Max requests per minute (default: 5)
 * @param sustainedLimit Max requests per hour (default: 20)
 */
export function checkTwoTierRateLimit(
    userId: string,
    burstLimit: number = 5,
    sustainedLimit: number = 20
): RateLimitResult {
    // Check per-minute burst limit first
    const minuteResult = checkRateLimit(`${userId}:minute`, burstLimit, 60_000)
    if (!minuteResult.allowed) {
        return minuteResult
    }

    // Then check per-hour sustained limit
    const hourResult = checkRateLimit(`${userId}:hour`, sustainedLimit, 3_600_000)
    if (!hourResult.allowed) {
        return hourResult
    }

    // Return the more restrictive remaining count
    return {
        allowed: true,
        remaining: Math.min(minuteResult.remaining, hourResult.remaining),
        resetAt: minuteResult.resetAt, // burst resets sooner — more relevant to user
    }
}

/**
 * Clears the rate limit map (used for testing).
 */
export function clearRateLimitMap(): void {
    rateLimitMap.clear()
}
