// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import type { NotificationItem as NotificationItemType, NotificationsResponse } from '@/types/notification'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

// ── Helpers ──────────────────────────────────────────────────────────────

const makeNotification = (i: number): NotificationItemType => ({
    id: `notif-${i}`,
    type: 'ORDER_NEW',
    title: `New Order #ORD-MPZBD2MD-C5A57${i} - MYR 61.00`,
    message: 'Order placed by aiorder',
    actionUrl: `/orders?id=${i}`,
    isRead: false,
    createdAt: new Date().toISOString(),
})

const responseWith = (count: number): NotificationsResponse => ({
    unreadCount: count,
    items: Array.from({ length: count }, (_, i) => makeNotification(i)),
})

function setupFetchMock(response: NotificationsResponse) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
    }) as unknown as typeof fetch
}

async function renderOpen(count: number) {
    const data = responseWith(count)
    setupFetchMock(data)
    useNotificationStore.setState({ isDropdownOpen: true, unreadCount: count })
    render(<I18nProvider><NotificationDropdown /></I18nProvider>)
    await waitFor(() => {
        expect(screen.getByText(data.items[0].title)).toBeInTheDocument()
    })
    return data
}

const titleOf = (i: number) => `New Order #ORD-MPZBD2MD-C5A57${i} - MYR 61.00`

// ── Tests ────────────────────────────────────────────────────────────────

describe('[TC-F16.28] Collapsed preview shows whole items only + correct footer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows all 4 items + "Close" when count fits the preview (no "View all")', async () => {
        // Arrange / Act — exactly 4 (the design preview limit) fits fully
        await renderOpen(4)

        // Assert — all 4 rendered, footer is Close, no View all
        expect(screen.getByText(titleOf(0))).toBeInTheDocument()
        expect(screen.getByText(titleOf(3))).toBeInTheDocument()
        expect(screen.getByText(en.notifications.close)).toBeInTheDocument()
        expect(screen.queryByText(en.notifications.viewAll)).not.toBeInTheDocument()
    })

    it('with 5 items: shows exactly 4 complete items + "View all" (no clipped 5th)', async () => {
        // Arrange / Act
        await renderOpen(5)

        // Assert — only first 4 rendered (5th NOT in DOM, so never a half-clipped sliver)
        expect(screen.getByText(titleOf(0))).toBeInTheDocument()
        expect(screen.getByText(titleOf(3))).toBeInTheDocument()
        expect(screen.queryByText(titleOf(4))).not.toBeInTheDocument()
        expect(screen.getByText(en.notifications.viewAll)).toBeInTheDocument()
        expect(screen.queryByText(en.notifications.close)).not.toBeInTheDocument()
    })

    it('clicking "View all" reveals the remaining items and swaps footer to "Close"', async () => {
        // Arrange
        await renderOpen(5)

        // Act
        fireEvent.click(screen.getByText(en.notifications.viewAll))

        // Assert — 5th item now visible, footer is Close
        await waitFor(() => {
            expect(screen.getByText(titleOf(4))).toBeInTheDocument()
        })
        expect(screen.getByText(en.notifications.close)).toBeInTheDocument()
        expect(screen.queryByText(en.notifications.viewAll)).not.toBeInTheDocument()
    })
})
