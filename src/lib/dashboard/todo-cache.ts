/**
 * A short memory for the shop's To do list (the shop part of the dock's work queue, the mascot and the copilot's
 * issues; the dashboard card is gone). `computeShopTodos` runs a handful of queries plus the website check (up to a
 * few hundred page drafts). The dock polls every 60 s while visible, so the list is kept 3 minutes per workspace +
 * site + language + viewer areas: a 60 s memory would expire right before every poll and never be hit.
 *
 * In-memory, per server instance (no shared store, nothing to configure); failures are never remembered; at most
 * `TODO_CACHE_MAX_ENTRIES` lists are kept, the least recently read dropped first. The copilot's `store_todos` and the
 * scheduled automations do NOT use it: they always read fresh. Writes the copilot applies (or undoes) call
 * `invalidateTodoCache`, so the list reflects them at once.
 */
import type { ShopTodoItem } from '@/lib/insights/shop-todo'

export const TODO_CACHE_TTL_MS = 180_000
export const TODO_CACHE_MAX_ENTRIES = 5_000

type Entry = { at: number; items: Promise<ShopTodoItem[]> }
const entries = new Map<string, Entry>()

const keyPrefix = (tenantId: string | number): string => `${String(tenantId)}|`

export function todoCacheKey(parts: { tenantId: string | number; siteId: string | null; locale: string; areas: Record<string, boolean> }): string {
    const areas = Object.entries(parts.areas).sort(([a], [b]) => a.localeCompare(b)).map(([name, on]) => `${name}:${on ? 1 : 0}`).join(',')
    return `${keyPrefix(parts.tenantId)}${parts.siteId ?? '-'}|${parts.locale}|${areas}`
}

/** The cached list for `key` when it is younger than the TTL; otherwise `load()` (concurrent callers share one load). */
export function cachedTodos(key: string, load: () => Promise<ShopTodoItem[]>, now: number = Date.now()): Promise<ShopTodoItem[]> {
    const hit = entries.get(key)
    if (hit && now - hit.at < TODO_CACHE_TTL_MS) {
        // least recently used goes first: a hit moves the list to the newest end (Map keeps insertion order)
        entries.delete(key)
        entries.set(key, hit)
        return hit.items
    }
    const items = load()
    const entry: Entry = { at: now, items }
    entries.set(key, entry)
    // a failed load is not remembered (the next render tries again)
    items.catch(() => {
        if (entries.get(key) === entry) entries.delete(key)
    })
    while (entries.size > TODO_CACHE_MAX_ENTRIES) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        entries.delete(oldest)
    }
    return items
}

/** Forget a workspace's lists (after the copilot changed something the To do list counts). Safe to call anywhere. */
export function invalidateTodoCache(tenantId: string | number): void {
    const prefix = keyPrefix(tenantId)
    for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key)
}

/** Tests only. */
export function clearTodoCache(): void {
    entries.clear()
}
