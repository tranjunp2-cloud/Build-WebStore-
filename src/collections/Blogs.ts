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
    const actorTenantId = getActorTenantId(req.user)
    const originalTenantId = unwrapRelationId(originalDoc?.tenant)
    const requestedTenantId = unwrapRelationId(data.tenant)
    const effectiveTenantId = req.user && !isSuperAdmin
        ? (operation === 'update' ? (originalTenantId ?? actorTenantId) : actorTenantId)
        : (requestedTenantId ?? originalTenantId)

    if (req.user && !isSuperAdmin) {
        const safeTenantId = effectiveTenantId
        if (!safeTenantId) {
            throw new Error('Không thể xác định thương hiệu (tenant) của bài viết')
        }
        data.tenant = safeTenantId

        const originalSiteId = operation === 'update' ? unwrapRelationId(originalDoc?.site) : undefined
        const requestedSiteId = unwrapRelationId(data.site)
        if (requestedSiteId != null && String(requestedSiteId) !== String(originalSiteId ?? '')) {
            const siteCheck = await req.payload.find({
                req,
                collection: 'sites',
                where: { id: { equals: requestedSiteId }, tenant: { equals: safeTenantId } },
                limit: 1,
            })
            data.site = siteCheck.docs.length > 0 ? requestedSiteId : originalSiteId
        } else if (originalSiteId != null) {
            data.site = originalSiteId
        }
    }

    const categoryWasProvided = Object.prototype.hasOwnProperty.call(data, 'category')
    const finalCategoryId = categoryWasProvided
        ? unwrapRelationId(data.category)
        : unwrapRelationId(originalDoc?.category)
    const tenantWasProvided = Object.prototype.hasOwnProperty.call(data, 'tenant')

    if (categoryWasProvided && (finalCategoryId == null || finalCategoryId === '')) {
        data.category = null
    } else if (
        finalCategoryId != null &&
        finalCategoryId !== '' &&
        (categoryWasProvided || tenantWasProvided || operation === 'create')
    ) {
        const categoryDoc = await req.payload.findByID({
            req,
            collection: 'blog_categories',
            id: finalCategoryId,
            overrideAccess: true,
            disableErrors: true,
        })
        const categoryTenantId = unwrapRelationId(categoryDoc?.tenant)
        if (!categoryDoc || categoryDoc.status === 'deleted' || !effectiveTenantId || !categoryTenantId || String(categoryTenantId) !== String(effectiveTenantId)) {
            throw new Error('BLOG_CATEGORY_TENANT_MISMATCH')
        }
        if (categoryWasProvided) {
            data.category = finalCategoryId
        }
    }

    if (operation === 'create' && req.user) {
        if (!data.tenant) {
            data.tenant = actorTenantId
        }
        if (!data.site && data.tenant) {
            const siteRes = await req.payload.find({
                req,
                collection: 'sites',
                where: { tenant: { equals: data.tenant } },
                limit: 1,
            })
            if (siteRes.docs.length > 0) {
                data.site = siteRes.docs[0].id
            }
        }
    }

    return data
}

export function validateBlogSlug(value: unknown): true | string {
    if (typeof value !== 'string' || !value.trim()) return 'Slug is required'
    if (value === '.' || value === '..' || value.includes('/')) {
        return 'Blog slug must be a single URL segment'
    }
    return true
}

export const Blogs: CollectionConfig = {
    slug: 'blogs',
    indexes: [{ fields: ['tenant', 'slug'], unique: true }],
    hooks: {
        beforeChange: [beforeChangeHook],
        afterChange: [
            async ({ doc, previousDoc, req, context }) => {
                const isPublishing = doc.status === 'published' && previousDoc?.status !== 'published'
                if (!isPublishing) return doc
                if (context?.skipPublishNotify) return doc
                // Fire-and-forget: notify tenant owners of published blog
                import('@/lib/notifications/notify-tenant-owners')
                    .then(({ notifyTenantOwners }) => {
                        const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
                        return notifyTenantOwners(req.payload, tenantId, {
                            type: 'BLOG_PUBLISHED',
                            title: 'Blog Published',
                            message: `${doc.title} has been published`,
                            actionUrl: '/blog',
                            metadata: { blogTitle: doc.title },
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
            // GH-1587 Phase 02: no live consumer reads this collection unauthenticated
            // (storefront uses /api/storefront/blogs with overrideAccess:true + tenant filter).
            // Block anonymous entirely rather than leak cross-tenant blog content.
            if (!req.user) return false
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
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
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
            index: true,
            validate: validateBlogSlug,
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
