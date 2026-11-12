/**
 * A short memory shared by every server instance: Upstash Redis when `SHARED_CACHE_BACKEND=redis` and
 * `UPSTASH_REDIS_REST_URL` / `_TOKEN` are set, otherwise this instance's memory (bounded, least recently read dropped first) — the behaviour before Upstash.
 *
 * - Values are JSON (what goes in comes back as plain data). A value over `maxBytes` (200 KB) is not stored.
 * - Upstash gets `timeoutMs` (1 s) per call; an error or a slow answer means "not remembered": the value is computed
 *   and the request goes on. Failures are logged at most once a minute per cache.
 * - Entries live in groups (one per workspace): a group is one Redis hash `sc:<namespace>:<group>`, so forgetting a
 *   workspace is one DEL. Each entry carries its own time; the hash expires `ttlMs` after its last write.
 * - Concurrent misses for one key on one instance share one compute (single flight). A load is not remembered when it
 *   fails, when `remember(value)` says no, or when its group was invalidated while it ran.
 */
import { redis } from '@/lib/redis'

export const SHARED_CACHE_MAX_BYTES = 200_000
export const SHARED_CACHE_TIMEOUT_MS = 1_000
const FAILURE_LOG_EVERY_MS = 60_000

/** The few Redis calls the cache needs (a hash per group). */
export interface SharedCacheBackend {
    getField(hash: string, field: string): Promise<string | null>
    setField(hash: string, field: string, json: string, ttlMs: number): Promise<void>
    deleteField(hash: string, field: string): Promise<void>
    deleteHash(hash: string): Promise<void>
}

/** The calls of `@upstash/redis` used here (structural, so a test can hand in its own). */
export interface UpstashLike {
    hget(key: string, field: string): Promise<unknown>
    hdel(key: string, ...fields: string[]): Promise<unknown>
    del(...keys: string[]): Promise<unknown>
    pipeline(): { hset(key: string, kv: Record<string, string>): unknown; pexpire(key: string, ms: number): unknown; exec(): Promise<unknown> }
}

/** Upstash adapter. `hget` may hand back the JSON already parsed (the client deserialises by default): re-stringify. */
export function upstashBackend(client: UpstashLike): SharedCacheBackend {
    return {
        async getField(hash, field) {
            const raw = await client.hget(hash, field)
            if (raw === null || raw === undefined) return null
            return typeof raw === 'string' ? raw : JSON.stringify(raw)
        },
        async setField(hash, field, json, ttlMs) {
            const tx = client.pipeline()
            tx.hset(hash, { [field]: json })
            tx.pexpire(hash, ttlMs)
            await tx.exec()
        },
        async deleteField(hash, field) {
            await client.hdel(hash, field)
        },
        async deleteHash(hash) {
            await client.del(hash)
        },
    }
}

/**
 * `SHARED_CACHE_BACKEND=redis` puts these caches in Upstash (shared by every instance; ≈2 commands per work poll).
 * Default `memory`: each instance keeps its own copy, and Upstash stays for rate limits only (a few commands per
 * limited request). Switch on when many instances make the To do rebuilds show on the database.
 */
export function sharedCacheBackendSetting(env: Record<string, string | undefined> = process.env): 'redis' | 'memory' {
    return env.SHARED_CACHE_BACKEND?.trim().toLowerCase() === 'redis' ? 'redis' : 'memory'
}

const defaultBackend: SharedCacheBackend | null =
    redis && sharedCacheBackendSetting() === 'redis' ? upstashBackend(redis as unknown as UpstashLike) : null

/** Where the shared caches live on this instance. */
export function sharedCacheMode(): 'upstash' | 'memory' {
    return defaultBackend ? 'upstash' : 'memory'
}

export interface SharedCacheOptions {
    /** Key prefix in Redis (`sc:<namespace>:...`), one per cache. */
    namespace: string
    ttlMs: number
    /** Memory mode only: the most entries kept on this instance. */
    maxEntries: number
    maxBytes?: number
    timeoutMs?: number
    /** `undefined` = Upstash when configured, else memory; `null` = memory. */
    backend?: SharedCacheBackend | null
}

export interface SharedCache<T> {
    /** The remembered value for `group` + `key` when younger than the TTL; otherwise `load()` (and remember it). */
    get(group: string, key: string, load: () => Promise<T>, remember?: (value: T) => boolean): Promise<T>
    set(group: string, key: string, value: T): Promise<void>
    delete(group: string, key: string): Promise<void>
    /** Forget every key of `group`. This instance forgets at once (synchronously); Upstash when the promise settles. */
    invalidateGroup(group: string): Promise<void>
    /** Tests only: empty this instance's memory. */
    clearLocal(): void
    readonly mode: 'upstash' | 'memory'
}

type Stored<T> = { at: number; v: T }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms)
    })
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

export function createSharedCache<T>(options: SharedCacheOptions): SharedCache<T> {
    const { namespace, ttlMs, maxEntries } = options
    const maxBytes = options.maxBytes ?? SHARED_CACHE_MAX_BYTES
    const timeoutMs = options.timeoutMs ?? SHARED_CACHE_TIMEOUT_MS
    const backend = options.backend === undefined ? defaultBackend : options.backend

    const local = new Map<string, Stored<T>>()
    const inflight = new Map<string, Promise<T>>()
    /** Bumped by invalidateGroup: a load that started before is not remembered. */
    const generation = new Map<string, number>()
    let lastFailureLogAt = -Infinity

    const hashOf = (group: string) => `sc:${namespace}:${group}`
    const localKey = (group: string, key: string) => `${group}\u0000${key}`
    const genOf = (group: string) => generation.get(group) ?? 0

    function logFailure(what: string, error: unknown): void {
        const now = Date.now()
        if (now - lastFailureLogAt < FAILURE_LOG_EVERY_MS) return
        lastFailureLogAt = now
        console.warn(`[shared-cache:${namespace}] ${what} failed, computing instead (logged once a minute):`, error instanceof Error ? error.message : error)
    }

    async function readShared(group: string, key: string): Promise<Stored<T> | null> {
        if (!backend) return null
        try {
            const json = await withTimeout(backend.getField(hashOf(group), key), timeoutMs)
            if (json === null) return null
            const stored = JSON.parse(json) as Stored<T>
            return typeof stored?.at === 'number' && 'v' in stored ? stored : null
        } catch (error) {
            logFailure('read', error)
            return null
        }
    }

    async function writeShared(group: string, key: string, value: T, at: number): Promise<void> {
        if (!backend) return
        let json: string
        try {
            json = JSON.stringify({ at, v: value } satisfies Stored<T>)
        } catch (error) {
            logFailure('serialise', error)
            return
        }
        if (Buffer.byteLength(json, 'utf8') > maxBytes) return
        try {
            await withTimeout(backend.setField(hashOf(group), key, json, ttlMs), timeoutMs)
        } catch (error) {
            logFailure('write', error)
        }
    }

    function readLocal(group: string, key: string, now: number): Stored<T> | null {
        const id = localKey(group, key)
        const hit = local.get(id)
        if (!hit) return null
        if (now - hit.at >= ttlMs) {
            local.delete(id)
            return null
        }
        // least recently read goes first: a hit moves to the newest end (Map keeps insertion order)
        local.delete(id)
        local.set(id, hit)
        return hit
    }

    function writeLocal(group: string, key: string, value: T, at: number): void {
        const id = localKey(group, key)
        local.delete(id)
        local.set(id, { at, v: value })
        while (local.size > maxEntries) {
            const oldest = local.keys().next().value
            if (oldest === undefined) break
            local.delete(oldest)
        }
    }

    async function getOrLoad(group: string, key: string, load: () => Promise<T>, remember: (value: T) => boolean): Promise<T> {
        const started = Date.now()
        const startGen = genOf(group)
        if (backend) {
            const hit = await readShared(group, key)
            if (hit && Date.now() - hit.at < ttlMs) return hit.v
        } else {
            const hit = readLocal(group, key, started)
            if (hit) return hit.v
        }
        const value = await load()
        if (remember(value) && genOf(group) === startGen) {
            if (backend) await writeShared(group, key, value, started)
            else writeLocal(group, key, value, started)
        }
        return value
    }

    return {
        mode: backend ? 'upstash' : 'memory',

        get(group, key, load, remember = () => true) {
            const id = localKey(group, key)
            const running = inflight.get(id)
            if (running) return running
            const promise = getOrLoad(group, key, load, remember).finally(() => {
                if (inflight.get(id) === promise) inflight.delete(id)
            })
            inflight.set(id, promise)
            return promise
        },

        async set(group, key, value) {
            const at = Date.now()
            if (backend) await writeShared(group, key, value, at)
            else writeLocal(group, key, value, at)
        },

        async delete(group, key) {
            local.delete(localKey(group, key))
            if (!backend) return
            try {
                await withTimeout(backend.deleteField(hashOf(group), key), timeoutMs)
            } catch (error) {
                logFailure('delete', error)
            }
        },

        invalidateGroup(group) {
            generation.set(group, genOf(group) + 1)
            const prefix = `${group}\u0000`
            for (const id of [...local.keys()]) if (id.startsWith(prefix)) local.delete(id)
            for (const id of [...inflight.keys()]) if (id.startsWith(prefix)) inflight.delete(id)
            if (!backend) return Promise.resolve()
            return withTimeout(backend.deleteHash(hashOf(group)), timeoutMs).catch((error) => logFailure('invalidate', error))
        },

        clearLocal() {
            local.clear()
            inflight.clear()
            generation.clear()
            lastFailureLogAt = -Infinity
        },
    }
}
