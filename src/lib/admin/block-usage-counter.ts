/**
 * block-usage-counter.ts
 * Aggregates block usage counts across Templates.templatePages[].layout JSON.
 *
 * Strategy: templates-only (simpler, sufficient at current scale).
 * Each templatePage.layout is a JSON array of block objects with a `blockType` field.
 *
 * Cache: 60-second in-memory TTL (Map with expiry timestamp).
 * Re-fetches on first call after TTL expires.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

// ── TTL cache ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000

let _cache: { counts: Record<string, number>; expiresAt: number } | null = null

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplatePage = {
    layout?: unknown
}

type TemplateDoc = {
    templatePages?: TemplatePage[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts blockType strings from a layout JSON value.
 * Layout is expected to be an array of objects with a `blockType` field.
 * Tolerates null / non-array / malformed entries.
 */
function extractBlockTypes(layout: unknown): string[] {
    if (!Array.isArray(layout)) return []
    const types: string[] = []
    for (const block of layout) {
        if (block && typeof block === 'object' && 'blockType' in block) {
            const t = (block as Record<string, unknown>).blockType
            if (typeof t === 'string') types.push(t)
        }
    }
    return types
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a map of blockSlug → occurrence count across all template pages.
 * Result is cached for 60 seconds. Thread-safe for single-process Next.js.
 */
export async function getBlockUsageCounts(): Promise<Record<string, number>> {
    const now = Date.now()
    if (_cache && now < _cache.expiresAt) {
        return _cache.counts
    }

    const counts: Record<string, number> = {}

    try {
        const payload = await getPayload({ config })

        // Fetch all templates with templatePages field only (lean query)
        // Payload's `select` generic type is restrictive; cast to bypass until Payload types improve
        const result = await (payload.find as (...a: unknown[]) => Promise<{ docs: unknown[] }>)({
            collection: 'templates',
            limit: 1000,
            depth: 0,
            select: { templatePages: true },
        })

        for (const doc of result.docs as TemplateDoc[]) {
            if (!Array.isArray(doc.templatePages)) continue
            for (const page of doc.templatePages) {
                const types = extractBlockTypes(page.layout)
                for (const blockType of types) {
                    counts[blockType] = (counts[blockType] ?? 0) + 1
                }
            }
        }
    } catch (err) {
        // Non-fatal: return empty counts rather than crashing the catalog page
        console.error('[block-usage-counter] Failed to aggregate usage:', err)
        return {}
    }

    _cache = { counts, expiresAt: now + CACHE_TTL_MS }
    return counts
}

/**
 * Invalidate the cache (call after template save hooks if needed).
 */
export function invalidateBlockUsageCache(): void {
    _cache = null
}
