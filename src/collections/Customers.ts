import type { CollectionConfig } from 'payload'

export const Customers: CollectionConfig = {
    slug: 'customers',
    admin: {
        useAsTitle: 'email',
        description: 'Shop customers (buyers). Auto-created from orders; addresses + rank editable.',
        defaultColumns: ['email', 'name', 'rank', 'phone', 'createdAt'],
        // Payload 3.79 admin.listSearchableFields — enables search by name in list view
        // (email is already covered by useAsTitle)
        listSearchableFields: ['email', 'name'],
        components: {
            views: {
                edit: {
                    // Payload 3.79 custom view tab API:
                    //   admin.components.views.edit.{key}.Component  = view component path
                    //   admin.components.views.edit.{key}.path       = URL segment
                    //   admin.components.views.edit.{key}.tab        = tab label + href
                    // Chosen path: spec custom Tab (not Fallback A/B) — Payload 3.79 supports this natively.
                    ordersTab: {
                        Component: '@/components/admin/customers-orders-tab',
                        path: '/orders',
                        tab: {
                            label: 'Orders',
                            href: '/orders',
                        },
                    },
                },
            },
        },
    },
    access: {
        // Authenticated users can create customers
        create: ({ req }) => Boolean(req.user),
        // Users can only read their own tenant's customers
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        // Users can update their own tenant's customers
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        // Hard-delete forbidden; GDPR/anonymize handled in a separate plan
        delete: () => false,
    },
    hooks: {
        beforeChange: [
            ({ data }) => {
                if (typeof data.email === 'string') {
                    data.email = data.email.trim().toLowerCase()
                }
                return data
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
            admin: { description: 'The tenant/store this customer belongs to' },
        },
        {
            name: 'email',
            type: 'email',
            required: true,
            index: true,
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Customer display name (snapshot from latest order)' },
        },
        {
            name: 'phone',
            type: 'text',
        },
        {
            name: 'rank',
            type: 'select',
            options: [
                { label: 'Bronze', value: 'bronze' },
                { label: 'Silver', value: 'silver' },
                { label: 'Gold', value: 'gold' },
                { label: 'VIP', value: 'vip' },
            ],
        },
        {
            name: 'addresses',
            type: 'array',
            maxRows: 10,
            fields: [
                {
                    name: 'label',
                    type: 'text',
                    admin: { description: 'e.g. Home, Office' },
                },
                {
                    name: 'line1',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'line2',
                    type: 'text',
                },
                {
                    name: 'city',
                    type: 'text',
                },
                {
                    name: 'state',
                    type: 'text',
                },
                {
                    name: 'postcode',
                    type: 'text',
                },
                {
                    name: 'country',
                    type: 'text',
                    defaultValue: 'Malaysia',
                },
                {
                    name: 'isDefault',
                    type: 'checkbox',
                },
            ],
        },
        {
            name: 'notes',
            type: 'textarea',
            admin: { description: 'Internal admin notes' },
        },
        {
            name: 'firstOrderAt',
            type: 'date',
            admin: { readOnly: true, description: 'Set automatically when first order is linked' },
        },
    ],
    timestamps: true,
}
