import type { CollectionConfig } from 'payload'

/**
 * F16 — Notifications Collection
 * Stores in-app notifications per user per tenant.
 * Access: Users can only read/update their own notifications.
 * Inserts are done server-side only (via API routes or hooks).
 */
export const Notifications: CollectionConfig = {
    slug: 'notifications',
    admin: {
        useAsTitle: 'title',
        description: 'In-app notifications for dashboard users.',
        defaultColumns: ['title', 'type', 'isRead', 'createdAt'],
    },
    access: {
        // Only server-side inserts allowed (from API routes/hooks)
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        // Users can only read their own notifications
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { user: { equals: req.user.id } }
        },
        // Users can only update (mark-read) their own notifications
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { user: { equals: req.user.id } }
        },
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'Tenant this notification belongs to (multi-tenant isolation)' },
        },
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
            index: true,
            admin: { description: 'User this notification is for' },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            index: true,
            options: [
                { label: 'New Order', value: 'ORDER_NEW' },
                { label: 'System Alert', value: 'SYSTEM_ALERT' },
                { label: 'Product Low Stock', value: 'PRODUCT_LOW_STOCK' },
                { label: 'Blog Published', value: 'BLOG_PUBLISHED' },
            ],
        },
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'message',
            type: 'textarea',
        },
        {
            name: 'actionUrl',
            type: 'text',
            admin: { description: 'Optional URL to navigate to when notification is clicked' },
        },
        {
            name: 'isRead',
            type: 'checkbox',
            defaultValue: false,
            index: true,
            admin: { description: 'Whether the user has read this notification' },
        },
        {
            name: 'expiresAt',
            type: 'date',
            admin: { description: 'Notification auto-expires after 30 days (set on insert)' },
        },
    ],
    timestamps: true,
}
