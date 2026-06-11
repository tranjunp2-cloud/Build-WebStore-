import type { CollectionConfig } from 'payload'

export const DiscountUsageHistory: CollectionConfig = {
    slug: 'discount_usage_history',
    admin: {
        useAsTitle: 'customerEmail',
        description: 'Immutable record of each discount code use. Created server-side only.',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
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
        delete: () => false,
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
            name: 'discount',
            type: 'relationship',
            relationTo: 'discounts',
            required: true,
            index: true,
        },
        {
            name: 'order',
            type: 'relationship',
            relationTo: 'orders',
            required: true,
        },
        {
            name: 'amountApplied',
            type: 'number',
            required: true,
            admin: { description: 'Discount amount in sen' },
        },
        {
            name: 'customerEmail',
            type: 'text',
            admin: { description: 'Customer email snapshot at time of use' },
        },
        {
            name: 'discountCode',
            type: 'text',
            admin: { description: 'Discount code snapshot at time of use (survives discount deletion)' },
        },
        {
            name: 'discountType',
            type: 'text',
            admin: { description: 'Discount type snapshot (percentage/fixed) — survives discount deletion' },
        },
        {
            name: 'discountValue',
            type: 'number',
            admin: { description: 'Discount value snapshot (percent or sen) — survives discount deletion' },
        },
        {
            name: 'usedAt',
            type: 'date',
        },
    ],
    timestamps: true,
}
