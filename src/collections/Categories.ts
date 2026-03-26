import type { CollectionConfig } from 'payload'
import slugify from 'slugify'

export const Categories: CollectionConfig = {
    slug: 'categories',
    admin: {
        useAsTitle: 'breadcrumbs',
        description: 'Quản lý Danh mục (Tối đa 3 cấp độ)',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => {
            if (!req.user) return true // Public read for storefront
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            return { tenant: { in: tenantIds } }
        },
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            return { tenant: { in: tenantIds } }
        },
        delete: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            return { tenant: { in: tenantIds } }
        },
    },
    hooks: {
        beforeValidate: [
            async ({ data, req, operation }) => {
                // Depth check: prevent > 3 levels
                if (data?.parent) {
                    let currentParent = await req.payload.findByID({
                        collection: 'categories',
                        id: data.parent,
                    });
                    let depth = 1;
                    while (currentParent?.parent) {
                        depth++;
                        currentParent = await req.payload.findByID({
                            collection: 'categories',
                            id: typeof currentParent.parent === 'object' ? currentParent.parent.id : currentParent.parent as string,
                        });
                    }
                    // If the parent is already level 3, the child would be level 4, which is not allowed.
                    if (depth >= 3) {
                        throw new Error('Chỉ hỗ trợ tối đa 3 cấp độ danh mục');
                    }
                }
                return data;
            }
        ],
        beforeChange: [
            async ({ data, req, operation }) => {
                // Auto-inject tenant & site
                if (operation === 'create' && req.user) {
                    if (!data.tenant && req.user.tenants?.length > 0) {
                        data.tenant = typeof req.user.tenants[0].tenant === 'object'
                            ? req.user.tenants[0].tenant?.id
                            : req.user.tenants[0].tenant
                    }
                    if (!data.site && data.tenant && req.payload) {
                        const siteRes = await req.payload.find({
                            collection: 'sites',
                            where: { tenant: { equals: data.tenant } },
                            limit: 1
                        })
                        if (siteRes.docs.length > 0) {
                            data.site = siteRes.docs[0].id
                        }
                    }
                }

                if (!data.slug && data.name) {
                    data.slug = slugify(data.name, { lower: true, strict: true })
                }

                // Generate breadcrumb for UX usage
                let breadcrumbs = data.name;
                if (data.parent) {
                    const parentDoc = await req.payload.findByID({
                        collection: 'categories',
                        id: data.parent,
                    });
                    if (parentDoc?.breadcrumbs) {
                        breadcrumbs = `${parentDoc.breadcrumbs} > ${data.name}`;
                    }
                }
                data.breadcrumbs = breadcrumbs;

                return data;
            }
        ]
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'The tenant this category belongs to', position: 'sidebar' },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            admin: { description: 'The site this category is listed on', position: 'sidebar' },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Tên danh mục (VD: Thời Trang, Áo Sơ Mi)' },
        },
        {
            name: 'slug',
            type: 'text',
            unique: true,
            index: true,
            admin: { description: 'URL-friendly slug (Tự động tạo nếu để trống)' },
        },
        {
            name: 'parent',
            type: 'relationship',
            relationTo: 'categories',
            filterOptions: ({ id }) => {
                if (id) {
                    return { id: { not_equals: id } }
                }
                return true
            },
            admin: { description: 'Danh mục cha (Tối đa 3 level)' },
        },
        {
            name: 'breadcrumbs',
            type: 'text',
            admin: { readOnly: true, description: 'Đường dẫn danh mục (auto-generated)' },
        },
        {
            name: 'image',
            type: 'upload',
            relationTo: 'media',
            admin: { description: 'Ảnh danh mục (Tùy chọn)' }
        }
    ],
    timestamps: true,
}
