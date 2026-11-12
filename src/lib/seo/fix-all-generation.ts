import { generateAutoSEOMeta, type SEOMetaOutput } from '@/lib/ai/generate-meta'
import { generateAutoSEOMetaBatch, type SEOMetaBatchItem } from '@/lib/ai/generate-meta-batch'
import type { AgentActor } from '@/lib/ai-platform/context'
import {
    classifyFixFailure,
    FIX_ALL_BATCH_CONCURRENCY,
    FIX_ALL_BATCH_SIZE,
    FIX_ALL_MIN_RETRY_WINDOW_MS,
    FIX_ALL_RETRY_BACKOFF_MAX_MS,
    FIX_ALL_RETRY_BACKOFF_MS,
    isRetryableFixFailure,
    type FixFailureReason,
} from './fix-all-protocol'

/** One page/product/blog the fix-all stream has to write meta for. */
export interface FixAllWorkItem {
    collection: string
    title: string
    context?: string
}

export interface FixAllGenerationArgs<T extends FixAllWorkItem> {
    items: readonly T[]
    siteName: string
    keywords: string[]
    /** Without an actor (AI tasks off) every item gets its template meta through the per-item path. */
    actor?: AgentActor
    /** Aborts all work; callbacks are not called after it fires. */
    signal: AbortSignal
    /** Epoch ms after which the stream gives up; a retry only starts when it can still finish before. */
    deadlineAt: number
    onResult: (item: T, meta: SEOMetaOutput) => void
    onFailure: (item: T, failure: { reason: FixFailureReason; status?: number }) => void
}

const PER_ITEM_CONCURRENCY = 4

/** Runs `worker` over `queue` with at most `concurrency` in flight. */
async function pool<T>(queue: readonly T[], concurrency: number, signal: AbortSignal, worker: (entry: T) => Promise<void>): Promise<void> {
    let next = 0
    const run = async () => {
        while (next < queue.length && !signal.aborted) {
            const entry = queue[next]
            next += 1
            await worker(entry)
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, run))
}

/** Resolves after `ms`, or early when `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) return resolve()
        const done = () => {
            clearTimeout(timer)
            signal.removeEventListener('abort', done)
            resolve()
        }
        const timer = setTimeout(done, ms)
        signal.addEventListener('abort', done, { once: true })
    })
}

/** Server log line: error class, reason and HTTP status only, never the message or prompt text. */
function logFailure(error: unknown, collection: string, reason: FixFailureReason, status?: number, extra: Record<string, unknown> = {}) {
    console.error('[AI Fix All Partial Error]', {
        name: error instanceof Error ? error.name : 'UnknownError',
        reason,
        status,
        collection,
        ...extra,
    })
}

/** Splits `items` into the fewest chunks of at most `size`, as even as possible (25 -> 13 + 12). */
export function chunkEvenly<T>(items: readonly T[], size: number): T[][] {
    if (items.length === 0) return []
    const chunks = Math.ceil(items.length / size)
    const perChunk = Math.ceil(items.length / chunks)
    return Array.from({ length: chunks }, (_, index) => items.slice(index * perChunk, (index + 1) * perChunk))
}

/**
 * Generates meta for every item. With an AI-platform actor the items go out in
 * batches (one task call per chunk of at most 20, two chunks in flight) and each
 * valid answer is reported as soon as its chunk returns. Items the answer lacks,
 * and chunks that failed for a retryable reason (timeout, busy, unavailable), get
 * ONE automatic retry after a short backoff, inside the remaining budget: a
 * smaller batch, or the per-item call when a single item is left. Only then does
 * an item fail.
 */
export async function runFixAllGeneration<T extends FixAllWorkItem>(args: FixAllGenerationArgs<T>): Promise<void> {
    const { actor } = args
    if (!actor) return runPerItem(args)
    return runBatched(args, actor)
}

async function runPerItem<T extends FixAllWorkItem>(args: FixAllGenerationArgs<T>): Promise<void> {
    await pool(args.items, PER_ITEM_CONCURRENCY, args.signal, async (item) => {
        const outcome = await generateOne(item, args)
        if (args.signal.aborted) return
        if (outcome.ok) args.onResult(item, outcome.meta)
        else args.onFailure(item, outcome.failure)
    })
}

type OneOutcome = { ok: true; meta: SEOMetaOutput } | { ok: false; failure: { reason: FixFailureReason; status?: number; retryAfterMs?: number } }

async function generateOne<T extends FixAllWorkItem>(item: T, args: FixAllGenerationArgs<T>): Promise<OneOutcome> {
    try {
        const meta = await generateAutoSEOMeta(
            item.collection === 'products' ? 'product' : 'page',
            item.title,
            args.siteName,
            item.context,
            args.keywords,
            args.signal,
            args.actor,
        )
        return { ok: true, meta }
    } catch (error: unknown) {
        if (args.signal.aborted) return { ok: false, failure: { reason: 'failed' } }
        const failure = classifyFixFailure(error)
        logFailure(error, item.collection, failure.reason, failure.status)
        return { ok: false, failure }
    }
}

interface Slot<T> {
    item: T
    /** Per-call key sent to the platform and matched against the answer. */
    id: string
}

type BatchOutcome<T> =
    | { failure: null; missing: Slot<T>[] }
    | { failure: { reason: FixFailureReason; status?: number; retryAfterMs?: number }; missing: Slot<T>[] }

async function runBatched<T extends FixAllWorkItem>(args: FixAllGenerationArgs<T>, actor: AgentActor): Promise<void> {
    const chunks = chunkEvenly(args.items, FIX_ALL_BATCH_SIZE)
    await pool(chunks, FIX_ALL_BATCH_CONCURRENCY, args.signal, (chunk) => processChunk(chunk, args, actor))
}

/** One batch call; reports valid answers, returns what is still open and why. */
async function callBatch<T extends FixAllWorkItem>(items: readonly T[], args: FixAllGenerationArgs<T>, actor: AgentActor, attempt: 'first' | 'retry'): Promise<BatchOutcome<T>> {
    const slots: Slot<T>[] = items.map((item, index) => ({ item, id: String(index + 1) }))
    const batchItems: SEOMetaBatchItem[] = slots.map(({ item, id }) => ({
        id,
        type: item.collection === 'products' ? 'product' : 'page',
        itemName: item.title,
        context: item.context,
    }))
    try {
        const answers = await generateAutoSEOMetaBatch(batchItems, args.siteName, actor, { keywords: args.keywords, signal: args.signal })
        if (args.signal.aborted) return { failure: null, missing: [] }
        const missing: Slot<T>[] = []
        for (const slot of slots) {
            const meta = answers.get(slot.id)
            if (meta) args.onResult(slot.item, meta)
            else missing.push(slot)
        }
        return { failure: null, missing }
    } catch (error: unknown) {
        if (args.signal.aborted) return { failure: null, missing: [] }
        const failure = classifyFixFailure(error)
        logFailure(error, items[0]?.collection ?? 'unknown', failure.reason, failure.status, { batch: items.length, attempt })
        return { failure, missing: slots }
    }
}

async function processChunk<T extends FixAllWorkItem>(chunk: readonly T[], args: FixAllGenerationArgs<T>, actor: AgentActor): Promise<void> {
    const first = await callBatch(chunk, args, actor, 'first')
    if (args.signal.aborted || first.missing.length === 0) return

    const firstFailure = first.failure
    if (firstFailure && !isRetryableFixFailure(firstFailure.reason)) {
        first.missing.forEach(({ item }) => args.onFailure(item, firstFailure))
        return
    }

    const backoff = Math.min(firstFailure?.retryAfterMs ?? FIX_ALL_RETRY_BACKOFF_MS, FIX_ALL_RETRY_BACKOFF_MAX_MS)
    const failWith = (slots: readonly Slot<T>[], failure: { reason: FixFailureReason; status?: number }) =>
        slots.forEach(({ item }) => args.onFailure(item, failure))
    // A missing answer has no better reason than a generic failure.
    const openReason = firstFailure ?? { reason: 'failed' as const }

    if (args.deadlineAt - Date.now() - backoff < FIX_ALL_MIN_RETRY_WINDOW_MS) {
        failWith(first.missing, openReason)
        return
    }
    await sleep(backoff, args.signal)
    if (args.signal.aborted) return

    const open = first.missing.map(({ item }) => item)
    // A timed-out chunk was too big to answer in time: halve it. Otherwise keep one call (a busy provider does not need more).
    const groups = firstFailure?.reason === 'timeout' ? chunkEvenly(open, Math.ceil(open.length / 2)) : [open]
    await Promise.all(
        groups.map(async (group) => {
            if (group.length === 1) {
                // A batch of one is just the per-item call.
                const outcome = await generateOne(group[0], args)
                if (args.signal.aborted) return
                if (outcome.ok) args.onResult(group[0], outcome.meta)
                else args.onFailure(group[0], outcome.failure)
                return
            }
            const retry = await callBatch(group, args, actor, 'retry')
            if (args.signal.aborted || retry.missing.length === 0) return
            failWith(retry.missing, retry.failure ?? { reason: 'failed' })
        }),
    )
}
