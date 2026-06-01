/**
 * Server-side in-memory translation cache for F26-04 AI translate fallback.
 * Key: `${blockType}||${locale}` — scoped to process lifetime.
 * Prevents repeated OpenAI calls for the same block type + locale in a session.
 * If the server restarts, the cache is empty and AI calls are made fresh.
 *
 * IMPORTANT — content-scoping is the CALLER's responsibility, not this cache's:
 * - Template defaults (brand-agnostic, `{brand}` token intact) are cached under the bare
 *   `blockType` on purpose — they are shared across all sites.
 * - User/site-specific content must pass a content-unique `blockType` (the editor body-translate
 *   path uses `${blockType}-${block.id}`) so two different blocks never collide on the same key.
 * Do NOT pass raw user content under a bare `blockType` or it will be served to other blocks.
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
