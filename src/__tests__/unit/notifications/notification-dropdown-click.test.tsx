// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'
import type { NotificationItem as NotificationItemType, NotificationsResponse } from '@/types/notification'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: mockPush })),
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

const mockResponse: NotificationsResponse = {
    unreadCount: 2,
    items: [
        makeNotification({ id: 'notif-1', actionUrl: '/orders?id=1024', isRead: false }),
        makeNotification({ id: 'notif-2', actionUrl: null, isRead: false, type: 'SYSTEM_ALERT', title: 'System Maintenance' }),
    ],
}

function setupFetchMock(response: NotificationsResponse = mockResponse) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
    }) as unknown as typeof fetch
}

async function renderOpenDropdown(response?: NotificationsResponse) {
    const data = response ?? mockResponse
    setupFetchMock(data)
    useNotificationStore.setState({ isDropdownOpen: true, unreadCount: data.unreadCount })
    render(<I18nProvider><NotificationDropdown /></I18nProvider>)
    await waitFor(() => {
        expect(screen.getByText(data.items[0].title)).toBeInTheDocument()
    })
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.06] Click notification with actionUrl — mark read + navigate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('marks unread notification as read and navigates to actionUrl', async () => {
        // Arrange
        await renderOpenDropdown()
        // Reset fetch mock after initial load
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act
        fireEvent.click(screen.getByText('New Order #1024'))

        // Assert — optimistic UI
        expect(useNotificationStore.getState().unreadCount).toBe(1) // decremented from 2
        expect(mockPush).toHaveBeenCalledWith('/orders?id=1024')
        expect(useNotificationStore.getState().isDropdownOpen).toBe(false) // dropdown closed on navigate

        // Assert — API call
        await waitFor(() => {
            const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
            const markReadCall = calls.find(
                (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('mark-read')
            )
            expect(markReadCall).toBeDefined()
            const body = JSON.parse(markReadCall![1].body)
            expect(body.notificationIds).toEqual(['notif-1'])
        })
    })

    it('skips entire action if actionUrl is an external URL (security)', async () => {
        // Arrange
        const response: NotificationsResponse = {
            unreadCount: 1,
            items: [makeNotification({ id: 'notif-ext', actionUrl: 'https://evil.com', isRead: false })],
        }
        await renderOpenDropdown(response)
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act
        fireEvent.click(screen.getByText('New Order #1024'))

        // Assert — no navigation, no mark-read, no state change
        expect(mockPush).not.toHaveBeenCalled()
        expect(useNotificationStore.getState().unreadCount).toBe(1) // unchanged
    })
})

describe('[TC-F16.07] Click notification without actionUrl — mark read + close dropdown', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('marks as read and closes dropdown when no actionUrl', async () => {
        // Arrange
        await renderOpenDropdown()
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act
        fireEvent.click(screen.getByText('System Maintenance'))

        // Assert
        expect(useNotificationStore.getState().unreadCount).toBe(1) // decremented
        expect(mockPush).not.toHaveBeenCalled() // no navigation
        expect(useNotificationStore.getState().isDropdownOpen).toBe(false) // dropdown closed
    })

    it('does nothing when clicking already-read notification without actionUrl', async () => {
        // Arrange
        const response: NotificationsResponse = {
            unreadCount: 0,
            items: [makeNotification({ id: 'notif-read', actionUrl: null, isRead: true, title: 'Old Alert' })],
        }
        await renderOpenDropdown(response)
        const initialCount = useNotificationStore.getState().unreadCount

        // Act
        fireEvent.click(screen.getByText('Old Alert'))

        // Assert — no state changes
        expect(useNotificationStore.getState().unreadCount).toBe(initialCount)
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('[TC-F16.23] Optimistic UI rollback on API failure', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('rolls back isRead and unreadCount when mark-read API returns 500', async () => {
        // Arrange
        await renderOpenDropdown()
        // Mock mark-read API failure
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ success: false }),
        })

        // Act
        fireEvent.click(screen.getByText('New Order #1024'))

        // Assert — optimistic: immediately decremented
        expect(useNotificationStore.getState().unreadCount).toBe(1)

        // Assert — rollback: after API failure, count restored
        await waitFor(() => {
            expect(useNotificationStore.getState().unreadCount).toBe(2)
        })
    })

    it('rolls back isRead and unreadCount on network error', async () => {
        // Arrange
        await renderOpenDropdown()
        // Mock network failure
        ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'))

        // Act
        fireEvent.click(screen.getByText('New Order #1024'))

        // Assert — optimistic
        expect(useNotificationStore.getState().unreadCount).toBe(1)

        // Assert — rollback
        await waitFor(() => {
            expect(useNotificationStore.getState().unreadCount).toBe(2)
        })
    })
})

describe('[TC-F16.06] Double-click race condition guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('does not double-decrement on rapid clicks', async () => {
        // Arrange
        await renderOpenDropdown()
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

        // Act — click same notification twice rapidly
        const item = screen.getByText('New Order #1024')
        fireEvent.click(item)
        fireEvent.click(item)

        // Assert — should only decrement once
        expect(useNotificationStore.getState().unreadCount).toBe(1)
    })
})
