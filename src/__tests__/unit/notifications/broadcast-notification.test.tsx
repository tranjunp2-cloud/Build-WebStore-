// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// ── TC-F16.13, TC-F16.19, TC-F16.12: Broadcast notification rendering ──

const makeBroadcast = (overrides: Partial<NotificationItemType> = {}): NotificationItemType => ({
    id: 'broadcast-1',
    type: 'SYSTEM_ALERT',
    title: 'Scheduled Maintenance at 2AM',
    message: 'The system will be down for maintenance from 2:00 AM to 4:00 AM MYT.',
    actionUrl: null,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
})

describe('[TC-F16.13] Broadcast notification — System tag and icon', () => {
    it('renders SYSTEM_ALERT with "System" tag badge', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeBroadcast()} />)

        // Assert
        expect(screen.getByText('System')).toBeInTheDocument()
        expect(screen.getByText('System').className).toContain('bg-[#7C3AED]')
        expect(screen.getByText('System').className).toContain('text-[#A78BFA]')
    })

    it('does NOT show "System" tag for ORDER_NEW notifications', () => {
        // Arrange & Act
        render(
            <NotificationItem
                notification={makeBroadcast({ type: 'ORDER_NEW', title: 'New Order #1024' })}
            />,
        )

        // Assert
        expect(screen.queryByText('System')).not.toBeInTheDocument()
    })

    it('does NOT show "System" tag for PRODUCT_LOW_STOCK notifications', () => {
        // Arrange & Act
        render(
            <NotificationItem
                notification={makeBroadcast({ type: 'PRODUCT_LOW_STOCK', title: 'Low Stock Alert' })}
            />,
        )

        // Assert
        expect(screen.queryByText('System')).not.toBeInTheDocument()
    })

    it('renders broadcast title and message correctly', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeBroadcast()} />)

        // Assert
        expect(screen.getByText('Scheduled Maintenance at 2AM')).toBeInTheDocument()
        expect(screen.getByText(/system will be down/)).toBeInTheDocument()
    })

    it('renders broadcast with unread styling when isRead=false', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeBroadcast({ isRead: false })} />)

        // Assert
        const title = screen.getByText('Scheduled Maintenance at 2AM')
        expect(title.className).toContain('font-semibold')
        expect(title.className).toContain('text-white')
    })

    it('renders broadcast with read styling when isRead=true', () => {
        // Arrange & Act
        render(<NotificationItem notification={makeBroadcast({ isRead: true })} />)

        // Assert
        const title = screen.getByText('Scheduled Maintenance at 2AM')
        expect(title.className).toContain('font-normal')
        expect(title.className).toContain('text-[#CBD5E1]')
    })
})

describe('[TC-F16.19] Broadcast notification — XSS protection', () => {
    it('renders <script> tag as plain text, does not execute', () => {
        // Arrange
        const xssMessage = '<script>alert("xss")</script>Maintenance tonight'

        // Act
        const { container } = render(
            <NotificationItem
                notification={makeBroadcast({ message: xssMessage })}
            />,
        )

        // Assert — script tag rendered as text content, not as DOM element
        expect(screen.getByText(/alert\("xss"\)/)).toBeInTheDocument()
        expect(container.querySelector('script')).not.toBeInTheDocument()
    })

    it('renders HTML tags as plain text in title', () => {
        // Arrange
        const xssTitle = '<img onerror="alert(1)" src=x>Important Update'

        // Act
        const { container } = render(
            <NotificationItem
                notification={makeBroadcast({ title: xssTitle })}
            />,
        )

        // Assert — img tag rendered as text, not as DOM element
        expect(container.querySelector('img')).not.toBeInTheDocument()
        expect(screen.getByText(/onerror/)).toBeInTheDocument()
    })

    it('renders malicious actionUrl without executing script protocol', () => {
        // Arrange & Act
        render(
            <NotificationItem
                notification={makeBroadcast({
                    actionUrl: 'javascript:alert(1)',
                    message: 'Click to view',
                })}
            />,
        )

        // Assert — component renders as a div with onClick, not an <a> tag
        // so javascript: protocol URLs are never navigated via href
        const button = screen.getByRole('button')
        expect(button.tagName).toBe('DIV')
        expect(button).not.toHaveAttribute('href')
    })
})

describe('[TC-F16.12] Broadcast notification — RBAC display', () => {
    it('renders broadcast notification without any role-specific content leakage', () => {
        // Arrange — broadcast should only contain system-level info, no tenant-specific data
        const broadcast = makeBroadcast({
            title: 'Platform Update v2.5',
            message: 'New features available for all stores.',
            actionUrl: null,
        })

        // Act
        render(<NotificationItem notification={broadcast} />)

        // Assert — notification renders cleanly with System tag
        expect(screen.getByText('Platform Update v2.5')).toBeInTheDocument()
        expect(screen.getByText('System')).toBeInTheDocument()
        expect(screen.getByText(/New features available/)).toBeInTheDocument()
    })
})
