// Retry wrapper for transient Payload/Neon errors.
//
// Why this exists (plan 260415-1745 fix 500):
//   Vercel logs showed ~180 hits per 24h of "Cannot read properties of
//   undefined (reading title)" + "Failed query deadlock detected" plus
//   _pages_v_blocks child table parent_id_fk violations on api sites save.
//
//   Root cause: Payload drafts/versions writes to _pages_v and
//   _pages_v_blocks child tables on every page update. Concurrent autosave
//   (browser tabs, 5s interval) triggers UPDATE _pages_v SET latest=false
//   races leading to Postgres deadlock. The transaction rolls back, and
//   Payload sometimes then throws a TypeError reading a stale doc property.
//
//   These are all TRANSIENT — retrying after a short backoff succeeds.
//
// Usage:
//   await withPayloadRetry(() => payload.update({ collection, id, data }))

export type TransientErrorKind = 'deadlock' | 'fk-violation' | 'type-error-title'

interface RetryOptions {
    maxRetries?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, kind: TransientErrorKind, error: unknown) => void
}

/** Detect transient errors that benefit from retry. */
export function classifyTransientError(err: unknown): TransientErrorKind | null {
    if (!err) return null
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('deadlock detected')) return 'deadlock'
    // Payload versions child-table FK races that resolve on retry
    if (msg.includes('_pages_v_blocks_') && msg.includes('parent_id_fk')) return 'fk-violation'
    if (msg.includes('pages_blocks_') && msg.includes('parent_id_fk')) return 'fk-violation'
    // BUG-F05-01: image/avatar FK violations in nested block tables are also transient
    if (/pages_blocks_[a-z_]*(image_id|avatar_id|logo_id)/.test(msg) && /violates|foreign key|constraint/i.test(msg)) return 'fk-violation'
    // Known symptom of a post-deadlock stale doc (Payload internals trying
    // to read .title after the version rollback)
    if (err instanceof TypeError && msg.includes("reading 'title'")) return 'type-error-title'
    return null
}

/**
 * Run `fn`. On transient errors, retry up to `maxRetries` with exponential
 * backoff. Non-transient errors rethrow immediately.
 */
export async function withPayloadRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const maxRetries = options.maxRetries ?? 2
    const baseDelayMs = options.baseDelayMs ?? 120

    let lastErr: unknown = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastErr = err
            const kind = classifyTransientError(err)
            if (!kind || attempt === maxRetries) {
                throw err
            }
            options.onRetry?.(attempt + 1, kind, err)
            // Exponential backoff with jitter: 120ms, 360ms, 1080ms...
            const jitter = Math.floor(Math.random() * 60)
            const delay = baseDelayMs * Math.pow(3, attempt) + jitter
            await new Promise((r) => setTimeout(r, delay))
        }
    }
    throw lastErr
}
