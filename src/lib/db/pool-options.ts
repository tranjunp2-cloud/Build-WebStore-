/**
 * Limits for Payload's `pg` pool (one pool per server instance). Many Vercel instances × `max` must stay under what
 * the database accepts: with `DATABASE_URI` on the Neon `-pooler` host, 10 per instance is plenty. A full pool fails
 * a request after `connectionTimeoutMillis` (a clear error) instead of hanging it until the function's maxDuration.
 *
 * The connect timeout bounds each pool acquire, not the request: a page with N sequential queries can wait N × the
 * timeout when the pool is starved (40–75 s at 10 s in the 2026-10-23 stress test). The default stays 10 s because a
 * new connection must also wait for a suspended Neon compute to wake (the -pooler host does not hide that), so a
 * shorter default turns the first request after idle into a 503. With autosuspend off (production), set
 * `DATABASE_POOL_CONNECT_TIMEOUT_MS=3000`: the first acquire of most requests is the session lookup, which turns a
 * timeout into AuthUnavailableError → 503 / retry state, so a starved request ends after one short wait.
 * `statement_timeout` is deliberately not set here
 * (migrations and long reports share this pool).
 * Pure: the raw env strings come in, so it is unit-testable (TC-AISEC-010, TC-PERF-013..014).
 */

export const POOL_MAX_DEFAULT = 25
export const POOL_MAX_LIMIT = 50
export const POOL_CONNECT_TIMEOUT_DEFAULT_MS = 10_000
export const POOL_IDLE_TIMEOUT_MS = 10_000

export interface PoolLimits {
    max: number
    connectionTimeoutMillis: number
    idleTimeoutMillis: number
}

function positiveInt(raw: string | undefined): number | null {
    if (raw === undefined || raw.trim() === '') return null
    const value = Number(raw.trim())
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
}

/** `DATABASE_POOL_MAX` (1..50, default 25) and `DATABASE_POOL_CONNECT_TIMEOUT_MS` (default 3 s); junk = default. */
export function payloadPoolLimits(env: { max?: string; connectTimeoutMs?: string }): PoolLimits {
    const max = positiveInt(env.max)
    return {
        max: max === null ? POOL_MAX_DEFAULT : Math.min(Math.max(max, 1), POOL_MAX_LIMIT),
        connectionTimeoutMillis: positiveInt(env.connectTimeoutMs) ?? POOL_CONNECT_TIMEOUT_DEFAULT_MS,
        idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    }
}
