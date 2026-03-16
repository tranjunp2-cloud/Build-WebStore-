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
        for (const [userId, entry] of rateLimitMap.entries()) {
            if (now > entry.resetAt) {
                rateLimitMap.delete(userId)
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
 * @param userId Unique identifier for the user (usually user.id)
 * @param limit Maximum number of requests allowed in the window (default: 10)
 * @param windowMs Time window in milliseconds (default: 1 hour)
 * @returns RateLimitResult
 */
export function checkRateLimit(
    userId: string,
    limit: number = 20,
    windowMs: number = 3600000 // 1 hour
): RateLimitResult {
    const now = Date.now()
    const entry = rateLimitMap.get(userId)

    // Clear expired entries periodically or on check
    if (!entry || now > entry.resetAt) {
        const newEntry = { count: 1, resetAt: now + windowMs }
        rateLimitMap.set(userId, newEntry)
        return {
            allowed: true,
            remaining: limit - 1,
            resetAt: newEntry.resetAt
        }
    }

    if (entry.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt
        }
    }

    entry.count++
    return {
        allowed: true,
        remaining: limit - entry.count,
        resetAt: entry.resetAt
    }
}

/**
 * Clears the rate limit map (used for testing).
 */
export function clearRateLimitMap(): void {
    rateLimitMap.clear()
}
