// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import React from 'react'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'

// Firebase doorbell is simulated: tests ring it via `ring()` instead of connecting.
type SignalHandlers = { onSignal: () => void; onModeChange: (m: 'live' | 'fallback') => void }
let signalHandlers: SignalHandlers
vi.mock('@/hooks/use-notification-signal', () => ({
    useNotificationSignal: (h: SignalHandlers) => { signalHandlers = h },
}))
const ring = () => signalHandlers.onSignal()

// ── Mocks ────────────────────────────────────────────────────────────────

let fetchResponse: { unreadCount: number; items: Array<{ id: string; title: string; type?: string; message?: string }> } = {
    unreadCount: 0,
    items: [],
}

function setupFetchMock(response: typeof fetchResponse) {
    fetchResponse = response
}

function renderLiveToastFeature() {
    return render(
        <I18nProvider>
            <NotificationProvider />
            <ToastContainer />
        </I18nProvider>
    )
}

/** Advance fake timers and flush React batched state updates */
async function advanceAndFlush(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })
    // Flush batched React state updates triggered by CustomEvent → setToasts
    await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
    })
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.06] Live Toast Delivery (Firebase signal)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ shouldAdvanceTime: true })
        useNotificationStore.setState({ unreadCount: 0 })

        // Default: no new notifications
        setupFetchMock({ unreadCount: 0, items: [] })

        global.fetch = vi.fn(async () => {
            return {
                ok: true,
                json: async () => fetchResponse,
            }
        }) as unknown as typeof fetch
    })

    afterEach(() => {
        cleanup()
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('displays a single toast when a signal-sync detects a new notification', async () => {
        renderLiveToastFeature()

        // Initial sync — seed seen IDs with empty set
        await advanceAndFlush(100)
        act(() => signalHandlers.onModeChange('live'))
        expect(useNotificationStore.getState().unreadCount).toBe(0)

        // New notification appears; the server rings the doorbell
        setupFetchMock({
            unreadCount: 1,
            items: [{
                id: 'notif-1',
                title: 'New Order #1024',
                type: 'ORDER_NEW',
                message: 'You have a new order',
            }],
        })
        act(() => ring())
        await advanceAndFlush(3_000)

        expect(useNotificationStore.getState().unreadCount).toBe(1)
        expect(screen.getByText('New Order #1024')).toBeInTheDocument()
    })

    it('groups multiple new notifications into burst toast', async () => {
        renderLiveToastFeature()

        // Initial sync
        await advanceAndFlush(100)
        act(() => signalHandlers.onModeChange('live'))

        // Next sync returns 3 new notifications
        setupFetchMock({
            unreadCount: 3,
            items: [
                { id: 'n1', title: 'Order 1' },
                { id: 'n2', title: 'Order 2' },
                { id: 'n3', title: 'Order 3' },
            ],
        })

        act(() => ring())
        await advanceAndFlush(3_000)

        expect(useNotificationStore.getState().unreadCount).toBe(3)
        expect(screen.getByText('3 new notifications')).toBeInTheDocument()
    })

    it('syncs using fetch, not EventSource', async () => {
        renderLiveToastFeature()

        await advanceAndFlush(100)

        expect(global.fetch).toHaveBeenCalled()
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(fetchCall).toContain('/api/notifications')
    })
})
