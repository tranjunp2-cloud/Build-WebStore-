import { SEO_META_BATCH_CONTEXT_MAX_CHARS, SEO_META_BATCH_MAX_ITEMS } from '@ech/ai-contracts'
import type { AgentActor } from '@/lib/ai-platform/context'
import { startCapture, finishCapture } from './capture-generation'
import type { SEOMetaOutput } from './generate-meta'

/** One page/product to write meta for; `id` is the caller's key and must be unique within the call. */
export type SEOMetaBatchItem = {
    id: string
    type: 'page' | 'product'
    itemName: string
    context?: string
}

/** Platform deadline of `seo.generate-meta-batch` is 30 s; give the HTTP call a little more to read the answer. */
const BATCH_TIMEOUT_MS = 32_000

/**
 * Validates a batch answer against what was asked: only ids we sent (first answer
 * per id wins), non-empty title and description, trimmed and capped like
 * `generateAutoSEOMeta`. Anything else is left out so the caller can retry it.
 */
export function pickValidBatchMeta(
    sent: readonly { id: string }[],
    answered: readonly { id: string; metaTitle: string; metaDescription: string }[],
): Map<string, SEOMetaOutput> {
    const sentIds = new Set(sent.map((item) => item.id))
    const valid = new Map<string, SEOMetaOutput>()
    for (const entry of answered) {
        if (!sentIds.has(entry.id) || valid.has(entry.id)) continue
        const title = entry.metaTitle.trim().substring(0, 60).trim()
        const description = entry.metaDescription.trim().substring(0, 160).trim()
        if (!title || !description) continue
        valid.set(entry.id, { title, description })
    }
    return valid
}

/**
 * Meta title + description for up to 20 pages/products in ONE platform task call
 * (`seo.generate-meta-batch`). Returns the valid answers keyed by item id; items
 * the model skipped or answered badly are simply absent. Throws when the call
 * itself fails, with the original error as `cause` (for failure classification).
 */
export async function generateAutoSEOMetaBatch(
    items: readonly SEOMetaBatchItem[],
    siteName: string,
    actor: AgentActor,
    options: { keywords?: string[]; signal?: AbortSignal; siteId?: string | number | null } = {},
): Promise<Map<string, SEOMetaOutput>> {
    if (items.length === 0) return new Map()
    if (items.length > SEO_META_BATCH_MAX_ITEMS) {
        throw new RangeError(`At most ${SEO_META_BATCH_MAX_ITEMS} items per batch`)
    }
    const { keywords, signal, siteId } = options
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const cap = await startCapture({
        endpoint: 'generate-meta',
        prompt: `batch:${items.length} | site:${siteName}`,
        category: 'batch',
        userId: actor.user.id,
        tenantId: /^\d+$/.test(actor.tenantId) ? Number(actor.tenantId) : actor.tenantId,
        ...(siteId != null ? { siteId } : {}),
    })
    // Loaded lazily, like generate-meta: this module must not pull the server-only platform client into configs.
    const { getAiTaskClient } = await import('@/lib/ai-platform/task-client')
    const timeout = AbortSignal.timeout(BATCH_TIMEOUT_MS)
    try {
        const { output } = await getAiTaskClient(actor).runTask(
            'seo.generate-meta-batch',
            {
                siteName: (siteName || 'Website').slice(0, 200),
                keywords: (keywords ?? []).slice(0, 30),
                items: items.map((item) => ({
                    id: item.id,
                    type: item.type,
                    itemName: item.itemName.slice(0, 300),
                    context: item.context ? item.context.slice(0, SEO_META_BATCH_CONTEXT_MAX_CHARS) : undefined,
                })),
            },
            { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
        )
        const valid = pickValidBatchMeta(items, output.items)
        await finishCapture(cap, {
            status: 'success',
            outputSnapshot: { path: 'ai-platform-batch', requested: items.length, valid: valid.size },
        })
        return valid
    } catch (error: unknown) {
        if (signal?.aborted) {
            await finishCapture(cap, { status: 'failed', error: 'aborted' })
            throw new DOMException('Aborted', 'AbortError')
        }
        const message = error instanceof Error ? error.message : 'Unknown error'
        await finishCapture(cap, { status: 'failed', error: message })
        throw new Error(`AI meta batch generation failed: ${message}`, { cause: error })
    }
}
