/**
 * DB-backed rate limiter for API routes.
 * Uses PostgreSQL rate_limits table for cross-instance consistency.
 * Falls back to in-memory Map if DB is unavailable (fail-open).
 */
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'

// In-memory fallback when DB is unavailable
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
}

/**
 * Check rate limit using DB. Falls back to in-memory if DB query fails.
 */
export async function checkRateLimit(
    key: string,
    limit: number = 20,
    windowMs: number = 3600000
): Promise<RateLimitResult> {
    try {
        return await checkRateLimitDB(key, limit, windowMs)
    } catch {
        // Fail-open: use in-memory fallback
        return checkRateLimitMemory(key, limit, windowMs)
    }
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

async function checkRateLimitDB(
    key: string,
    limit: number,
    windowMs: number
): Promise<RateLimitResult> {
    const payload = await getPayload({ config })
    const db = payload.db?.drizzle
    if (!db) throw new Error('DB not available')

    const now = new Date()
    const expiresAt = new Date(now.getTime() + windowMs)

    // Upsert: increment if not expired, reset if expired
    const result = await db.execute(sql`
        INSERT INTO rate_limits (key, count, window_start, expires_at)
        VALUES (${key}, 1, ${now}, ${expiresAt})
        ON CONFLICT (key) DO UPDATE SET
            count = CASE
                WHEN rate_limits.expires_at <= ${now} THEN 1
                ELSE rate_limits.count + 1
            END,
            window_start = CASE
                WHEN rate_limits.expires_at <= ${now} THEN ${now}
                ELSE rate_limits.window_start
            END,
            expires_at = CASE
                WHEN rate_limits.expires_at <= ${now} THEN ${expiresAt}
                ELSE rate_limits.expires_at
            END
        RETURNING count, expires_at
    `)

    const row = result.rows?.[0] as { count: number; expires_at: string } | undefined
    if (!row) throw new Error('No result from upsert')

    const count = Number(row.count)
    const resetAt = new Date(row.expires_at).getTime()

    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
    }
}

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

/**
 * Clears the in-memory rate limit map (used for testing).
 */
export function clearRateLimitMap(): void {
    rateLimitMap.clear()
}
