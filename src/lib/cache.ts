/**
 * Simple in-memory TTL cache.
 * Used for dashboard/analytics API responses.
 */

type CacheEntry<T> = {
    data: T
    expiry: number
}

const store = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 60_000 // 60 seconds

export function cacheGet<T>(key: string): T | null {
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
        store.delete(key)
        return null
    }
    return entry.data as T
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    store.set(key, { data, expiry: Date.now() + ttlMs })
}

export function cacheDelete(key: string): void {
    store.delete(key)
}

/** Evict all expired entries. Call periodically if needed. */
export function cacheCleanup(): void {
    const now = Date.now()
    for (const [key, entry] of store) {
        if (now > entry.expiry) store.delete(key)
    }
}
