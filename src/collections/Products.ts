import type { CollectionConfig, Where, CollectionAfterChangeHook } from 'payload'
import { queueSEOAutoGeneration } from '../lib/ai/seo-queue'

const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation }) => {
    const isPublishingUpdate = operation === 'update' && doc.status === 'active' && previousDoc?.status !== 'active'
    const isActiveCreate = operation === 'create' && doc.status === 'active'

    // Wait until it becomes active and seo title is empty
    if ((isPublishingUpdate || isActiveCreate) && !doc.seo?.title) {
        // Trigger background generation
        queueSEOAutoGeneration('products', doc.id, typeof doc.site === 'object' ? doc.site.id : doc.site, doc.name, doc.shortDescription)
    }
}

// Auto-inject tenant and site from logged-in user if not provided by client
const beforeChangeHook = async ({ data, req, operation }: any) => {
    if (operation === 'create' && req.user) {
        // If client didn't specify tenant, try to grab the first active tenant from user
        if (!data.tenant && req.user.tenants?.length > 0) {
            data.tenant = typeof req.user.tenants[0].tenant === 'object' 
                ? req.user.tenants[0].tenant?.id 
                : req.user.tenants[0].tenant
        }

        // If client didn't specify site, try to fetch the first site for this tenant
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
    return data
}

export const Products: CollectionConfig = {
    slug: 'products',
    hooks: {
        beforeChange: [beforeChangeHook],
        afterChange: [afterChangeHook],
    },
    admin: {
        useAsTitle: 'name',
        description: 'Products belong to a site and can be listed in the storefront.',
    },
    access: {
        create: ({ req }) => Boolean(req.user),
        read: ({ req }) => {
            // Public read for storefront — only active, non-deleted products
            if (!req.user) {
                return {
                    status: { equals: 'active' },
                    deletedAt: { exists: false },
                } as Where
            }
            // Authenticated: tenant-scoped read (dashboard)
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
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'The tenant this product belongs to' },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            admin: { description: 'The site this product is listed on' },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Product name' },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: { description: 'URL-friendly slug for the product page' },
        },
        {
            name: 'description',
            type: 'richText',
            admin: { description: 'Product description in English (supports rich text)' },
        },
        {
            name: 'descriptionBM',
            type: 'richText',
            admin: { description: 'Product description in Bahasa Melayu (supports rich text)' },
        },
        {
            name: 'shortDescription',
            type: 'textarea',
            maxLength: 300,
            admin: { description: 'Short description for cards and SEO (max 300 chars)' },
        },
        {
            name: 'price',
            type: 'number',
            required: true,
            min: 0,
            admin: { description: 'Product price (in smallest currency unit or decimal)' },
        },
        {
            name: 'compareAtPrice',
            type: 'number',
            min: 0,
            admin: { description: 'Original price before discount (for sale displays)' },
        },
        {
            name: 'currency',
            type: 'select',
            defaultValue: 'MYR',
            options: [
                { label: 'Malaysian Ringgit (MYR)', value: 'MYR' },
                { label: 'US Dollar (USD)', value: 'USD' },
                { label: 'Singapore Dollar (SGD)', value: 'SGD' },
            ],
        },
        {
            name: 'images',
            type: 'array',
            maxRows: 5,
            fields: [
                {
                    name: 'image',
                    type: 'upload',
                    relationTo: 'media',
                    required: true,
                },
                {
                    name: 'alt',
                    type: 'text',
                    admin: { description: 'Alt text for accessibility and SEO' },
                },
            ],
            admin: { description: 'Product images (Max 5, <= 5MB each)' },
        },
        {
            name: 'category',
            type: 'text',
            admin: { description: 'Product category' },
        },
        {
            name: 'tags',
            type: 'array',
            fields: [
                { name: 'tag', type: 'text', required: true },
            ],
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Active', value: 'active' },
                { label: 'Archived', value: 'archived' },
            ],
        },
        {
            name: 'inventory',
            type: 'number',
            min: 0,
            defaultValue: 0,
            admin: { description: 'Stock quantity' },
        },
        {
            name: 'sku',
            type: 'text',
            admin: { description: 'Stock Keeping Unit (optional)' },
        },
        {
            name: 'hasVariants',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Sản phẩm có nhiều phân loại (Variants)' },
        },
        {
            name: 'variantConfigs',
            type: 'array',
            maxRows: 2,
            admin: {
                condition: (data) => Boolean(data?.hasVariants),
                description: 'Cấu hình các phân loại (VD: Màu sắc, Kích cỡ)',
            },
            fields: [
                { name: 'name', type: 'text', required: true, admin: { description: 'Tên phân loại (VD: Màu sắc)' } },
                {
                    name: 'options',
                    type: 'array',
                    minRows: 1,
                    fields: [
                        { name: 'value', type: 'text', required: true, admin: { description: 'Giá trị tùy chọn (VD: Đỏ, Xanh)' } }
                    ]
                }
            ],
        },
        {
            name: 'variants',
            type: 'array',
            admin: {
                condition: (data) => Boolean(data?.hasVariants),
                description: 'Ma trận SKU (Tự động sinh ra từ cấu hình ở trên)',
            },
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'sku', type: 'text' },
                { name: 'price', type: 'number', required: true, min: 0 },
                { name: 'compareAtPrice', type: 'number', min: 0 },
                { name: 'stock', type: 'number', required: true, min: 0, defaultValue: 0 },
            ],
        },
        {
            name: 'halalCertified',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Toggle to mark product as Halal Certified (JAKIM)' },
        },
        {
            name: 'halalCertImage',
            type: 'upload',
            relationTo: 'media',
            admin: {
                condition: (data) => data.halalCertified,
                description: 'Upload JAKIM Halal certificate image',
            },
        },
        {
            name: 'weight',
            type: 'number',
            min: 0,
            defaultValue: 0,
            admin: { description: 'Product weight in grams (for shipping calculation)' },
        },
        {
            name: 'dimensions',
            type: 'group',
            admin: { description: 'Package dimensions matching shipping logic in F14' },
            fields: [
                { name: 'length', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Length (cm)' } },
                { name: 'width', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Width (cm)' } },
                { name: 'height', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Height (cm)' } },
            ],
        },
        {
            name: 'attributes',
            type: 'array',
            admin: { description: 'Dynamic key/value attributes for Storefront SEO/Rich Snippets' },
            fields: [
                { name: 'key', type: 'text', required: true, admin: { placeholder: 'e.g., Material' } },
                { name: 'value', type: 'text', required: true, admin: { placeholder: 'e.g., 100% Cotton' } },
            ],
        },
        {
            name: 'seo',
            type: 'group',
            label: 'SEO Settings',
            fields: [
                { name: 'title', type: 'text', admin: { description: 'Meta title for product page' } },
                { name: 'description', type: 'textarea', admin: { description: 'Meta description for product page' } },
            ],
        },
        {
            name: 'deletedAt',
            type: 'date',
            admin: { readOnly: true, description: 'Soft delete timestamp' },
        },
    ],
    timestamps: true,
}
