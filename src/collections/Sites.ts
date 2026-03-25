import type { CollectionConfig } from 'payload'

export const Sites: CollectionConfig = {
    slug: 'sites',
    admin: {
        useAsTitle: 'name',
        description: 'Each tenant can have one or more websites.',
    },
    access: {
        // Authenticated users can create sites
        create: ({ req }) => Boolean(req.user),
        // Users can only read their own tenant's sites
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            return { tenant: { in: tenantIds } }
        },
        // Users can update their own tenant's sites
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: any) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            return { tenant: { in: tenantIds } }
        },
        // Users can delete their own tenant's sites
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
            admin: { description: 'The tenant/store this site belongs to' },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Internal name for this website' },
        },
        {
            name: 'domain',
            type: 'text',
            admin: { description: 'Auto-populated from tenant settings or custom domain' },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
                { label: 'Archived', value: 'archived' },
            ],
        },
        {
            name: 'siteType',
            type: 'select',
            required: true,
            defaultValue: 'business',
            options: [
                { label: '🏢 Business / Corporate', value: 'business' },
                { label: '🛍️ Online Store (E-commerce)', value: 'ecommerce' },
                { label: '🍽️ Restaurant / Cafe / F&B', value: 'restaurant' },
                { label: '💻 Tech / IT / SaaS', value: 'tech' },
                { label: '🏥 Health / Dental / Clinic', value: 'health' },
                { label: '📚 Education / Training', value: 'education' },
                { label: '🏠 Real Estate / Property', value: 'realestate' },
                { label: '💪 Gym / Fitness / Yoga', value: 'fitness' },
                { label: '🎨 Portfolio / Freelancer / Agency', value: 'creative' },
                { label: '💄 Beauty / Spa / Wellness', value: 'beauty' },
                { label: '✍️ Blog', value: 'blog' },
            ],
        },
        {
            name: 'locale',
            type: 'select',
            options: [
                { label: 'Bahasa Melayu', value: 'ms' },
                { label: 'English', value: 'en' },
            ],
            defaultValue: 'ms',
        },
        {
            name: 'theme',
            type: 'group',
            label: 'Site Theme & Branding',
            fields: [
                {
                    name: 'primaryColor',
                    type: 'text',
                    defaultValue: '#0ea5e9',
                    admin: { description: 'Primary brand color (hex)' },
                },
                {
                    name: 'secondaryColor',
                    type: 'text',
                    defaultValue: '#d946ef',
                },
                {
                    name: 'backgroundColor',
                    type: 'text',
                    defaultValue: '#ffffff',
                },
                {
                    name: 'fontHeading',
                    type: 'select',
                    defaultValue: 'Outfit',
                    options: [
                        { label: 'Outfit', value: 'Outfit' },
                        { label: 'Inter', value: 'Inter' },
                        { label: 'Playfair Display', value: 'Playfair Display' },
                        { label: 'DM Sans', value: 'DM Sans' },
                        { label: 'Poppins', value: 'Poppins' },
                        { label: 'Raleway', value: 'Raleway' },
                    ],
                },
                {
                    name: 'fontBody',
                    type: 'select',
                    defaultValue: 'Inter',
                    options: [
                        { label: 'Inter', value: 'Inter' },
                        { label: 'DM Sans', value: 'DM Sans' },
                        { label: 'Lato', value: 'Lato' },
                        { label: 'Open Sans', value: 'Open Sans' },
                        { label: 'Nunito', value: 'Nunito' },
                    ],
                },
                {
                    name: 'borderRadius',
                    type: 'select',
                    defaultValue: 'rounded',
                    options: [
                        { label: 'Sharp (0px)', value: 'sharp' },
                        { label: 'Subtle (4px)', value: 'subtle' },
                        { label: 'Rounded (8px)', value: 'rounded' },
                        { label: 'Soft (16px)', value: 'soft' },
                        { label: 'Pill (9999px)', value: 'pill' },
                    ],
                },
                {
                    name: 'colorMode',
                    type: 'select',
                    defaultValue: 'light',
                    options: [
                        { label: 'Light', value: 'light' },
                        { label: 'Dark', value: 'dark' },
                    ],
                },
            ],
        },
        {
            name: 'seo',
            type: 'group',
            label: 'SEO Settings',
            fields: [
                {
                    name: 'metaTitle',
                    type: 'text',
                    admin: { description: 'Default meta title for the site' },
                },
                {
                    name: 'metaDescription',
                    type: 'textarea',
                    admin: { description: 'Default meta description' },
                },
                {
                    name: 'ogImage',
                    type: 'upload',
                    relationTo: 'media',
                },
                {
                    name: 'googleAnalyticsId',
                    type: 'text',
                },
                {
                    name: 'googleVerificationToken',
                    type: 'text',
                },
                {
                    name: 'trackedKeywords',
                    type: 'array',
                    maxRows: 5,
                    admin: { description: 'Track up to 5 core keywords for SEO ranking' },
                    fields: [
                        { name: 'keyword', type: 'text', required: true },
                        { name: 'currentRank', type: 'number' },
                        { name: 'previousRank', type: 'number' },
                        { name: 'lastCheckedAt', type: 'date' },
                    ],
                },
            ],
        },
        {
            name: 'socialLinks',
            type: 'group',
            fields: [
                { name: 'facebook', type: 'text' },
                { name: 'instagram', type: 'text' },
                { name: 'twitter', type: 'text' },
                { name: 'linkedin', type: 'text' },
                { name: 'youtube', type: 'text' },
                { name: 'tiktok', type: 'text' },
            ],
        },
        {
            name: 'aiGenerationMetadata',
            type: 'group',
            label: 'AI Generation Info',
            admin: { description: 'Metadata stored from AI generation session' },
            fields: [
                {
                    name: 'generatedAt',
                    type: 'date',
                    admin: { readOnly: true },
                },
                {
                    name: 'originalPrompt',
                    type: 'textarea',
                    admin: { readOnly: true, description: 'The prompt used to generate this site' },
                },
                {
                    name: 'businessType',
                    type: 'text',
                    admin: { readOnly: true },
                },
            ],
        },
        {
            name: 'publishedAt',
            type: 'date',
            admin: { readOnly: true },
        },
        {
            name: 'shippingConfig',
            type: 'group',
            label: 'Shipping Configuration',
            admin: { description: 'Shipping rates for Malaysia regions' },
            fields: [
                {
                    name: 'westRate',
                    type: 'number',
                    defaultValue: 800,
                    admin: { description: 'Semenanjung rate in sen (800 = RM 8)' },
                },
                {
                    name: 'eastRate',
                    type: 'number',
                    defaultValue: 1500,
                    admin: { description: 'Sabah/Sarawak rate in sen (1500 = RM 15)' },
                },
                {
                    name: 'freeAbove',
                    type: 'number',
                    admin: { description: 'Free shipping above X sen (null = no free shipping)' },
                },
            ],
        },
        {
            name: 'headerBlock',
            type: 'json',
            admin: { description: 'Global header/navigation block for all pages' },
        },
        {
            name: 'footerBlock',
            type: 'json',
            admin: { description: 'Global footer block for all pages' },
        },
    ],
    timestamps: true,
}
