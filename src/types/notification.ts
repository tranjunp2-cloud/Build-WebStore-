/**
 * F16 — Notification Center Types
 * Shared TypeScript interfaces for notification data structures.
 */

export type NotificationType =
    | 'ORDER_NEW'
    | 'SYSTEM_ALERT'
    | 'PRODUCT_LOW_STOCK'
    | 'BLOG_PUBLISHED'
    | 'AUTOMATION_REMINDER'
    | 'LEAD_NEW'

export interface NotificationItem {
    id: string
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, string>
    actionUrl: string | null
    isRead: boolean
    createdAt: string
}

export interface NotificationsResponse {
    unreadCount: number
    items: NotificationItem[]
    /** Present on `offset > 0` pages; when absent the client infers it from the page size. */
    hasMore?: boolean
}

export interface MarkReadPayload {
    notificationIds?: string[]
    mark_all?: boolean
}
