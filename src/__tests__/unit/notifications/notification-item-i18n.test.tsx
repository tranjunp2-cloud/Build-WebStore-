// @vitest-environment jsdom
/**
 * TC-F16.20 — NotificationItem date localization
 * Verifies formatDistanceToNow outputs localized strings when locale is 'ms'.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import type { NotificationItem as NotificationItemType } from '@/types/notification'

// Mock i18n with Malay locale
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            notifications: {
                tagSystem: 'Sistem',
                tagAnnouncement: 'Pengumuman',
                broadcastTitle: 'Pemberitahuan Sistem',
            },
        },
        locale: 'ms',
    }),
}))

const makeNotification = (overrides: Partial<NotificationItemType> = {}): NotificationItemType => ({
    id: 'n-i18n-1',
    type: 'ORDER_NEW',
    title: 'Pesanan Baru #100',
    message: 'Anda mempunyai pesanan baru',
    actionUrl: '/orders?id=100',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    ...overrides,
})

describe('[TC-F16.20] NotificationItem — date-fns i18n (Malay)', () => {
    it('renders relative date in Malay when locale is ms', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeNotification()} />)

        // Assert — date-fns ms locale outputs "kira-kira 2 jam" or "2 jam" with addSuffix
        const timeText = screen.getByText((content) =>
            content.includes('jam') || content.includes('minit'),
        )
        expect(timeText).toBeInTheDocument()
        // Must NOT contain English time words
        expect(timeText.textContent).not.toMatch(/\b(hours?|minutes?|ago)\b/i)
    })

    it('renders SYSTEM_ALERT tag in Malay', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeNotification({ type: 'SYSTEM_ALERT' })} />)

        // Assert
        expect(screen.getByText('Sistem')).toBeInTheDocument()
    })
})
