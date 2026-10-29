/**
 * Shared contract of `POST /api/seo/fix-all` (SSE) between the route and the
 * AI Fix modal: time budget, per-item failure reasons and event shapes.
 * Pure module (no server-only imports) so client code can import it.
 */

/**
 * Must equal the literal `export const maxDuration` in the route: Next.js only
 * accepts a statically analysable literal there, so the route cannot import it
 * (a unit test pins both values together).
 */
export const FIX_ALL_MAX_DURATION_S = 60

/**
 * Time reserved for work done before the stream opens (auth, site lookup,
 * rate limit, authoritative SEO evaluation, actor resolution) and for flushing
 * the final events. All of it counts toward the function's `maxDuration`.
 */
export const FIX_ALL_SETUP_RESERVE_MS = 10_000

/**
 * Overall budget of the generation stream. Sized so that the default 9-item
 * batch (3 waves of 4 concurrent calls, each capped at 15s per call) fits,
 * while staying below `maxDuration` so the platform never kills the function
 * mid-stream.
 */
export const FIX_ALL_TIMEOUT_MS =
    FIX_ALL_MAX_DURATION_S * 1_000 - FIX_ALL_SETUP_RESERVE_MS

/** Time kept back at the end of the function for the final events to flush. */
export const FIX_ALL_FLUSH_MARGIN_MS = 3_000

/** Floor so a slow setup still leaves the first wave a chance to answer. */
export const FIX_ALL_MIN_STREAM_MS = 5_000

/**
 * Budget for the stream given how long the request already ran before it opened
 * (cold start, auth, SEO evaluation). Never longer than FIX_ALL_TIMEOUT_MS and never
 * past `maxDuration`, so the timeout event is sent before the platform kills the function.
 */
export function fixAllStreamBudgetMs(elapsedBeforeStreamMs: number): number {
    const remaining = FIX_ALL_MAX_DURATION_S * 1_000 - Math.max(0, elapsedBeforeStreamMs) - FIX_ALL_FLUSH_MARGIN_MS
    return Math.max(FIX_ALL_MIN_STREAM_MS, Math.min(FIX_ALL_TIMEOUT_MS, remaining))
}

/** SSE comment sent while waiting so proxies do not idle-close the stream. */
export const FIX_ALL_KEEPALIVE_MS = 10_000
export const FIX_ALL_KEEPALIVE_FRAME = ': ping\n\n'

export type FixFailureReason = 'timeout' | 'quota' | 'unavailable' | 'failed'

const FAILURE_REASONS: readonly FixFailureReason[] = [
    'quota',
    'unavailable',
    'timeout',
    'failed',
]

/** Client-side guard for the untrusted `reason` field of an SSE event. */
export function normalizeFixFailureReason(value: unknown): FixFailureReason {
    return FAILURE_REASONS.find((reason) => reason === value) ?? 'failed'
}

/**
 * The reason to show for a mixed batch: the one a seller can act on first
 * (quota/unavailable need waiting; timeout/failed just retry).
 */
export function dominantFixFailureReason(
    reasons: readonly FixFailureReason[],
): FixFailureReason {
    return FAILURE_REASONS.find((reason) => reasons.includes(reason)) ?? 'failed'
}

export interface FixAllTargetRef {
    targetId: string | number
    collection: string
    name: string
}

/** One item could not be generated; the other items keep running. */
export interface FixAllItemFailedEvent extends FixAllTargetRef {
    error: 'item_failed'
    reason: FixFailureReason
}

/** Terminal summary when every item was attempted before the budget ended. */
export interface FixAllDoneEvent {
    done: true
    succeeded: number
    failed: number
}

/** Overall budget exhausted; `pending` items were never finished. */
export interface FixAllTimeoutEvent {
    error: 'timeout'
    message: string
    pending: FixAllTargetRef[]
}

const MAX_CAUSE_DEPTH = 4
const UNAVAILABLE_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
])

function reasonFromStatus(status: number): FixFailureReason | null {
    if (status === 429) return 'quota'
    if (status === 504 || status === 408) return 'timeout'
    if (status === 502 || status === 503) return 'unavailable'
    return null
}

/**
 * Maps a thrown generation error to a reason the seller can act on. Walks the
 * `cause` chain because generate-meta wraps platform errors. Reads only
 * name/status/code, never the message, so no prompt text or secrets leak.
 */
export function classifyFixFailure(error: unknown): {
    reason: FixFailureReason
    status?: number
} {
    let status: number | undefined
    let reason: FixFailureReason | null = null
    let current: unknown = error

    for (
        let depth = 0;
        depth < MAX_CAUSE_DEPTH && current && typeof current === 'object';
        depth += 1
    ) {
        const node = current as {
            name?: unknown
            status?: unknown
            code?: unknown
            message?: unknown
            cause?: unknown
        }
        if (typeof node.status === 'number') {
            status ??= node.status
            reason ??= reasonFromStatus(node.status)
        }
        if (node.name === 'TimeoutError' || node.name === 'AbortError') {
            reason ??= 'timeout'
        }
        if (typeof node.code === 'string' && UNAVAILABLE_CODES.has(node.code)) {
            reason ??= 'unavailable'
        }
        if (node.name === 'TypeError' && node.message === 'fetch failed') {
            reason ??= 'unavailable'
        }
        current = node.cause
    }

    return {
        reason: reason ?? 'failed',
        ...(status !== undefined ? { status } : {}),
    }
}
