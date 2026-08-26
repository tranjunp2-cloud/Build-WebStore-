import type { CollectionConfig } from 'payload'

export const Analytics: CollectionConfig = {
    slug: 'analytics',
    admin: {
        description: 'Page view and event tracking for published sites.',
    },
    access: {
        create: () => true, // Public API for tracking
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: () => false,
        delete: ({ req }) => req.user?.roles?.includes('super-admin') || false,
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
        },
        {
            name: 'event',
            type: 'select',
            required: true,
            defaultValue: 'pageview',
            options: [
                { label: 'Page View', value: 'pageview' },
                { label: 'Click', value: 'click' },
                { label: 'Add to Cart', value: 'add_to_cart' },
                { label: 'Checkout', value: 'checkout' },
                { label: 'Purchase', value: 'purchase' },
                { label: 'Local Business Data Saved', value: 'local_business_data_saved' },
            ],
        },
        {
            name: 'pageUrl',
            type: 'text',
            required: true,
            admin: { description: 'Full page URL' },
        },
        {
            name: 'referrer',
            type: 'text',
            admin: { description: 'Previous page URL or external referrer' },
        },
        {
            name: 'userAgent',
            type: 'text',
        },
        {
            name: 'ip',
            type: 'text',
            admin: { description: 'Hashed IP for anonymized unique visitors' },
        },
        {
            name: 'sessionId',
            type: 'text',
            admin: { description: 'Client-side session ID for visit grouping' },
        },
        {
            name: 'metadata',
            type: 'json',
            admin: { description: 'Additional event-specific data' },
        },
    ],
    timestamps: true,
}
