// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'
import type { NotificationItem as NotificationItemType, NotificationsResponse } from '@/types/notification'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────

import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

// ── Helpers ──────────────────────────────────────────────────────────────

const makeNotification = (overrides: Partial<NotificationItemType> = {}): NotificationItemType => ({
    id: 'notif-1',
    type: 'ORDER_NEW',
    title: 'New Order #1024',
    message: 'You have a new order',
    actionUrl: '/orders?id=1024',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
})

function setupFetchMock(response: NotificationsResponse) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
    }) as unknown as typeof fetch
}

async function renderWithNotifications(items: NotificationItemType[], unreadCount: number) {
    const response: NotificationsResponse = { unreadCount, items }
    setupFetchMock(response)
    useNotificationStore.setState({ isDropdownOpen: true, unreadCount })
    render(<I18nProvider><NotificationDropdown /></I18nProvider>)
    await waitFor(() => {
        expect(screen.getByText(items[0].title)).toBeInTheDocument()
    })
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.08] Mark All as Read — optimistic UI + API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('marks all 15 unread notifications as read and resets badge to 0', async () => {
        // Arrange — 15 unread items
        const items = Array.from({ length: 15 }, (_, i) =>
            makeNotification({ id: `n-${i}`, title: `Order #${i}`, isRead: false })
        )
        await renderWithNotifications(items, 15)
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act
        fireEvent.click(screen.getByText(/mark all/i))

        // Assert — optimistic UI
        expect(useNotificationStore.getState().unreadCount).toBe(0)

        // Assert — API call with mark_all: true
        await waitFor(() => {
            const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
            const markAllCall = calls.find(
                (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('mark-read')
            )
            expect(markAllCall).toBeDefined()
            const body = JSON.parse(markAllCall![1].body)
            expect(body.mark_all).toBe(true)
        })
    })

    it('all items show read styling after mark all', async () => {
        // Arrange
        const items = [
            makeNotification({ id: 'n-1', title: 'Order A', isRead: false }),
            makeNotification({ id: 'n-2', title: 'Order B', isRead: false }),
        ]
        await renderWithNotifications(items, 2)
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act
        fireEvent.click(screen.getByText(/mark all/i))

        // Assert — both items should have read styling (font-normal, dimmed)
        await waitFor(() => {
            const titleA = screen.getByText('Order A')
            const titleB = screen.getByText('Order B')
            expect(titleA.className).toContain('font-normal')
            expect(titleB.className).toContain('font-normal')
        })
    })
})

describe('[TC-F16.09] Mark All disabled when unreadCount = 0', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('button is disabled when all notifications are already read', async () => {
        // Arrange — all read
        const items = [
            makeNotification({ id: 'n-1', title: 'Read Item', isRead: true }),
        ]
        const response: NotificationsResponse = { unreadCount: 0, items }
        setupFetchMock(response)
        useNotificationStore.setState({ isDropdownOpen: true, unreadCount: 0 })
        render(<I18nProvider><NotificationDropdown /></I18nProvider>)
        await waitFor(() => {
            expect(screen.getByText('Read Item')).toBeInTheDocument()
        })

        // Assert
        const markAllBtn = screen.getByText(/mark all/i)
        expect(markAllBtn.closest('button')).toBeDisabled()
    })

    it('button is enabled when there are unread notifications', async () => {
        // Arrange
        const items = [makeNotification({ id: 'n-1', title: 'Unread', isRead: false })]
        await renderWithNotifications(items, 1)

        // Assert
        const markAllBtn = screen.getByText(/mark all/i)
        expect(markAllBtn.closest('button')).not.toBeDisabled()
    })
})

describe('[TC-F16.23] Mark All — rollback on API failure', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('rolls back all items and badge on API 500', async () => {
        // Arrange
        const items = [
            makeNotification({ id: 'n-1', title: 'Order A', isRead: false }),
            makeNotification({ id: 'n-2', title: 'Order B', isRead: false }),
            makeNotification({ id: 'n-3', title: 'Order C', isRead: true }),
        ]
        await renderWithNotifications(items, 2)
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })

        // Act
        fireEvent.click(screen.getByText(/mark all/i))

        // Assert — optimistic: immediately 0
        expect(useNotificationStore.getState().unreadCount).toBe(0)

        // Assert — rollback: restored to 2
        await waitFor(() => {
            expect(useNotificationStore.getState().unreadCount).toBe(2)
        })

        // Assert — items reverted to unread styling
        await waitFor(() => {
            const titleA = screen.getByText('Order A')
            expect(titleA.className).toContain('font-semibold')
        })
    })

    it('rolls back on network error', async () => {
        // Arrange
        const items = [makeNotification({ id: 'n-1', title: 'Order X', isRead: false })]
        await renderWithNotifications(items, 1)
        ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'))

        // Act
        fireEvent.click(screen.getByText(/mark all/i))

        // Assert — rollback
        await waitFor(() => {
            expect(useNotificationStore.getState().unreadCount).toBe(1)
        })
    })
})
