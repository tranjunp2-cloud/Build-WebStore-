/**
 * pg-pool's own acquire timeout (`connectionTimeoutMillis`, pool-options.ts): "timeout exceeded when trying to
 * connect", possibly wrapped by drizzle (`Failed query: …`, cause = the pg error). Walks the cause chain.
 */
export function isPoolAcquireTimeout(error: unknown): boolean {
    let current: unknown = error
    for (let depth = 0; current && depth < 5; depth++) {
        const message = current instanceof Error ? current.message : typeof current === 'string' ? current : ''
        if (message.includes('timeout exceeded when trying to connect')) return true
        current = (current as { cause?: unknown }).cause
    }
    return false
}
