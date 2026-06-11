import type { CollectionConfig } from 'payload'
import { startOfDayKL, endOfDayKL } from '@/lib/discounts/date-boundaries'

export const Discounts: CollectionConfig = {
    slug: 'discounts',
    admin: {
        useAsTitle: 'code',
        description: 'Discount codes for tenant storefronts.',
    },
    hooks: {
        beforeValidate: [
            ({ data }) => {
                if (!data) return data
                if (typeof data.code === 'string') {
                    data.code = data.code.trim().toUpperCase()
                }
                // Pin date-only inputs to KL day boundaries so a code is valid for the whole local day
                // (startsAt from 00:00, expiresAt through 23:59:59.999 Asia/Kuala_Lumpur). Idempotent on re-save.
                if (data.startsAt) {
                    data.startsAt = startOfDayKL(data.startsAt as string | Date).toISOString()
                }
                if (data.expiresAt) {
                    data.expiresAt = endOfDayKL(data.expiresAt as string | Date).toISOString()
                }
                return data
            },
        ],
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
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        delete: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
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
            index: true,
            admin: { description: 'Scope to a specific site (leave blank to apply to all tenant sites)' },
        },
        {
            name: 'code',
            type: 'text',
            required: true,
            admin: { description: 'Discount code (auto-uppercased). Unique per tenant.' },
        },
        {
            name: 'description',
            type: 'textarea',
            validate: (val: string | null | undefined) => {
                if (val && val.length > 500) return 'Description must be 500 characters or fewer'
                return true
            },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'Percentage (%)', value: 'percentage' },
                { label: 'Fixed Amount (sen)', value: 'fixed' },
            ],
        },
        {
            name: 'value',
            type: 'number',
            required: true,
            min: 0,
            admin: { description: 'For percentage: 0–100. For fixed: amount in sen.' },
            validate: (val: number | null | undefined, { data }: any) => {
                if (val == null) return true
                if (data?.type === 'percentage' && val > 100) return 'Percentage value must be 100 or less'
                return true
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            index: true,
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
            ],
        },
        {
            name: 'usageLimit',
            type: 'number',
            min: 1,
            admin: { description: 'Maximum number of uses (leave blank for unlimited)' },
        },
        {
            name: 'usageCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true,
                description: 'Auto-incremented on each successful use',
            },
            access: { update: () => false },
        },
        {
            name: 'startsAt',
            type: 'date',
            admin: { description: 'Discount becomes active from this date/time' },
        },
        {
            name: 'expiresAt',
            type: 'date',
            admin: { description: 'Discount expires after this date/time (leave blank for no expiry)' },
        },
    ],
    timestamps: true,
}
