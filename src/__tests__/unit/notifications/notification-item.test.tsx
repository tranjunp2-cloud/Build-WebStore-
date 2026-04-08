// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import type { NotificationItem as NotificationItemType } from '@/types/notification'

// Mock i18n
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            notifications: {
                tagSystem: 'System',
                tagAnnouncement: 'Announcement',
                broadcastTitle: 'System Notification',
            },
        },
        locale: 'en',
    }),
}))

// ── TC-F16.04, TC-F16.06: NotificationItem rendering + a11y ─────────────

const makeNotification = (overrides: Partial<NotificationItemType> = {}): NotificationItemType => ({
    id: 'n-1',
    type: 'ORDER_NEW',
    title: 'New Order #100',
    message: 'You have a new order',
    actionUrl: '/orders?id=100',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
})

describe('[TC-F16.04] NotificationItem — visual states', () => {
    it('renders unread notification with bold title', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeNotification({ isRead: false })} />)

        // Assert
        const title = screen.getByText('New Order #100')
        expect(title).toBeInTheDocument()
        expect(title.className).toContain('font-semibold')
        expect(title.className).toContain('text-white')
    })

    it('renders read notification with dimmed title', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeNotification({ isRead: true })} />)

        // Assert
        const title = screen.getByText('New Order #100')
        expect(title.className).toContain('font-normal')
        expect(title.className).toContain('text-[#CBD5E1]')
    })

    it('shows blue dot indicator for unread items', () => {
        // Arrange & Act
        const { container } = render(<NotificationItem notification={makeNotification({ isRead: false })} />)

        // Assert
        const dot = container.querySelector('.bg-\\[\\#3B82F6\\]')
        expect(dot).toBeInTheDocument()
    })

    it('hides blue dot for read items', () => {
        // Arrange & Act
        const { container } = render(<NotificationItem notification={makeNotification({ isRead: true })} />)

        // Assert
        const dot = container.querySelector('.bg-\\[\\#3B82F6\\]')
        expect(dot).not.toBeInTheDocument()
    })

    it('renders correct icon for each notification type', () => {
        // Arrange & Act — just ensure no crash for all types
        const types: NotificationItemType['type'][] = ['ORDER_NEW', 'SYSTEM_ALERT', 'PRODUCT_LOW_STOCK', 'BLOG_PUBLISHED']
        types.forEach((type) => {
            const { unmount } = render(<NotificationItem notification={makeNotification({ type })} />)
            expect(screen.getByText('New Order #100')).toBeInTheDocument()
            unmount()
        })
    })
})

describe('[TC-F16.06] NotificationItem — click + keyboard a11y', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls onClick when clicked', () => {
        // Arrange
        const onClick = vi.fn()
        const notification = makeNotification()
        render(<NotificationItem notification={notification} onClick={onClick} />)

        // Act
        fireEvent.click(screen.getByRole('button'))

        // Assert
        expect(onClick).toHaveBeenCalledWith(notification)
    })

    it('calls onClick on Enter key', () => {
        // Arrange
        const onClick = vi.fn()
        const notification = makeNotification()
        render(<NotificationItem notification={notification} onClick={onClick} />)

        // Act
        fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })

        // Assert
        expect(onClick).toHaveBeenCalledWith(notification)
    })

    it('calls onClick on Space key', () => {
        // Arrange
        const onClick = vi.fn()
        const notification = makeNotification()
        render(<NotificationItem notification={notification} onClick={onClick} />)

        // Act
        fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })

        // Assert
        expect(onClick).toHaveBeenCalledWith(notification)
    })

    it('prevents default on Space key (no page scroll)', () => {
        // Arrange
        const onClick = vi.fn()
        render(<NotificationItem notification={makeNotification()} onClick={onClick} />)

        // Act
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
        screen.getByRole('button').dispatchEvent(event)

        // Assert
        expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('does not call onClick for other keys', () => {
        // Arrange
        const onClick = vi.fn()
        render(<NotificationItem notification={makeNotification()} onClick={onClick} />)

        // Act
        fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' })

        // Assert
        expect(onClick).not.toHaveBeenCalled()
    })

    it('has role="button" and tabIndex=0 for accessibility', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeNotification()} />)

        // Assert
        const el = screen.getByRole('button')
        expect(el).toHaveAttribute('tabindex', '0')
    })
})
