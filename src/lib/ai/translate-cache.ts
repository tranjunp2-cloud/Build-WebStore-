/**
 * Server-side in-memory translation cache for F26-04 AI translate (/api/ai/translate).
 *
 * The key is derived on the server, never chosen by the client:
 *   scope (workspace org, or the user when no workspace resolves) + prompt version + locale
 *   + sha256 of the canonical source content.
 * So an edited block is a new key (no stale translation), another tenant can never read this
 * tenant's entries, and a prompt change starts fresh. Bounded LRU: oldest entries are evicted
 * once TRANSLATE_CACHE_MAX_ENTRIES is reached. Process-lifetime only.
 */

import { createHash } from 'node:crypto'

type BlockContent = Record<string, unknown>

export const TRANSLATE_CACHE_MAX_ENTRIES = 500

export interface TranslationCacheKeyParts {
    /** Who may read the entry — e.g. `org:<organizationId>` or `user:<id>`. */
    scope: string
    /** Bump-on-change id of the prompt that produced the translation. */
    promptVersion: string
    locale: string
    /** Source content being translated (key order does not matter). */
    content: BlockContent
}

const _cache = new Map<string, BlockContent>()

/** JSON with object keys sorted at every level, so equal content always hashes the same. */
function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
    }
    return JSON.stringify(value) ?? 'null'
}

/** Server-derived cache key; `||` cannot appear in scopes, versions or locale codes. */
export function translationCacheKey({ scope, promptVersion, locale, content }: TranslationCacheKeyParts): string {
    const digest = createHash('sha256').update(canonicalJson(content)).digest('hex')
    return `${scope}||${promptVersion}||${locale}||${digest}`
}

/** Returns the cached translation (and marks it recently used) or null. */
export function getCachedTranslation(key: string): BlockContent | null {
    const hit = _cache.get(key)
    if (!hit) return null
    _cache.delete(key)
    _cache.set(key, hit)
    return hit
}

/** Stores a translation, evicting the least recently used entries past the cap. */
export function setCachedTranslation(key: string, content: BlockContent): void {
    _cache.delete(key)
    _cache.set(key, content)
    while (_cache.size > TRANSLATE_CACHE_MAX_ENTRIES) {
        const oldest = _cache.keys().next().value
        if (oldest === undefined) break
        _cache.delete(oldest)
    }
}

export function hasCachedTranslation(key: string): boolean {
    return _cache.has(key)
}

export function translationCacheSize(): number {
    return _cache.size
}

/** Clear all entries — used in tests. */
export function clearTranslationCache(): void {
    _cache.clear()
}
