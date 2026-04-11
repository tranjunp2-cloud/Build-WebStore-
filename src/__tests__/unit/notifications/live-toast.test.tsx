// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import React from 'react'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'

// ── Mocks ────────────────────────────────────────────────────────────────

let fetchCallCount = 0
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

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.06] Live Toast Polling Delivery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ shouldAdvanceTime: true })
        fetchCallCount = 0
        useNotificationStore.setState({ unreadCount: 0 })

        // Default: no new notifications
        setupFetchMock({ unreadCount: 0, items: [] })

        global.fetch = vi.fn(async () => {
            fetchCallCount++
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

    it('displays a single toast when polling detects new notification', async () => {
        renderLiveToastFeature()

        // Initial poll — no notifications
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })
        expect(useNotificationStore.getState().unreadCount).toBe(0)

        // Simulate new notification appearing on next poll
        setupFetchMock({
            unreadCount: 1,
            items: [{
                id: 'notif-1',
                title: 'New Order #1024',
                type: 'ORDER_NEW',
                message: 'You have a new order',
            }],
        })

        // Advance to next poll (15s)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(15500)
        })

        expect(useNotificationStore.getState().unreadCount).toBe(1)
        expect(screen.getByText('New Order #1024')).toBeInTheDocument()
    })

    it('groups multiple new notifications into burst toast', async () => {
        renderLiveToastFeature()

        // Initial poll
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })

        // Next poll returns 3 new notifications
        setupFetchMock({
            unreadCount: 3,
            items: [
                { id: 'n1', title: 'Order 1' },
                { id: 'n2', title: 'Order 2' },
                { id: 'n3', title: 'Order 3' },
            ],
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(15500)
        })

        expect(useNotificationStore.getState().unreadCount).toBe(3)
        expect(screen.getByText('3 new notifications')).toBeInTheDocument()
    })

    it('polls using fetch, not EventSource', async () => {
        renderLiveToastFeature()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })

        expect(global.fetch).toHaveBeenCalled()
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
        expect(fetchCall).toContain('/api/notifications')
    })
})
