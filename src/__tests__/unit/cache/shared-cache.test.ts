/**
 * TC-PERF-025..028 — the shared cache (src/lib/cache/shared-cache.ts).
 * TC-PERF-025: memory mode (no Upstash): get/set/delete with TTL, LRU bound, failures and `remember: false` not kept,
 *              concurrent misses on one instance share one compute.
 * TC-PERF-026: Upstash mode: a value computed on one instance is read by another; invalidating a group on one
 *              instance makes every instance compute again; a load running during the invalidation is not stored.
 * TC-PERF-027: Upstash errors or no answer within 1 s → compute instead (request goes on), logged once a minute.
 * TC-PERF-028: a value over 200 KB is not stored in Upstash; the Upstash adapter writes HSET + PEXPIRE in one pipeline
 *              and reads both raw and auto-deserialised values.
 * Real: createSharedCache, upstashBackend. Faked: the Redis server (an in-memory hash store), timers where noted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    createSharedCache,
    SHARED_CACHE_MAX_BYTES,
    SHARED_CACHE_TIMEOUT_MS,
    upstashBackend,
    type SharedCacheBackend,
    type UpstashLike,
} from '@/lib/cache/shared-cache'

/** An in-memory stand-in for the Upstash server, shared by every "instance" (cache object) in a test. */
function fakeUpstash() {
    const hashes = new Map<string, Map<string, string>>()
    const expiries = new Map<string, number>()
    const client = {
        hget: vi.fn(async (key: string, field: string) => {
            const raw = hashes.get(key)?.get(field)
            // like @upstash/redis: JSON comes back parsed
            return raw === undefined ? null : (JSON.parse(raw) as unknown)
        }),
        hdel: vi.fn(async (key: string, ...fields: string[]) => {
            for (const field of fields) hashes.get(key)?.delete(field)
            return 1
        }),
        del: vi.fn(async (...keys: string[]) => {
            for (const key of keys) hashes.delete(key)
            return keys.length
        }),
        pipeline: vi.fn(() => {
            const ops: Array<() => void> = []
            return {
                hset(key: string, kv: Record<string, string>) {
                    ops.push(() => {
                        const hash = hashes.get(key) ?? new Map<string, string>()
                        for (const [field, value] of Object.entries(kv)) hash.set(field, value)
                        hashes.set(key, hash)
                    })
                },
                pexpire(key: string, ms: number) {
                    ops.push(() => expiries.set(key, ms))
                },
                exec: vi.fn(async () => ops.forEach((op) => op())),
            }
        }),
    }
    return { client, hashes, expiries, backend: upstashBackend(client as UpstashLike) }
}

const TTL = 180_000

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T03:00:00Z'))
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('memory mode [TC-PERF-025]', () => {
    it('remembers a value for the TTL, then computes again', async () => {
        // Arrange
        const cache = createSharedCache<number>({ namespace: 't', ttlMs: TTL, maxEntries: 10, backend: null })
        const load = vi.fn(async () => 7)

        // Act
        await cache.get('g', 'k', load)
        await cache.get('g', 'k', load)
        vi.advanceTimersByTime(TTL + 1)
        await cache.get('g', 'k', load)

        // Assert
        expect(cache.mode).toBe('memory')
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('set / delete / invalidateGroup work, and only on their own group', async () => {
        // Arrange
        const cache = createSharedCache<string>({ namespace: 't', ttlMs: TTL, maxEntries: 10, backend: null })
        const load = vi.fn(async () => 'computed')
        await cache.set('4', 'a', 'set-a')
        await cache.set('4', 'b', 'set-b')
        await cache.set('41', 'a', 'other')

        // Act + Assert
        expect(await cache.get('4', 'a', load)).toBe('set-a')
        await cache.delete('4', 'a')
        expect(await cache.get('4', 'a', load)).toBe('computed')
        await cache.invalidateGroup('4')
        expect(await cache.get('4', 'b', load)).toBe('computed')
        expect(await cache.get('41', 'a', load)).toBe('other')
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('keeps at most maxEntries, dropping the least recently read', async () => {
        // Arrange
        const cache = createSharedCache<number>({ namespace: 't', ttlMs: TTL, maxEntries: 2, backend: null })
        await cache.get('g', '1', async () => 1)
        await cache.get('g', '2', async () => 2)
        await cache.get('g', '1', async () => -1) // hit: 1 is now the newest

        // Act
        await cache.get('g', '3', async () => 3) // over the cap: 2 goes
        const one = vi.fn(async () => -1)
        const two = vi.fn(async () => -2)
        await cache.get('g', '1', one)
        await cache.get('g', '2', two)

        // Assert
        expect(one).not.toHaveBeenCalled()
        expect(two).toHaveBeenCalledTimes(1)
    })

    it('does not remember a failure or a value refused by remember()', async () => {
        // Arrange
        const cache = createSharedCache<{ partial: boolean }>({ namespace: 't', ttlMs: TTL, maxEntries: 10, backend: null })
        const failing = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue({ partial: true })

        // Act + Assert
        await expect(cache.get('g', 'k', failing)).rejects.toThrow('db down')
        await cache.get('g', 'k', failing, (value) => !value.partial)
        await cache.get('g', 'k', failing, (value) => !value.partial)
        expect(failing).toHaveBeenCalledTimes(3)
    })

    it('concurrent misses share one compute (single flight)', async () => {
        // Arrange
        const cache = createSharedCache<number>({ namespace: 't', ttlMs: TTL, maxEntries: 10, backend: null })
        let release: (value: number) => void = () => undefined
        const load = vi.fn(() => new Promise<number>((resolve) => (release = resolve)))

        // Act
        const all = Promise.all([cache.get('g', 'k', load), cache.get('g', 'k', load), cache.get('g', 'k', load)])
        await Promise.resolve()
        release(5)

        // Assert
        expect(await all).toEqual([5, 5, 5])
        expect(load).toHaveBeenCalledTimes(1)
    })
})

describe('Upstash mode: shared by every instance [TC-PERF-026]', () => {
    it('a value computed on instance A is read by instance B without computing', async () => {
        // Arrange — two server instances = two cache objects on one Upstash
        const server = fakeUpstash()
        const a = createSharedCache<string[]>({ namespace: 'todo', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        const b = createSharedCache<string[]>({ namespace: 'todo', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        const loadA = vi.fn(async () => ['low_stock'])
        const loadB = vi.fn(async () => ['other'])

        // Act
        await a.get('4', '4|-|en|', loadA)
        const onB = await b.get('4', '4|-|en|', loadB)

        // Assert
        expect(a.mode).toBe('upstash')
        expect(onB).toEqual(['low_stock'])
        expect(loadB).not.toHaveBeenCalled()
        expect(server.hashes.has('sc:todo:4')).toBe(true)
        expect(server.expiries.get('sc:todo:4')).toBe(TTL)
    })

    it('an entry older than the TTL is ignored even if the hash is still there', async () => {
        // Arrange
        const server = fakeUpstash()
        const cache = createSharedCache<number>({ namespace: 'n', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        await cache.get('g', 'k', async () => 1)
        vi.advanceTimersByTime(TTL + 1)
        const load = vi.fn(async () => 2)

        // Act
        const value = await cache.get('g', 'k', load)

        // Assert
        expect(value).toBe(2)
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('invalidating a group on instance A makes instance B compute again', async () => {
        // Arrange
        const server = fakeUpstash()
        const a = createSharedCache<number>({ namespace: 'todo', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        const b = createSharedCache<number>({ namespace: 'todo', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        await b.get('4', 'k', async () => 1)
        const load = vi.fn(async () => 2)

        // Act
        await a.invalidateGroup('4')
        const value = await b.get('4', 'k', load)

        // Assert
        expect(server.client.del).toHaveBeenCalledWith('sc:todo:4')
        expect(value).toBe(2)
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('a load that was running when its group was invalidated is returned but not stored', async () => {
        // Arrange
        const server = fakeUpstash()
        const cache = createSharedCache<number>({ namespace: 'n', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        let release: (value: number) => void = () => undefined
        const pending = cache.get('4', 'k', () => new Promise<number>((resolve) => (release = resolve)))
        await vi.advanceTimersByTimeAsync(0)

        // Act
        await cache.invalidateGroup('4')
        release(1)

        // Assert
        expect(await pending).toBe(1)
        expect(server.hashes.get('sc:n:4')?.size ?? 0).toBe(0)
    })
})

describe('Upstash slow or down: compute instead [TC-PERF-027]', () => {
    it('no answer within 1 s → computes and answers', async () => {
        // Arrange
        const hanging: SharedCacheBackend = {
            getField: () => new Promise(() => undefined),
            setField: () => new Promise(() => undefined),
            deleteField: async () => undefined,
            deleteHash: async () => undefined,
        }
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const cache = createSharedCache<number>({ namespace: 'n', ttlMs: TTL, maxEntries: 10, backend: hanging })
        const load = vi.fn(async () => 9)

        // Act
        const pending = cache.get('g', 'k', load)
        await vi.advanceTimersByTimeAsync(SHARED_CACHE_TIMEOUT_MS) // read times out → compute
        await vi.advanceTimersByTimeAsync(SHARED_CACHE_TIMEOUT_MS) // write times out → answer anyway

        // Assert
        expect(SHARED_CACHE_TIMEOUT_MS).toBe(1_000)
        expect(await pending).toBe(9)
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('errors → computes every time, logged once a minute', async () => {
        // Arrange
        const down: SharedCacheBackend = {
            getField: async () => { throw new Error('ECONNRESET') },
            setField: async () => { throw new Error('ECONNRESET') },
            deleteField: async () => { throw new Error('ECONNRESET') },
            deleteHash: async () => { throw new Error('ECONNRESET') },
        }
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const cache = createSharedCache<number>({ namespace: 'n', ttlMs: TTL, maxEntries: 10, backend: down })
        const load = vi.fn(async () => 1)

        // Act
        await cache.get('g', 'k', load)
        await cache.get('g', 'k', load)
        await expect(cache.invalidateGroup('g')).resolves.toBeUndefined()
        vi.advanceTimersByTime(60_001)
        await cache.get('g', 'k', load)

        // Assert
        expect(load).toHaveBeenCalledTimes(3)
        expect(warn).toHaveBeenCalledTimes(2)
    })
})

describe('size cap and the Upstash adapter [TC-PERF-028]', () => {
    it('does not store a value over 200 KB (computed again next time)', async () => {
        // Arrange
        const server = fakeUpstash()
        const cache = createSharedCache<string>({ namespace: 'n', ttlMs: TTL, maxEntries: 10, backend: server.backend })
        const big = 'x'.repeat(SHARED_CACHE_MAX_BYTES + 1)
        const load = vi.fn(async () => big)

        // Act
        await cache.get('g', 'k', load)
        await cache.get('g', 'k', load)

        // Assert
        expect(SHARED_CACHE_MAX_BYTES).toBe(200_000)
        expect(server.client.pipeline).not.toHaveBeenCalled()
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('writes HSET + PEXPIRE in one pipeline and reads raw strings or parsed JSON alike', async () => {
        // Arrange
        const server = fakeUpstash()
        const rawString = { ...server.client, hget: vi.fn(async () => '{"at":1,"v":[1]}') }

        // Act
        await server.backend.setField('sc:n:g', 'k', '{"at":1,"v":[1]}', TTL)
        const parsed = await server.backend.getField('sc:n:g', 'k')
        const raw = await upstashBackend(rawString as UpstashLike).getField('sc:n:g', 'k')

        // Assert
        expect(server.client.pipeline).toHaveBeenCalledTimes(1)
        expect(server.expiries.get('sc:n:g')).toBe(TTL)
        expect(JSON.parse(parsed!)).toEqual({ at: 1, v: [1] })
        expect(raw).toBe('{"at":1,"v":[1]}')
    })
})

describe('shared cache backend switch [TC-PERF-041]', () => {
    it('keeps the caches in memory unless SHARED_CACHE_BACKEND=redis (Upstash stays for rate limits)', async () => {
        const { sharedCacheBackendSetting } = await import('@/lib/cache/shared-cache')
        expect(sharedCacheBackendSetting({})).toBe('memory')
        expect(sharedCacheBackendSetting({ SHARED_CACHE_BACKEND: 'memory' })).toBe('memory')
        expect(sharedCacheBackendSetting({ SHARED_CACHE_BACKEND: ' Redis ' })).toBe('redis')
        expect(sharedCacheBackendSetting({ SHARED_CACHE_BACKEND: 'upstash' })).toBe('memory')
    })
})
