/**
 * Distributed rate limiter using Upstash Redis.
 * Falls back to in-memory Map if Upstash is unavailable.
 *
 * Vercel serverless = each request may run on a different instance,
 * so in-memory rate limiting doesn't work. Upstash Redis provides
 * shared state across all instances via REST API (no TCP connection).
 *
 * Upstash is required on staging / production: without it every instance counts on its own (N instances = N× the
 * limit). That is logged once per instance at startup and shown by `/api/health?deep=1` (`rateLimit`).
 * When Upstash fails at runtime (error, or no answer within 1 s) a limit fails OPEN to the in-memory counter, except
 * `failClosed` limits (e.g. outbound email), which refuse until Upstash answers again. Logged at most once a
 * minute per instance.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'
import { deploymentName, isSharedDeployment, REDIS_TIMEOUT_MS } from './upstash-config'

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
    /** Set when a `failClosed` limit refused because the shared counter could not be read (not because it is used up). */
    unavailable?: true
}

export interface RateLimitOptions {
    /** Refuse (instead of counting in memory) when Upstash is configured but fails. For limits that guard sending email. */
    failClosed?: boolean
    /** Called on every check that fell back to the in-memory counter because Upstash failed (not `failClosed`). */
    onMemoryFallback?: (error: unknown) => void
}

export type RateLimitMode = 'upstash' | 'memory' | 'memory (NOT shared)'

/** Where limits are counted: Upstash, or this instance's memory (`NOT shared` on a deployed environment). */
export function rateLimitMode(env: NodeJS.ProcessEnv = process.env, configured: boolean = redis !== null): RateLimitMode {
    if (configured) return 'upstash'
    return isSharedDeployment(env) ? 'memory (NOT shared)' : 'memory'
}

let startupReported = false
/** One error per instance when a deployed environment runs without Upstash. Returns whether it logged. */
export function reportRateLimitMode(env: NodeJS.ProcessEnv = process.env, configured: boolean = redis !== null): boolean {
    if (startupReported || rateLimitMode(env, configured) !== 'memory (NOT shared)') return false
    startupReported = true
    console.error(
        `[rateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set on ${deploymentName(env)}: rate limits and shared caches are per instance (NOT shared). Set them in the Vercel dashboard.`,
    )
    return true
}
reportRateLimitMode()

const RUNTIME_LOG_EVERY_MS = 60_000
let lastRuntimeLogAt = -Infinity
function logUpstashFailure(error: unknown, failClosed: boolean): void {
    const now = Date.now()
    if (now - lastRuntimeLogAt < RUNTIME_LOG_EVERY_MS) return
    lastRuntimeLogAt = now
    console.error(
        `[rateLimit] Upstash unavailable (${error instanceof Error ? error.message : String(error)}); ${failClosed ? 'refusing fail-closed limits' : 'counting in memory'} until it answers (logged once a minute)`,
    )
}

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
            // the library's own deadline (default 5 s) answers "allowed" with reason "timeout"; checkRateLimit treats
            // that as a failure, like a thrown error
            timeout: REDIS_TIMEOUT_MS,
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

// ── QC load-test bypass ─────────────────────────────────────────────────
/**
 * On the isolated QC lane (Vercel scope `qc-test`), when explicitly opted in,
 * skip rate limiting so single-IP k6 load tests measure REAL app throughput
 * instead of just the limiter. Mirrors the OTP bypass pattern
 * (src/lib/otp/qc-bypass.ts): gated on BOTH the scope stamp AND an explicit
 * env flag — so it can NEVER activate on staging/production even by accident.
 *
 * Guard (both must hold):
 *   1. APP_ENV === 'qc-test'                 — Vercel scope stamp
 *   2. QC_RATELIMIT_BYPASS_ENABLED === 'true' — explicit opt-in per env
 */
function isQcRateLimitBypassEnabled(): boolean {
    return (
        // Server-only APP_ENV (TC-PERF-158): NEXT_PUBLIC_APP_ENV is a public build value, not a lane stamp.
        process.env.APP_ENV === 'qc-test'
        && process.env.QC_RATELIMIT_BYPASS_ENABLED === 'true'
    )
}

// ── Public API (same interface as before) ───────────────────────────────

/**
 * Check rate limit. Uses Upstash Redis if available, falls back to in-memory.
 * `failClosed`: when Upstash is configured but fails, refuse (`allowed: false, unavailable: true`) instead.
 */
export async function checkRateLimit(
    key: string,
    limit: number = 20,
    windowMs: number = 3600000,
    options: RateLimitOptions = {},
): Promise<RateLimitResult> {
    // QC load-test lane: allow everything (see isQcRateLimitBypassEnabled).
    if (isQcRateLimitBypassEnabled()) {
        return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
    }

    const limiter = getUpstashLimiter(limit, windowMs)
    if (limiter) {
        try {
            const result = await limiter.limit(key)
            if (result.reason === 'timeout') throw new Error(`no answer within ${REDIS_TIMEOUT_MS} ms`)
            return {
                allowed: result.success,
                remaining: result.remaining,
                resetAt: result.reset,
            }
        } catch (error) {
            const failClosed = options.failClosed === true
            logUpstashFailure(error, failClosed)
            if (failClosed) return { allowed: false, remaining: 0, resetAt: Date.now() + RUNTIME_LOG_EVERY_MS, unavailable: true }
            // Upstash down → fail-open with in-memory
            options.onMemoryFallback?.(error)
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

/** Tests only: forget that the startup error / the last runtime failure were logged. */
export function resetRateLimitLogState(): void {
    startupReported = false
    lastRuntimeLogAt = -Infinity
}
