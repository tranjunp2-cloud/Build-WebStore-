import type { CollectionConfig } from 'payload'
import { normalizePhone } from '@/lib/normalize-phone'
import { ownTenantFieldAccess } from '@/lib/access/tenant-access'

export const Customers: CollectionConfig = {
    slug: 'customers',
    admin: {
        useAsTitle: 'name',
        description: 'Shop customers (buyers). Auto-created from orders; addresses + rank editable.',
        defaultColumns: ['name', 'phone', 'email', 'rank', 'createdAt'],
        // Payload 3.79 admin.listSearchableFields — enables search by name/email/phone in list view
        listSearchableFields: ['email', 'name', 'phone'],
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
                // Normalize phone via shared util (src/lib/normalize-phone.ts) so admin-entered
                // phones always match the order-derived lookup key and the DB unique index.
                if (typeof data.phone === 'string') {
                    data.phone = normalizePhone(data.phone)
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
            // GH-2137: only the user's own workspace can be written here (create into / move to another shop).
            access: { create: ownTenantFieldAccess, update: ownTenantFieldAccess },
        },
        {
            name: 'email',
            type: 'email',
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
            index: true,
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
        {
            name: 'latestOrderAt',
            type: 'date',
            admin: { readOnly: true, description: 'Updated automatically to the most recent order date' },
        },
    ],
    timestamps: true,
}
