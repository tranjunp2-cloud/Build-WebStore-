// @vitest-environment jsdom
/**
 * TC-F16.52 / TC-F16.53 — NotificationProvider: Firebase signal sync + fallback polling (#1972)
 *
 * Replaces the old TC-MIG-NP interval-polling tests. The provider no longer polls
 * while Firebase is live; it fetches on mount, on doorbell signals, tab focus,
 * online and reconnect, and polls every 60s only in fallback mode.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ── Mocks (top-level) ─────────────────────────────────────────────────────────
const mockSetUnreadCount = vi.fn()
vi.mock('@/store/notificationStore', () => ({
    useNotificationStore: vi.fn(() => ({ setUnreadCount: mockSetUnreadCount })),
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { notifications: { toast: { newCount: '{count} new notifications', newNotification: 'New notification' } } },
        ti: (template: string, vars: Record<string, unknown>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
}))

type Handlers = {
    onSignal: () => void
    onBroadcast: () => void
    onReconnect: () => void
    onModeChange: (m: 'live' | 'fallback') => void
}
let handlers: Handlers
vi.mock('@/hooks/use-notification-signal', () => ({
    useNotificationSignal: (h: Handlers) => { handlers = h },
}))

import { NotificationProvider } from '@/providers/NotificationProvider'

// ── Helpers ───────────────────────────────────────────────────────────────────
type Item = { id: string; title: string; createdAt: string; isRead?: boolean; type?: string; message?: string }
let serverItems: Item[]
let fetchMock: ReturnType<typeof vi.fn>

const item = (id: string, createdAt: string, extra: Partial<Item> = {}): Item =>
    ({ id, title: `Title ${id}`, createdAt, isRead: false, ...extra })

function okResponse(): Response {
    return new Response(JSON.stringify({ unreadCount: serverItems.length, items: serverItems }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    })
}

const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))
const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
}

let toasts: Array<{ id: string; title: string }>
const onToast = (e: Event) => toasts.push((e as CustomEvent).detail)
let swTarget: EventTarget

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
    mockSetUnreadCount.mockClear()
    serverItems = []
    toasts = []
    fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    swTarget = new EventTarget()
    Object.defineProperty(navigator, 'serviceWorker', { value: swTarget, configurable: true })
    window.addEventListener('notification-toast', onToast)
    setHidden(false)
})

afterEach(() => {
    cleanup()
    window.removeEventListener('notification-toast', onToast)
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

async function mountLive() {
    await act(async () => { render(<NotificationProvider />) })
    await flush(0)
    act(() => handlers.onModeChange('live'))
}

describe('[TC-F16.52] NotificationProvider — Firebase signal sync', () => {
    it('fetches once on mount (limit=50, no since) and never opens an EventSource', async () => {
        const es = vi.fn()
        vi.stubGlobal('EventSource', es)
        await mountLive()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(urls()[0]).toBe('/api/notifications?limit=50')
        expect(es).not.toHaveBeenCalled()
    })

    it('does NOT fetch periodically while Firebase is live (AC-02)', async () => {
        await mountLive()
        await flush(10 * 60_000)

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('coalesces a burst of signals into ONE fetch (debounce + min gap)', async () => {
        await mountLive()
        act(() => { handlers.onSignal(); handlers.onSignal(); handlers.onSignal(); handlers.onSignal(); handlers.onSignal() })
        await flush(3_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('uses the SERVER createdAt (minus 5s overlap) as watermark, not the client clock', async () => {
        serverItems = [item('a', '2030-01-01T00:00:10.000Z')] // far from the mocked client clock
        await mountLive()
        act(() => handlers.onSignal())
        await flush(3_000)

        const since = new URL(urls()[1], 'http://x').searchParams.get('since')
        expect(since).toBe('2030-01-01T00:00:05.000Z')
    })

    it('toasts only genuinely new unread items; first sync only seeds', async () => {
        serverItems = [item('old', '2026-10-21T09:00:00.000Z')]
        await mountLive()
        expect(toasts).toHaveLength(0)

        serverItems = [item('new', '2026-10-21T10:00:01.000Z'), item('old', '2026-10-21T09:00:00.000Z'), item('read', '2026-10-21T10:00:02.000Z', { isRead: true })]
        act(() => handlers.onSignal())
        await flush(3_000)

        expect(toasts.map((t) => t.id)).toEqual(['new'])
    })

    it('groups several new items into one burst toast', async () => {
        await mountLive()
        serverItems = [item('1', '2026-10-21T10:00:01.000Z'), item('2', '2026-10-21T10:00:02.000Z'), item('3', '2026-10-21T10:00:03.000Z')]
        act(() => handlers.onSignal())
        await flush(3_000)

        expect(toasts).toHaveLength(1)
        expect(toasts[0].title).toBe('3 new notifications')
    })

    it('shows ONE toast when the signal-sync and the SW push carry the same id (AC-08)', async () => {
        await mountLive()
        serverItems = [item('dup', '2026-10-21T10:00:01.000Z')]
        act(() => handlers.onSignal())
        await flush(3_000)
        expect(toasts.map((t) => t.id)).toEqual(['dup'])

        act(() => {
            swTarget.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'PUSH_NOTIFICATION', payload: { id: 'dup', title: 'Title dup' } } }))
        })
        await flush(3_000)

        expect(toasts.map((t) => t.id)).toEqual(['dup'])
    })

    it('shows the push toast when the signal-sync has not seen the id yet', async () => {
        await mountLive()
        act(() => {
            swTarget.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'PUSH_NOTIFICATION', payload: { id: 'p1', title: 'Pushed' } } }))
        })

        expect(toasts.map((t) => t.id)).toEqual(['p1'])
    })

    it('hidden tab: signal only marks dirty; fetch happens when the tab is shown again', async () => {
        await mountLive()
        setHidden(true)
        act(() => handlers.onSignal())
        await flush(10_000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        setHidden(false)
        await flush(3_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('broadcast signal fetches within the 5s jitter window', async () => {
        await mountLive()
        act(() => handlers.onBroadcast())
        await flush(5_000 + 3_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('Firebase reconnect triggers a catch-up fetch (AC-06)', async () => {
        await mountLive()
        act(() => handlers.onReconnect())
        await flush(3_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('429 respects Retry-After before the next fetch', async () => {
        await mountLive()
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }))
        act(() => handlers.onSignal())
        await flush(3_000)
        expect(fetchMock).toHaveBeenCalledTimes(2)

        act(() => handlers.onSignal())
        await flush(10_000)
        expect(fetchMock).toHaveBeenCalledTimes(2) // still blocked

        await flush(20_000)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('401 stops all further fetching (session expired)', async () => {
        await mountLive()
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }))
        act(() => handlers.onSignal())
        await flush(3_000)
        act(() => handlers.onSignal())
        await flush(60_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})

describe('[TC-F16.53] NotificationProvider — fallback polling when Firebase is unavailable', () => {
    it('polls every 60s in fallback mode', async () => {
        await mountLive()
        act(() => handlers.onModeChange('fallback'))
        await flush(60_000)
        expect(fetchMock).toHaveBeenCalledTimes(2)

        await flush(60_000)
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('stops polling once Firebase is live again', async () => {
        await mountLive()
        act(() => handlers.onModeChange('fallback'))
        await flush(60_000)
        act(() => handlers.onModeChange('live'))
        await flush(5 * 60_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('pauses fallback polling while the tab is hidden and catches up on show', async () => {
        await mountLive()
        act(() => handlers.onModeChange('fallback'))
        setHidden(true)
        await flush(5 * 60_000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        setHidden(false)
        await flush(3_000)

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('a failed fetch is retried on the next fallback tick (no crash)', async () => {
        await mountLive()
        fetchMock.mockRejectedValueOnce(new Error('network'))
        act(() => handlers.onModeChange('fallback'))
        await flush(60_000)
        await flush(60_000)

        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
})
