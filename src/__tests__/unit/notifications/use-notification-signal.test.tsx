// @vitest-environment jsdom
/**
 * TC-F16.55 — useNotificationSignal: token → sign-in → listeners, fallback, retry, cancel (#1972)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Fake Firebase: onValue registry keyed by path ─────────────────────────────
type Listener = { cb: (snap: { val: () => unknown }) => void; err?: (e: Error) => void; off: ReturnType<typeof vi.fn> }
const listeners = new Map<string, Listener>()
vi.mock('firebase/database', () => ({
    ref: (_db: unknown, path: string) => path,
    onValue: (path: string, cb: Listener['cb'], err?: Listener['err']) => {
        const off = vi.fn()
        listeners.set(path, { cb, err, off })
        return off
    },
}))

const mockSignOut = vi.fn().mockResolvedValue(undefined)
const mockConnect = vi.fn()
vi.mock('@/lib/firebase/firebase-client', () => ({
    connectFirebaseClient: (...a: unknown[]) => mockConnect(...a),
}))

import { useNotificationSignal } from '@/hooks/use-notification-signal'

const TOKEN_OK = {
    enabled: true, token: 'tok',
    config: { apiKey: 'k', databaseURL: 'https://x.firebasedatabase.app', projectId: 'p' },
    userPath: 'pw2/staging/u/7', broadcastPath: 'pw2/staging/broadcast',
}
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
let h: { onSignal: ReturnType<typeof vi.fn>; onBroadcast: ReturnType<typeof vi.fn>; onReconnect: ReturnType<typeof vi.fn>; onModeChange: ReturnType<typeof vi.fn> }
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const modes = () => h.onModeChange.mock.calls.map((c) => c[0])
const connected = (v: boolean) => listeners.get('.info/connected')!.cb({ val: () => v })

beforeEach(() => {
    vi.useFakeTimers()
    listeners.clear()
    mockSignOut.mockClear()
    h = { onSignal: vi.fn(), onBroadcast: vi.fn(), onReconnect: vi.fn(), onModeChange: vi.fn() }
    fetchMock = vi.fn(async () => json(TOKEN_OK))
    vi.stubGlobal('fetch', fetchMock)
    mockConnect.mockReset()
    mockConnect.mockResolvedValue({ db: {}, auth: { signOut: mockSignOut } })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

const mount = () => renderHook(() => useNotificationSignal(h))

describe('[TC-F16.55] useNotificationSignal', () => {
    it('subscribes to the server-provided paths and goes live when connected', async () => {
        mount(); await flush()

        expect([...listeners.keys()].sort()).toEqual(['.info/connected', 'pw2/staging/broadcast', 'pw2/staging/u/7'])
        connected(true)
        expect(modes()).toEqual(['live'])
        expect(h.onReconnect).not.toHaveBeenCalled() // first connect is not a "reconnect"
    })

    it('forwards the FIRST snapshot too (covers events created before attach) and later ones', async () => {
        mount(); await flush()

        listeners.get('pw2/staging/u/7')!.cb({ val: () => null })
        listeners.get('pw2/staging/u/7')!.cb({ val: () => ({ at: 1 }) })
        listeners.get('pw2/staging/broadcast')!.cb({ val: () => ({ at: 2 }) })

        expect(h.onSignal).toHaveBeenCalledTimes(2)
        expect(h.onBroadcast).toHaveBeenCalledTimes(1)
    })

    it('fires onReconnect on connect → disconnect → connect', async () => {
        mount(); await flush()
        connected(true); connected(false); connected(true)

        expect(h.onReconnect).toHaveBeenCalledTimes(1)
    })

    it('dropped for 30s after being live → fallback; reconnect → live again + onReconnect', async () => {
        mount(); await flush()
        connected(true)
        connected(false)

        await flush(29_000)
        expect(modes()).toEqual(['live']) // short blips do not start polling
        await flush(1_000)
        expect(modes()).toEqual(['live', 'fallback'])

        connected(true)
        expect(modes()).toEqual(['live', 'fallback', 'live'])
        expect(h.onReconnect).toHaveBeenCalledTimes(1)
    })

    it('a drop shorter than 30s stays live (timer cancelled on reconnect)', async () => {
        mount(); await flush()
        connected(true); connected(false)
        await flush(10_000)
        connected(true)

        await flush(60_000)
        expect(modes()).toEqual(['live'])
    })

    it('enabled:false → fallback, no retry, no Firebase connection', async () => {
        fetchMock.mockResolvedValue(json({ enabled: false }))
        mount(); await flush(5 * 60_000)

        expect(modes()).toEqual(['fallback'])
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(mockConnect).not.toHaveBeenCalled()
    })

    it('401 → fallback, final (no retry)', async () => {
        fetchMock.mockResolvedValue(json({}, 401))
        mount(); await flush(5 * 60_000)

        expect(modes()).toEqual(['fallback'])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('5xx → fallback now, retries with backoff and recovers', async () => {
        fetchMock.mockResolvedValueOnce(json({}, 503))
        mount(); await flush()
        expect(modes()).toEqual(['fallback'])

        await flush(30_000) // first retry delay
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(mockConnect).toHaveBeenCalledTimes(1)
        connected(true)
        expect(modes().at(-1)).toBe('live')
    })

    it('network error on token fetch → fallback + retry', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        mount(); await flush()
        await flush(30_000)

        expect(modes()[0]).toBe('fallback')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('permission denied → fallback and STAYS in fallback even if Firebase later reports connected (AC-07)', async () => {
        mount(); await flush()
        listeners.get('pw2/staging/u/7')!.err!(new Error('permission_denied'))
        expect(modes()).toEqual(['fallback'])

        connected(true)

        expect(modes()).toEqual(['fallback'])
        expect(h.onReconnect).not.toHaveBeenCalled()
    })

    it('never connected within 15s (blocked network) → fallback', async () => {
        mount(); await flush(15_000)

        expect(modes()).toEqual(['fallback'])
    })

    it('a hung token fetch also ends in fallback after 15s', async () => {
        fetchMock.mockReturnValue(new Promise(() => {}))
        mount(); await flush(15_000)

        expect(modes()).toEqual(['fallback'])
    })

    it('unmount unsubscribes every listener and signs out; denial callbacks after that are ignored', async () => {
        const { unmount } = mount(); await flush()
        const errCb = listeners.get('pw2/staging/u/7')!.err!
        const offs = [...listeners.values()].map((l) => l.off)

        unmount()
        errCb(new Error('permission_denied after signout'))

        offs.forEach((off) => expect(off).toHaveBeenCalledTimes(1))
        expect(mockSignOut).toHaveBeenCalledTimes(1)
        expect(modes()).not.toContain('fallback')
    })

    it('unmount while connecting: attaches nothing and does NOT sign out the shared auth (StrictMode / layout switch)', async () => {
        let release!: (v: unknown) => void
        mockConnect.mockReturnValue(new Promise((r) => { release = r }))
        const { unmount } = mount(); await flush()

        unmount()
        release({ db: {}, auth: { signOut: mockSignOut } }); await flush()

        expect(listeners.size).toBe(0)
        expect(mockSignOut).not.toHaveBeenCalled()
    })
})
