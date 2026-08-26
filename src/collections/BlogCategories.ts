import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

function unwrapRelationId(
    value: string | number | { id: string | number } | null | undefined,
): string | number | null | undefined {
    if (value == null) return value
    return typeof value === 'object' ? value.id : value
}

function getActorTenantId(user: unknown) {
    const typedUser = user as { tenants?: Array<{ tenant: string | number | { id: string | number } }> } | null | undefined
    return unwrapRelationId(typedUser?.tenants?.[0]?.tenant)
}

const beforeChangeHook: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
    if (req.user && !isSuperAdmin) {
        const safeTenantId = operation === 'update'
            ? (unwrapRelationId(originalDoc?.tenant) ?? getActorTenantId(req.user))
            : getActorTenantId(req.user)
        if (!safeTenantId) {
            throw new Error('Không thể xác định thương hiệu (tenant) của danh mục blog')
        }
        data.tenant = safeTenantId
    }

    if (operation === 'create' && req.user && !data.tenant) {
        data.tenant = getActorTenantId(req.user)
    }

    return data
}

export const BlogCategories: CollectionConfig = {
    slug: 'blog_categories',
    hooks: {
        beforeChange: [beforeChangeHook],
    },
    admin: {
        useAsTitle: 'name',
        description: 'Blog post categories, scoped per tenant.',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => {
            // GH-1587 Phase 02: previously returned true unconditionally for anonymous callers,
            // leaking ALL tenants' blog categories. No live consumer needs public reads here.
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
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Deleted', value: 'deleted' },
            ],
            admin: { position: 'sidebar' },
        },
    ],
    timestamps: true,
}
