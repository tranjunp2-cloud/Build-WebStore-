import type { CollectionConfig, Where, CollectionAfterChangeHook, FieldHook, CollectionBeforeChangeHook } from 'payload'
import { queueSEOAutoGeneration } from '../lib/ai/seo-queue'
import slugify from 'slugify'

const formatSlug = (fallback: string): FieldHook => async ({ value, originalDoc, data, req }) => {
    // If client supplied a value, use it (or slugify it)
    let baseSlug = ''
    if (typeof value === 'string' && value.trim().length > 0) {
        baseSlug = slugify(value, { lower: true, strict: true })
    } else {
        // Fallback to the specified field
        const fallbackData = data?.[fallback] || originalDoc?.[fallback]
        if (fallbackData && typeof fallbackData === 'string') {
            baseSlug = slugify(fallbackData, { lower: true, strict: true })
        }
    }

    if (!baseSlug) return value

    let slug = baseSlug
    let count = 1
    let isUnique = false

    // Check uniqueness (BR-03: Duplicate product name cho phép, slug auto-increments)
    while (!isUnique) {
        const existing = await req.payload.find({
            collection: 'products',
            where: {
                slug: { equals: slug },
                ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {})
            },
            limit: 1,
            depth: 0
        })

        if (existing.docs.length === 0) {
            isUnique = true
        } else {
            slug = `${baseSlug}-${count}`
            count++
        }
    }
    
    return slug
}

const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    const isPublishingUpdate = operation === 'update' && doc.status === 'active' && previousDoc?.status !== 'active'
    const isActiveCreate = operation === 'create' && doc.status === 'active'

    // Wait until it becomes active and seo title is empty
    if ((isPublishingUpdate || isActiveCreate) && !doc.seo?.title) {
        const siteId = typeof doc.site === 'object' ? doc.site.id : doc.site

        // Check if auto meta generation is enabled for this site
        try {
            const site = await req.payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
            if (site.seo?.autoMetaEnabled === false) return
        } catch { /* proceed if can't check */ }

        // Trigger background generation
        queueSEOAutoGeneration('products', doc.id, siteId, doc.name, doc.shortDescription)
    }
}

export const LOW_STOCK_THRESHOLD = 10

export const lowStockHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update') return doc
    const prevInventory = previousDoc?.inventory ?? 0
    const currInventory = doc.inventory ?? 0

    // Only notify when crossing threshold downward (anti-spam)
    if (prevInventory >= LOW_STOCK_THRESHOLD && currInventory < LOW_STOCK_THRESHOLD && currInventory >= 0) {
        import('@/lib/notifications/notify-tenant-owners')
            .then(({ notifyTenantOwners }) => {
                const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
                return notifyTenantOwners(req.payload, tenantId, {
                    type: 'PRODUCT_LOW_STOCK',
                    title: 'Low Stock Alert',
                    message: `${doc.name} is running low (${currInventory} units left)`,
                    actionUrl: '/products',
                    metadata: { productName: doc.name, quantity: String(currInventory) },
                })
            })
            .catch((err) => console.error('[Notification] PRODUCT_LOW_STOCK hook failed', err))
    }
    return doc
}

// Auto-inject tenant and site from logged-in user if not provided by client
const beforeChangeHook: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
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

    // Auto-calculate total inventory if it has variants
    if (data.hasVariants && Array.isArray(data.variants)) {
        data.inventory = data.variants.reduce((acc: number, v: Record<string, unknown>) => acc + (Number(v.stock) || 0), 0)
    }

    return data
}

export const Products: CollectionConfig = {
    slug: 'products',
    hooks: {
        beforeChange: [beforeChangeHook],
        afterChange: [afterChangeHook, lowStockHook],
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
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        delete: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
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
            minLength: 3,
            hooks: {
                beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
            },
            admin: { description: 'Product name' },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            hooks: {
                beforeValidate: [formatSlug('name')],
            },
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
            max: 100000000,
            admin: { description: 'Product price (in smallest currency unit or decimal)' },
        },
        {
            name: 'compareAtPrice',
            type: 'number',
            min: 0,
            validate: (value: number | null | undefined, { data }: { data: Record<string, unknown> }) => {
                if (value === undefined || value === null || value === 0) return true;
                if (typeof data?.price === 'number' && parseFloat(String(value)) <= data.price) {
                    return 'Compare at price must be greater than the regular price.';
                }
                return true;
            },
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
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            admin: { description: 'Danh mục sản phẩm (Hỗ trợ Multi-select)' },
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
            max: 1000000,
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
            validate: (value: unknown[] | null | undefined) => {
                if (Array.isArray(value)) {
                    const names = value.map((v) => {
                        const n = (v as { name?: unknown })?.name;
                        return typeof n === 'string' ? n.trim().toLowerCase() : undefined;
                    }).filter(Boolean);
                    if (new Set(names).size !== names.length) return 'Tier names must be unique (cannot duplicate names)';
                }
                return true;
            },
            fields: [
                { name: 'name', type: 'text', required: true, maxLength: 50, admin: { description: 'Tên phân loại (VD: Màu sắc)' } },
                {
                    name: 'options',
                    type: 'array',
                    minRows: 1,
                    maxRows: 30,
                    validate: (value: unknown[] | null | undefined) => {
                        if (Array.isArray(value)) {
                            const opts = value.map(v => {
                                const val = (v as { value?: unknown })?.value;
                                return typeof val === 'string' ? val.trim().toLowerCase() : undefined;
                            }).filter(Boolean);
                            if (new Set(opts).size !== opts.length) return 'Options must be unique (no duplicates allowed)';
                        }
                        return true;
                    },
                    fields: [
                        { name: 'value', type: 'text', required: true, maxLength: 50, admin: { description: 'Giá trị tùy chọn (VD: Đỏ, Xanh)' } }
                    ]
                }
            ],
        },
        {
            name: 'variants',
            type: 'array',
            maxRows: 900,
            admin: {
                condition: (data) => Boolean(data?.hasVariants),
                description: 'Ma trận SKU (Tự động sinh ra từ cấu hình ở trên)',
            },
            validate: (value: unknown[] | null | undefined) => {
                if (Array.isArray(value)) {
                    const skus = value.map((v) => {
                        const s = (v as { sku?: unknown })?.sku;
                        return typeof s === 'string' ? s.trim().toLowerCase() : undefined;
                    }).filter(Boolean);
                    if (new Set(skus).size !== skus.length) return 'SKU Codes must be unique across variants';
                }
                return true;
            },
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'sku', type: 'text', maxLength: 100 },
                { name: 'price', type: 'number', required: true, min: 0, max: 100000000 },
                { 
                    name: 'compareAtPrice', 
                    type: 'number', 
                    min: 0, 
                    max: 100000000,
                    validate: (val: number | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
                        if (val === undefined || val === null || val === 0) return true;
                        if (typeof siblingData?.price === 'number' && parseFloat(String(val)) <= siblingData.price) {
                            return 'Compare at price must be greater than variant price.';
                        }
                        return true;
                    }
                },
                { name: 'stock', type: 'number', required: true, min: 0, max: 1000000, defaultValue: 0 },
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
            maxRows: 20,
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
