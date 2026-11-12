// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import type { NotificationItem as NotificationItemType, NotificationsResponse } from '@/types/notification'

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

// ── Helpers ──────────────────────────────────────────────────────────────

const make = (i: number): NotificationItemType => ({
    id: `notif-${i}`,
    type: 'ORDER_NEW',
    title: `Order number ${i}`,
    message: 'placed',
    actionUrl: null,
    isRead: true,
    createdAt: new Date().toISOString(),
})
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => make(from + k))
const page = (items: NotificationItemType[], extra: Partial<NotificationsResponse> = {}): NotificationsResponse =>
    ({ unreadCount: 0, items, ...extra })
const ok = (body: NotificationsResponse) => ({ ok: true, json: () => Promise.resolve(body) })

let observerCallbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = []

/** Simulate the sentinel scrolling into view. */
async function scrollToBottom() {
    await act(async () => {
        observerCallbacks.forEach((cb) => cb([{ isIntersecting: true }]))
    })
}

async function openExpanded(first: NotificationsResponse, fetchMock: ReturnType<typeof vi.fn>) {
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValueOnce(ok(first))
    useNotificationStore.setState({ isDropdownOpen: true, unreadCount: 0 })
    render(<I18nProvider><NotificationDropdown /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Order number 0')).toBeInTheDocument())
    fireEvent.click(screen.getByText(en.notifications.viewAll))
}

describe('[TC-F16.16] Notification dropdown infinite scroll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        observerCallbacks = []
        vi.stubGlobal('IntersectionObserver', class {
            constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { observerCallbacks.push(cb) }
            observe() {}
            disconnect() { observerCallbacks = [] }
        })
    })
    afterEach(() => { vi.unstubAllGlobals() })

    it('loads the next page at offset 20 and shows all 27 items without duplicates', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 20)), fetchMock)
        // second page overlaps one id (19) to prove dedupe
        fetchMock.mockResolvedValueOnce(ok(page(range(19, 27), { hasMore: false })))

        await scrollToBottom()

        await waitFor(() => expect(screen.getByText('Order number 26')).toBeInTheDocument())
        expect(fetchMock).toHaveBeenLastCalledWith('/api/notifications?limit=20&offset=20')
        expect(screen.getAllByText(/^Order number \d+$/)).toHaveLength(27)
    })

    it('stops requesting once the API reports hasMore=false', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 20)), fetchMock)
        fetchMock.mockResolvedValueOnce(ok(page(range(20, 27), { hasMore: false })))
        await scrollToBottom()
        await waitFor(() => expect(screen.getByText('Order number 26')).toBeInTheDocument())

        await scrollToBottom()

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not load more when the first page is shorter than the page size', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 10)), fetchMock)

        await scrollToBottom()

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('keeps loaded items and offers Retry when loading more fails', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 20)), fetchMock)
        fetchMock.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) })

        await scrollToBottom()

        await waitFor(() => expect(screen.getByText(en.notifications.retry)).toBeInTheDocument())
        expect(screen.getByText('Order number 0')).toBeInTheDocument()

        fetchMock.mockResolvedValueOnce(ok(page(range(20, 27), { hasMore: false })))
        fireEvent.click(screen.getByText(en.notifications.retry))
        await waitFor(() => expect(screen.getByText('Order number 26')).toBeInTheDocument())
    })

    it('does not fire overlapping requests while one is in flight', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 20)), fetchMock)
        fetchMock.mockReturnValueOnce(new Promise(() => {}))

        await scrollToBottom()
        await scrollToBottom()

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('discards a slow load-more response that lands after the dropdown was closed and reopened', async () => {
        const fetchMock = vi.fn()
        await openExpanded(page(range(0, 20)), fetchMock)
        let resolveSlow!: (v: unknown) => void
        fetchMock.mockReturnValueOnce(new Promise((r) => { resolveSlow = r }))
        await scrollToBottom()

        act(() => { useNotificationStore.setState({ isDropdownOpen: false }) })
        fetchMock.mockResolvedValueOnce(ok(page(range(100, 120))))
        act(() => { useNotificationStore.setState({ isDropdownOpen: true }) })
        await waitFor(() => expect(screen.getByText('Order number 100')).toBeInTheDocument())
        await act(async () => { resolveSlow(ok(page(range(20, 27), { hasMore: false }))) })

        expect(screen.queryByText('Order number 26')).not.toBeInTheDocument()
    })
})
