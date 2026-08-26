/**
 * Detect a "not found" error thrown from within an API route's try block so the
 * catch can return 404 instead of a misleading 500.
 *
 * Payload's local API (`findByID`, `update`, ...) throws a `NotFound` error when
 * a document/id doesn't exist. Without this guard those exceptions fall into the
 * generic catch and surface as 500 — which makes load tests treat a bad client id
 * as a server crash and pollutes Sentry with false positives (see GH #1519).
 *
 * Checks, in order of reliability:
 *  1. Payload error name (`NotFound` / `NotFoundError`)
 *  2. Explicit HTTP status 404 on the error object
 *  3. Fallback: message is *exactly* "Not Found" (Payload's default NotFound
 *     message). Anchored on purpose — a loose `includes('not found')` would
 *     downgrade genuine 500-worthy errors whose message merely mentions the
 *     phrase (e.g. "product X not found in catalog"), masking real failures.
 *     That is the opposite of what GH #1519 wants, so we only match the bare
 *     canonical string here. Real Payload NotFound is already caught by (1)/(2).
 */
export function isNotFoundError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false

    const e = err as { name?: string; status?: number; message?: string }

    if (e.name === 'NotFound' || e.name === 'NotFoundError') return true
    if (e.status === 404) return true

    return typeof e.message === 'string' && /^not\s*found$/i.test(e.message.trim())
}
