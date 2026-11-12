/**
 * Upstash client settings and "is this a shared (multi-instance) deployment" — no client here, so modules and tests
 * can read them without building one (src/lib/redis.ts builds the client).
 */

/** Budget for one Upstash command, both tries together. */
export const REDIS_TIMEOUT_MS = 1_000
/** One retry, 100 ms after the first failure. */
export const REDIS_RETRY = { retries: 1, backoff: () => 100 } as const

/**
 * Deployed on Vercel (production, or preview — the `staging` custom environment runs with VERCEL_ENV=preview and
 * VERCEL_TARGET_ENV=staging). There, state kept in one instance's memory is not shared with the others.
 */
export function isSharedDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
}

/** Name of the deployment for log lines: `staging`, `production`, `preview`, or `local`. */
export function deploymentName(env: NodeJS.ProcessEnv = process.env): string {
    return env.VERCEL_TARGET_ENV || env.VERCEL_ENV || 'local'
}
