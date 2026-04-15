// @vitest-environment jsdom
/**
 * TC-MIG-NP — Vercel Migration: NotificationProvider polling
 *
 * Before migration: used SSE EventSource (/api/notifications/stream)
 * After migration:  uses setTimeout-based polling (/api/notifications?since=)
 *
 * Vercel serverless does not support long-lived SSE connections, so the
 * provider was rewritten to use short-lived HTTP GET polling.
 *
 * Source: src/providers/NotificationProvider.tsx
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ── Mocks — must be at TOP before component import ───────────────────────────

const mockSetUnreadCount = vi.fn()

vi.mock('@/store/notificationStore', () => ({
    useNotificationStore: vi.fn(() => ({
        setUnreadCount: mockSetUnreadCount,
    })),
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            notifications: {
                toast: {
                    newCount: '{count} new notifications',
                },
            },
        },
        ti: (template: string, vars: Record<string, unknown>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
}))

// ── Source import (AFTER mocks) ───────────────────────────────────────────────
import { NotificationProvider } from '@/providers/NotificationProvider'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNotificationsResponse(
    overrides: Partial<{ unreadCount: number; items: unknown[] }> = {},
) {
    return {
        unreadCount: 0,
        items: [],
        ...overrides,
    }
}

function makeFetchOk(body: unknown): Promise<Response> {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
}

function makeFetchError(status = 500): Promise<Response> {
    return Promise.resolve(new Response('Internal Server Error', { status }))
}

// ── TC-MIG-NP.01 ─────────────────────────────────────────────────────────────
describe('[TC-MIG-NP.01] Uses setTimeout polling, not EventSource', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockSetUnreadCount.mockClear()
        vi.stubGlobal(
            'fetch',
            vi.fn(() => makeFetchOk(buildNotificationsResponse({ unreadCount: 2 }))),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('TC-MIG-NP.01: NotificationProvider does NOT construct an EventSource', async () => {
        // Arrange — spy to detect any EventSource usage
        const EventSourceSpy = vi.fn()
        vi.stubGlobal('EventSource', EventSourceSpy)

        // Act — mount and let the initial async poll complete
        await act(async () => {
            render(<NotificationProvider />)
            // Advance just enough for the initial poll's microtasks to flush
            await vi.advanceTimersByTimeAsync(0)
        })

        // Assert
        expect(EventSourceSpy).not.toHaveBeenCalled()
    })

    it('TC-MIG-NP.01: provider returns null (headless — no DOM output)', () => {
        // Arrange + Act — render synchronously without advancing timers
        // (avoids the recursive scheduleNext loop)
        const { container } = render(<NotificationProvider />)

        // Assert
        expect(container).toBeEmptyDOMElement()
    })

    it('TC-MIG-NP.01: fetch is called on mount (initial poll fires immediately)', async () => {
        // Arrange
        const fetchMock = vi.fn(() => makeFetchOk(buildNotificationsResponse()))
        vi.stubGlobal('fetch', fetchMock)

        // Act — mount and flush initial poll microtasks only (no timer advancement)
        await act(async () => {
            render(<NotificationProvider />)
            // The initial poll() is called directly (not via setTimeout) in the effect
            await Promise.resolve()
        })

        // Assert — initial poll fires without waiting for the 15s interval
        expect(fetchMock).toHaveBeenCalled()
    })
})

// ── TC-MIG-NP.02 ─────────────────────────────────────────────────────────────
describe('[TC-MIG-NP.02] Polls /api/notifications with ?since= param', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.useFakeTimers()
        mockSetUnreadCount.mockClear()
        fetchMock = vi.fn(() => makeFetchOk(buildNotificationsResponse({ unreadCount: 3 })))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('TC-MIG-NP.02: fetch URL starts with /api/notifications', async () => {
        // Arrange + Act
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Assert
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/^\/api\/notifications/)
    })

    it('TC-MIG-NP.02: fetch URL includes ?since= query param', async () => {
        // Arrange + Act
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Assert
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/[?&]since=/)
    })

    it('TC-MIG-NP.02: since param is a valid ISO 8601 timestamp', async () => {
        // Arrange + Act
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Assert — extract the since value and parse it
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
        const sinceEncoded = url.split('since=')[1]
        const since = decodeURIComponent(sinceEncoded)
        expect(new Date(since).toString()).not.toBe('Invalid Date')
    })

    it('TC-MIG-NP.02: fetch called with AbortController signal', async () => {
        // Arrange + Act
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Assert
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(init?.signal).toBeDefined()
        expect(init?.signal).toBeInstanceOf(AbortSignal)
    })

    it('TC-MIG-NP.02: setUnreadCount called with server unread value after poll', async () => {
        // Arrange + Act
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Assert
        expect(mockSetUnreadCount).toHaveBeenCalledWith(3)
    })
})

// ── TC-MIG-NP.03 ─────────────────────────────────────────────────────────────
describe('[TC-MIG-NP.03] Pauses polling when tab is hidden', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.useFakeTimers()
        mockSetUnreadCount.mockClear()
        // Stub Notification.permission = 'granted' → POLL_SLOW_MS (60s) for deterministic timing
        vi.stubGlobal('Notification', { permission: 'granted' })
        fetchMock = vi.fn(() => makeFetchOk(buildNotificationsResponse()))
        vi.stubGlobal('fetch', fetchMock)
        Object.defineProperty(document, 'hidden', {
            value: false,
            writable: true,
            configurable: true,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        Object.defineProperty(document, 'hidden', {
            value: false,
            writable: true,
            configurable: true,
        })
    })

    it('TC-MIG-NP.03: stops scheduling new polls when tab becomes hidden', async () => {
        // Arrange — mount and complete initial poll
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        const callsBeforeHide = fetchMock.mock.calls.length

        // Act — hide the tab then advance 60s
        await act(async () => {
            Object.defineProperty(document, 'hidden', {
                value: true,
                writable: true,
                configurable: true,
            })
            document.dispatchEvent(new Event('visibilitychange'))
            await vi.advanceTimersByTimeAsync(60_000)
        })

        // Assert — no additional scheduled polls fired while hidden
        expect(fetchMock.mock.calls.length).toBe(callsBeforeHide)
    })

    it('TC-MIG-NP.03: resumes polling when tab becomes visible again', async () => {
        // Arrange — mount and let initial poll complete
        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Hide the tab (cancels the next scheduled poll)
        await act(async () => {
            Object.defineProperty(document, 'hidden', {
                value: true,
                writable: true,
                configurable: true,
            })
            document.dispatchEvent(new Event('visibilitychange'))
        })

        const callsWhileHidden = fetchMock.mock.calls.length

        // Act — show the tab again (triggers an immediate re-poll)
        await act(async () => {
            Object.defineProperty(document, 'hidden', {
                value: false,
                writable: true,
                configurable: true,
            })
            document.dispatchEvent(new Event('visibilitychange'))
            // Flush the microtasks from the immediate poll() call
            await Promise.resolve()
            await Promise.resolve()
        })

        // Assert — at least one more fetch was triggered by the visibility restore
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsWhileHidden)
    })

    it('TC-MIG-NP.03: visibilitychange listener is removed on unmount (cleanup)', async () => {
        // Arrange
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

        const { unmount } = render(<NotificationProvider />)

        // Act
        unmount()

        // Assert
        expect(removeListenerSpy).toHaveBeenCalledWith(
            'visibilitychange',
            expect.any(Function),
        )
        removeListenerSpy.mockRestore()
    })
})

// ── TC-MIG-NP.04 ─────────────────────────────────────────────────────────────
describe('[TC-MIG-NP.04] Exponential backoff on consecutive errors', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockSetUnreadCount.mockClear()
        // Stub Notification.permission = 'granted' so getBasePollInterval() returns
        // POLL_SLOW_MS (60s), making backoff timings deterministic for these tests
        vi.stubGlobal('Notification', { permission: 'granted' })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('TC-MIG-NP.04: interval grows to 120s after a fetch error', async () => {
        /**
         * Sequence:
         *   t=0:    initial poll fires (success) → schedules next at t=60s
         *   t=60s:  second poll fires (error)    → interval doubles to 120s
         *   t=120s: NO fetch (120s not elapsed yet from error)
         *   t=180s: third poll fires at 120s after the error
         */
        let callCount = 0
        const fetchMock = vi.fn(() => {
            callCount++
            if (callCount === 1) return makeFetchOk(buildNotificationsResponse())
            return makeFetchError(500)
        })
        vi.stubGlobal('fetch', fetchMock)

        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Advance 60s → second poll fires and fails
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)

        const callsAfterFirstError = fetchMock.mock.calls.length

        // Advance another 60s — backoff means NO new poll yet (interval is now 120s)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(fetchMock.mock.calls.length).toBe(callsAfterFirstError)

        // Advance remaining 60s — now 120s has passed since error → poll fires
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirstError)
    })

    it('TC-MIG-NP.04: backoff is capped and polling continues (not stalled forever)', async () => {
        /**
         * Every call fails. We drive through the backoff schedule:
         *   t=0:    initial poll → error → interval=120s
         *   t=120s: poll → error → interval=120s (capped at 120s)
         *   t=240s: poll → error → interval=120s (capped)
         *   t=360s: poll → error → interval=120s (capped)
         *
         * After 360s we expect at least 4 fetch calls total.
         */
        const fetchMock = vi.fn(() => makeFetchError(503))
        vi.stubGlobal('fetch', fetchMock)

        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // Drive through 3 more backoff cycles
        for (const step of [120_000, 120_000, 120_000]) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(step)
            })
        }

        // At least 4 calls: initial + 3 after backoff
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4)
    })

    it('TC-MIG-NP.04: interval resets to 60s after a successful poll following an error', async () => {
        /**
         * Sequence:
         *   initial → error → interval=120s
         *   t=120s → success → interval resets to 60s
         *   t=180s → next poll fires (confirms 60s reset, not 120s)
         */
        let callCount = 0
        const fetchMock = vi.fn(() => {
            callCount++
            if (callCount === 1) return makeFetchError(500)
            return makeFetchOk(buildNotificationsResponse())
        })
        vi.stubGlobal('fetch', fetchMock)

        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // t=120s: call #2 fires (backoff interval), succeeds → resets to 60s
        await act(async () => {
            await vi.advanceTimersByTimeAsync(120_000)
        })
        const callsAfterReset = fetchMock.mock.calls.length
        expect(callsAfterReset).toBeGreaterThanOrEqual(2)

        // t=180s: if interval reset to 60s, call #3 should fire
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterReset)
    })
})

// ── TC-MIG-NP.05 ─────────────────────────────────────────────────────────────
describe('[TC-MIG-NP.05] AbortController prevents overlapping fetches', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockSetUnreadCount.mockClear()
        // Stub Notification.permission = 'granted' → POLL_SLOW_MS (60s) for deterministic timing
        vi.stubGlobal('Notification', { permission: 'granted' })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('TC-MIG-NP.05: each poll provides a new AbortSignal', async () => {
        // Arrange — two successful polls, capture their signals
        const signals: (AbortSignal | undefined)[] = []
        const fetchMock = vi.fn((_url: string, init: RequestInit) => {
            signals.push(init?.signal as AbortSignal | undefined)
            return makeFetchOk(buildNotificationsResponse())
        })
        vi.stubGlobal('fetch', fetchMock)

        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve() // initial poll (signal #1)
        })

        // Advance 60s → second poll fires (signal #2)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })

        // Assert — at least two calls, each with their own AbortSignal
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
        expect(signals[0]).toBeInstanceOf(AbortSignal)
        expect(signals[1]).toBeInstanceOf(AbortSignal)
        // Different controller instances
        expect(signals[0]).not.toBe(signals[1])
    })

    it('TC-MIG-NP.05: AbortError from aborted fetch is swallowed (no backoff)', async () => {
        /**
         * Sequence:
         *   call #1 (initial): resolves OK → interval stays at 60s
         *   call #2 (t=60s):   rejects with AbortError → interval MUST stay at 60s
         *   call #3 (t=120s):  fires at the normal 60s interval (not backed-off 120s)
         */
        let callCount = 0
        const fetchMock = vi.fn(() => {
            callCount++
            if (callCount === 2) {
                const err = new Error('The operation was aborted')
                err.name = 'AbortError'
                return Promise.reject(err)
            }
            return makeFetchOk(buildNotificationsResponse())
        })
        vi.stubGlobal('fetch', fetchMock)

        await act(async () => {
            render(<NotificationProvider />)
            await Promise.resolve()
        })

        // t=60s: call #2 fires (AbortError)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(callCount).toBeGreaterThanOrEqual(2)

        const callsAfterAbort = fetchMock.mock.calls.length

        // t=120s: call #3 should fire at 60s after abort (no backoff)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterAbort)
    })

    it('TC-MIG-NP.05: pending AbortController is aborted on unmount', async () => {
        // Arrange — track abort events on the signal provided to fetch
        let capturedSignal: AbortSignal | null = null

        const fetchMock = vi.fn((_url: string, init: RequestInit) => {
            capturedSignal = init?.signal as AbortSignal
            // Return a promise that never resolves (simulates in-flight request)
            return new Promise<Response>(() => {})
        })
        vi.stubGlobal('fetch', fetchMock)

        const { unmount } = render(<NotificationProvider />)

        // Wait for the initial poll() to be called (signal captured)
        await act(async () => {
            await Promise.resolve()
        })

        // The fetch was called and signal is captured
        expect(capturedSignal).toBeInstanceOf(AbortSignal)
        expect((capturedSignal as AbortSignal).aborted).toBe(false)

        // Act — unmount triggers cleanup → abortRef.current.abort()
        unmount()

        // Assert — the signal is now aborted
        expect((capturedSignal as AbortSignal).aborted).toBe(true)
    })
})
