/**
 * F16 — Notification Center Types
 * Shared TypeScript interfaces for notification data structures.
 */

export type NotificationType =
    | 'ORDER_NEW'
    | 'SYSTEM_ALERT'
    | 'PRODUCT_LOW_STOCK'
    | 'BLOG_PUBLISHED'

export interface NotificationItem {
    id: string
    type: NotificationType
    title: string
    message: string
    actionUrl: string | null
    isRead: boolean
    createdAt: string
}

export interface NotificationsResponse {
    unreadCount: number
    items: NotificationItem[]
}

export interface MarkReadPayload {
    notificationIds?: string[]
    mark_all?: boolean
}
