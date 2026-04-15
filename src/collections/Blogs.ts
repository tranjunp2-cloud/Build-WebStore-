import type { CollectionConfig, Where } from 'payload'

export const Blogs: CollectionConfig = {
    slug: 'blogs',
    hooks: {
        afterChange: [
            async ({ doc, previousDoc, operation, req }) => {
                const isPublishing = doc.status === 'published' && previousDoc?.status !== 'published'
                if (!isPublishing) return doc
                // Fire-and-forget: notify tenant owners of published blog
                import('@/lib/notifications/notify-tenant-owners')
                    .then(({ notifyTenantOwners }) => {
                        const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
                        return notifyTenantOwners(req.payload, tenantId, {
                            type: 'BLOG_PUBLISHED',
                            title: 'Blog Published',
                            message: `${doc.title} has been published`,
                            actionUrl: '/blogs',
                        })
                    })
                    .catch((err) => console.error('[Notification] BLOG_PUBLISHED hook failed', err))
                return doc
            },
        ],
    },
    admin: {
        useAsTitle: 'title',
        description: 'Blog posts belong to a site and can be published to the storefront.',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => {
            // Public read — only published posts
            if (!req.user) {
                return { status: { equals: 'published' } } as Where
            }
            // Authenticated — tenant-scoped
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
            required: true,
            index: true,
        },
        {
            name: 'title',
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
            name: 'content',
            type: 'richText',
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
                { label: 'Scheduled', value: 'scheduled' },
            ],
        },
        {
            name: 'publishedAt',
            type: 'date',
            admin: {
                description: 'When this post was or will be published.',
            },
        },
        {
            name: 'scheduledPublishDate',
            type: 'date',
            admin: {
                description: 'Auto-set when saving a future-dated post as scheduled.',
                readOnly: true,
            },
        },
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'blog_categories',
        },
        {
            name: 'thumbnail',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'author',
            type: 'relationship',
            relationTo: 'users',
            required: true,
        },
        {
            name: 'seo',
            type: 'group',
            label: 'SEO Settings',
            fields: [
                {
                    name: 'metaTitle',
                    type: 'text',
                },
                {
                    name: 'metaDescription',
                    type: 'textarea',
                },
            ],
        },
    ],
    timestamps: true,
}
