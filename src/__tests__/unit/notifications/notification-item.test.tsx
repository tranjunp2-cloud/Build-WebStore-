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
                types: {
                    ORDER_NEW: {
                        title: 'New Order #{orderNumber} - {currency} {total}',
                        message: 'Order placed by {customerName}',
                    },
                    BLOG_PUBLISHED: {
                        title: 'Blog Published',
                        message: '{blogTitle} has been published',
                    },
                    PRODUCT_LOW_STOCK: {
                        title: 'Low Stock Alert',
                        message: '{productName} is running low ({quantity} units left)',
                    },
                    SYSTEM_ALERT: {
                        title: 'Payment Failed - Order #{orderNumber}',
                        message: 'Payment for order #{orderNumber} has failed. Customer may retry.',
                    },
                },
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

describe('[TC-F16.20] NotificationItem — i18n metadata interpolation', () => {
    it('renders translated title/message when metadata + template exist', () => {
        render(<NotificationItem notification={makeNotification({
            type: 'ORDER_NEW',
            title: 'New Order #ORD-001 - MYR 150.00',
            message: 'Order placed by Alice',
            metadata: { orderNumber: 'ORD-001', currency: 'MYR', total: '150.00', customerName: 'Alice' },
        })} />)

        expect(screen.getByText('New Order #ORD-001 - MYR 150.00')).toBeInTheDocument()
        expect(screen.getByText('Order placed by Alice')).toBeInTheDocument()
    })

    it('falls back to raw DB values when metadata is absent', () => {
        render(<NotificationItem notification={makeNotification({
            type: 'ORDER_NEW',
            title: 'Raw DB Title',
            message: 'Raw DB Message',
        })} />)

        expect(screen.getByText('Raw DB Title')).toBeInTheDocument()
        expect(screen.getByText('Raw DB Message')).toBeInTheDocument()
    })

    it('keeps placeholder when metadata key is missing', () => {
        render(<NotificationItem notification={makeNotification({
            type: 'PRODUCT_LOW_STOCK',
            title: 'Low Stock Alert',
            message: 'Widget is running low',
            metadata: { productName: 'Widget' },
        })} />)

        // {quantity} missing → stays as placeholder
        expect(screen.getByText('Widget is running low ({quantity} units left)')).toBeInTheDocument()
    })

    it('renders BLOG_PUBLISHED with interpolated blogTitle', () => {
        render(<NotificationItem notification={makeNotification({
            type: 'BLOG_PUBLISHED',
            title: 'Blog Published',
            message: 'My Post has been published',
            metadata: { blogTitle: 'My Post' },
        })} />)

        expect(screen.getByText('Blog Published')).toBeInTheDocument()
        expect(screen.getByText('My Post has been published')).toBeInTheDocument()
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
