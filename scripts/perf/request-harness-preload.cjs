/**
 * Preload for scripts/perf/measure-hot-requests.ts: runs Next server code (route handlers, server actions,
 * server components' data loading) in a plain tsx process and counts every SQL statement + its time.
 *
 * - `next/headers`: cookies()/headers() answer from the "current request" set by the runner (one per measured call).
 * - React `cache()`: memoised per current request, like React's server renderer does per RSC request.
 * - `next/cache` unstable_cache: pass-through (measures the cold cost); revalidate* are no-ops.
 * - pg Client.prototype.query: counts statements and sums their wall time into globalThis.__sqlStats.
 */
'use strict'
require('../seed-preload.cjs')
const Module = require('module')
const path = require('path')

const stats = { count: 0, ms: 0, texts: [] }
globalThis.__sqlStats = stats
globalThis.__harnessRequest = null

function currentRequest() {
    if (!globalThis.__harnessRequest) throw new Error('harness: no current request')
    return globalThis.__harnessRequest
}

function cookieStore() {
    const req = currentRequest()
    if (!req.cookieStore) {
        const jar = new Map(Object.entries(req.cookies || {}))
        req.cookieStore = {
            get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
            getAll: () => [...jar].map(([name, value]) => ({ name, value })),
            has: (name) => jar.has(name),
            set: (name, value) => { jar.set(name, typeof value === 'object' ? value.value : value) },
            delete: (name) => { jar.delete(name) },
            toString: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        }
    }
    return req.cookieStore
}

const headersStub = {
    cookies: async () => cookieStore(),
    headers: async () => {
        const req = currentRequest()
        return new Headers({ host: 'localhost:3000', cookie: cookieStore().toString(), ...(req.headers || {}) })
    },
    draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
}
const passthrough = (fn) => fn
const cacheStub = {
    unstable_cache: passthrough,
    revalidateTag: () => {},
    revalidatePath: () => {},
    updateTag: () => {},
    refresh: () => {},
    unstable_noStore: () => {},
    noStore: () => {},
    cacheTag: () => {},
    cacheLife: () => {},
    unstable_cacheTag: () => {},
    unstable_cacheLife: () => {},
}

let reactPatched = null
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
    if (request === 'next/headers' || request === 'next/headers.js') return headersStub
    if (request === 'next/cache' || request === 'next/cache.js') return cacheStub
    if (request === 'next/server' || request === 'next/server.js') {
        const real = originalLoad.apply(this, arguments)
        return { ...real, after: (fn) => { Promise.resolve().then(typeof fn === 'function' ? fn : () => fn).catch(() => {}) }, connection: async () => {} }
    }
    if (request === 'react') {
        const real = originalLoad.apply(this, arguments)
        if (!reactPatched) {
            reactPatched = {
                ...real,
                cache(fn) {
                    return function cached(...args) {
                        const req = globalThis.__harnessRequest
                        if (!req) return fn.apply(this, args)
                        req.reactCache ??= new Map()
                        let perFn = req.reactCache.get(fn)
                        if (!perFn) { perFn = new Map(); req.reactCache.set(fn, perFn) }
                        const key = JSON.stringify(args.map((a) => (a && typeof a === 'object' ? (a.id ?? a) : a)))
                        if (!perFn.has(key)) perFn.set(key, fn.apply(this, args))
                        return perFn.get(key)
                    }
                },
            }
        }
        return reactPatched
    }
    return originalLoad.apply(this, arguments)
}

function patchPg(pgPath) {
    const proto = require(pgPath).Client.prototype
    if (proto.__harnessPatched) return
    proto.__harnessPatched = true
    const original = proto.query
    proto.query = function (...args) {
        const config = args[0]
        const text = typeof config === 'string' ? config : config && config.text
        const t0 = performance.now()
        stats.count++
        const done = (failed) => {
            const ms = performance.now() - t0
            stats.ms += ms
            stats.texts.push({ ms, text: (failed ? 'ERR ' : '') + String(text || '').slice(0, 400) })
        }
        const cbIndex = args.findIndex((a, i) => i > 0 && typeof a === 'function')
        if (cbIndex > 0) {
            const cb = args[cbIndex]
            args[cbIndex] = function (err, res) { done(Boolean(err)); return cb.apply(this, arguments) }
        } else if (config && typeof config === 'object' && typeof config.callback === 'function') {
            const cb = config.callback
            config.callback = function (err) { done(Boolean(err)); return cb.apply(this, arguments) }
        }
        const result = original.apply(this, args)
        if (cbIndex < 0 && result && typeof result.then === 'function') {
            return result.then((r) => { done(false); return r }, (e) => { done(true); throw e })
        }
        return result
    }
}

const req = Module.createRequire(path.join(process.cwd(), 'package.json'))
patchPg(req.resolve('pg'))
try { patchPg(req.resolve('pg', { paths: [path.dirname(req.resolve('@payloadcms/db-postgres'))] })) } catch { /* single copy */ }
