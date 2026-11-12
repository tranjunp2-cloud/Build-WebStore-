/**
 * One lookup per request and token. The scope object lives exactly as long as the request: the `Request` a route
 * handler received, or Next's per-request cookie store (`await cookies()` returns the same object for the whole
 * request, server components and route handlers alike), so nothing outlives the request and no TTL is needed.
 * A rejected lookup is forgotten, so a later call in the same request may try again.
 */
const memo = new WeakMap<object, Map<string, Promise<unknown>>>()

export function memoizePerRequest<T>(scope: object, key: string, load: () => Promise<T>): Promise<T> {
    let entries = memo.get(scope)
    if (!entries) {
        entries = new Map()
        memo.set(scope, entries)
    }
    const existing = entries.get(key)
    if (existing) return existing as Promise<T>
    const pending = load()
    entries.set(key, pending)
    pending.catch(() => {
        if (entries.get(key) === pending) entries.delete(key)
    })
    return pending
}
