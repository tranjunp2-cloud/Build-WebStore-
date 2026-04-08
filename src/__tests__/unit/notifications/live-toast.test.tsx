// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { NotificationProvider } from '@/providers/NotificationProvider'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'

// ── Mocks ────────────────────────────────────────────────────────────────

class MockEventSource {
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    close = vi.fn()
    addEventListener = vi.fn((event, callback) => {
        if (event === 'notification') { MockEventSource.notificationListeners.push(callback) }
    })
    removeEventListener = vi.fn()
    static notificationListeners: Function[] = []
    static dispatchNotification(data: any) {
        MockEventSource.notificationListeners.forEach(cb => cb({ data: JSON.stringify(data) }))
    }
    static reset() { MockEventSource.notificationListeners = [] }
}

vi.stubGlobal('EventSource', MockEventSource)

function setupFetchMock(resolvesWith: any) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(resolvesWith),
    }) as unknown as typeof fetch
}

function renderLiveToastFeature() {
    render(
        <I18nProvider>
            <NotificationProvider />
            <ToastContainer />
        </I18nProvider>
    )
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.06] Live Toast SSE Delivery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ shouldAdvanceTime: true })
        MockEventSource.reset()
        useNotificationStore.setState({ unreadCount: 0 })
        
        setupFetchMock({
            unreadCount: 1,
            items: [
                {
                    id: 'notif-1',
                    title: 'New Order #1024',
                    type: 'ORDER_NEW',
                    message: 'You have a new order',
                    isRead: false,
                    createdAt: new Date().toISOString()
                }
            ]
        })
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('displays a single toast and immediately increments badge count', async () => {
        renderLiveToastFeature()
        
        await act(async () => { await Promise.resolve() })

        expect(useNotificationStore.getState().unreadCount).toBe(0)

        act(() => {
            MockEventSource.dispatchNotification({ id: 'notif-1' })
        })
        expect(useNotificationStore.getState().unreadCount).toBe(1)

        await act(async () => {
            vi.advanceTimersByTime(1100)
            await Promise.resolve()
        })

        expect(screen.getByText('New Order #1024')).toBeInTheDocument()
        
        await act(async () => {
            vi.advanceTimersByTime(5500)
            await Promise.resolve()
        })

        expect(screen.queryByText('New Order #1024')).not.toBeInTheDocument()
    })

    it('groups burst events into a single toast', async () => {
        renderLiveToastFeature()
        await act(async () => { await Promise.resolve() })

        act(() => {
            for (let i = 0; i < 50; i++) {
                MockEventSource.dispatchNotification({ id: `notif-${i}` })
            }
        })
        expect(useNotificationStore.getState().unreadCount).toBe(50)

        await act(async () => {
            vi.advanceTimersByTime(1100)
            await Promise.resolve()
        })

        expect(screen.getByText('50 new notifications')).toBeInTheDocument()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('limits visible toasts to a maximum of 3', async () => {
        renderLiveToastFeature()
        await act(async () => { await Promise.resolve() })

        for (let i = 1; i <= 4; i++) {
            setupFetchMock({
                unreadCount: i,
                items: [{ id: `id-${i}`, title: `Toast ${i}` }]
            })
            
            act(() => {
                MockEventSource.dispatchNotification({ id: `id-${i}` })
            })
            await act(async () => {
                vi.advanceTimersByTime(1100) 
                await Promise.resolve() 
            })
        }

        expect(screen.queryByText('Toast 1')).not.toBeInTheDocument()
        expect(screen.getByText('Toast 2')).toBeInTheDocument()
        expect(screen.getByText('Toast 3')).toBeInTheDocument()
        expect(screen.getByText('Toast 4')).toBeInTheDocument()
    })
})
