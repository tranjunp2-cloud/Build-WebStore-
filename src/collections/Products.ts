import type { CollectionConfig, Where } from 'payload'

export const Products: CollectionConfig = {
    slug: 'products',
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
            admin: { description: 'Product description (supports rich text)' },
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
            maxRows: 10,
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
