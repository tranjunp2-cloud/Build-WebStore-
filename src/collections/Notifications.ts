import type { CollectionConfig, AccessResult } from 'payload'
import { runAfterResponse } from '@/lib/runtime/run-after-response'
import { sendPushToUser } from '@/lib/notifications/send-push'
import { signalNotificationUsers } from '@/lib/notifications/signal-notification'
import { pushWanted } from '@/lib/automations/automation-push'

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
        // Users can only read their own notifications within their tenant
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            
            const tenants = (req.user as { tenants?: Array<{ tenant: string | { id: string } }> }).tenants || []
            const tenantIds = tenants.map((t) => typeof t.tenant === 'object' ? t.tenant.id : t.tenant)

            const query: Record<string, unknown> = {
                and: [
                    { user: { equals: req.user.id } },
                    { tenant: { in: tenantIds } }
                ]
            }
            return query as AccessResult
        },
        // Users can only update (mark-read) their own notifications within their tenant
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            
            const tenants = (req.user as { tenants?: Array<{ tenant: string | { id: string } }> }).tenants || []
            const tenantIds = tenants.map((t) => typeof t.tenant === 'object' ? t.tenant.id : t.tenant)

            const query: Record<string, unknown> = {
                and: [
                    { user: { equals: req.user.id } },
                    { tenant: { in: tenantIds } }
                ]
            }
            return query as AccessResult
        },
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    hooks: {
        afterChange: [
            async ({ doc, operation, req, context }) => {
                if (operation !== 'create') return doc
                // notifyTenantOwners sends push itself (after the realtime signal, outside
                // the create transaction). Only manual creates (admin panel / REST) reach below.
                if (context?.skipPush) return doc
                const payload = req.payload
                runAfterResponse('Push', async () => {
                    const userId = typeof doc.user === 'object' ? doc.user?.id : doc.user
                    const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
                    if (!userId || !tenantId) return
                    await signalNotificationUsers([userId]) // doorbell first, then push
                    // reminders from the automations reach the phone only when important (orders waiting); the bell shows all
                    if (!pushWanted(doc)) return
                    await sendPushToUser(userId, tenantId, {
                        id: String(doc.id),
                        title: doc.title,
                        body: doc.message || undefined,
                        tag: doc.type,
                        actionUrl: doc.actionUrl || undefined,
                    }, payload)
                })
                return doc
            },
        ],
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
                { label: 'Automation Reminder', value: 'AUTOMATION_REMINDER' },
                { label: 'New Contact Lead', value: 'LEAD_NEW' },
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
            name: 'metadata',
            type: 'json',
            admin: { description: 'Dynamic values for client-side i18n template interpolation' },
        },
        {
            name: 'isRead',
            type: 'checkbox',
            defaultValue: false,
            index: true,
            admin: { description: 'Whether the user has read this notification' },
        },
        {
            name: 'dedupeKey',
            type: 'text',
            admin: {
                description:
                    'Stable per-event idempotency key (e.g. "ORDER_NEW:ORD-123"). Backed by a partial unique index on (tenant, user, dedupeKey) to prevent duplicate rows from multi-path/concurrent notification firing. Null for notifications that opt out of dedupe.',
            },
        },
        {
            name: 'expiresAt',
            type: 'date',
            admin: { description: 'Notification auto-expires after 30 days (set on insert)' },
        },
    ],
    timestamps: true,
}
