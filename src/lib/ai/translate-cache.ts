/**
 * Server-side in-memory translation cache for F26-04 AI translate fallback.
 * Key: `${blockType}_${locale}` — scoped to process lifetime.
 * Prevents repeated OpenAI calls for the same block type + locale in a session.
 * If the server restarts, the cache is empty and AI calls are made fresh.
 */

type BlockContent = Record<string, unknown>

const _cache = new Map<string, BlockContent>()

// Use || separator — cannot appear in block type names or locale codes, prevents key collision
function cacheKey(blockType: string, locale: string): string {
    return `${blockType}||${locale}`
}

/** Returns cached translation or null if not cached. */
export function getCachedTranslation(blockType: string, locale: string): BlockContent | null {
    return _cache.get(cacheKey(blockType, locale)) ?? null
}

/** Stores translation result in cache. */
export function setCachedTranslation(blockType: string, locale: string, content: BlockContent): void {
    _cache.set(cacheKey(blockType, locale), content)
}

/** Whether a translation is cached (for AC-4 test). */
export function hasCachedTranslation(blockType: string, locale: string): boolean {
    return _cache.has(cacheKey(blockType, locale))
}

/** Clear all entries — used in tests. */
export function clearTranslationCache(): void {
    _cache.clear()
}
