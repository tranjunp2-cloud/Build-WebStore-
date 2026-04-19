import type { CollectionConfig } from 'payload'

/**
 * ContentPacks — curated bundles of templates grouped by theme/campaign.
 * Super-admin only. Not tenant-scoped (platform-level curation).
 */
export const ContentPacks: CollectionConfig = {
    slug: 'content-packs',
    admin: {
        useAsTitle: 'name',
        description: 'Curated template bundles — campaigns, industry kits, seasonal packs.',
        defaultColumns: ['name', 'category', 'personality', 'createdAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            maxLength: 200,
        },
        {
            name: 'description',
            type: 'textarea',
            maxLength: 2000,
        },
        {
            name: 'coverImage',
            type: 'upload',
            relationTo: 'media',
            admin: { description: 'Cover image shown in packs grid' },
        },
        {
            name: 'includedTemplates',
            type: 'relationship',
            relationTo: 'templates',
            hasMany: true,
            admin: { description: 'Templates included in this pack' },
        },
        {
            name: 'tags',
            type: 'array',
            fields: [{ name: 'tag', type: 'text' }],
        },
        {
            name: 'category',
            type: 'select',
            options: [
                { label: 'Restaurant / Cafe / F&B', value: 'restaurant' },
                { label: 'Shop / Fashion / E-commerce', value: 'ecommerce' },
                { label: 'Beauty / Spa / Wellness', value: 'beauty' },
                { label: 'Tech / IT / SaaS', value: 'tech' },
                { label: 'Health / Dental / Clinic', value: 'health' },
                { label: 'Education / Training', value: 'education' },
                { label: 'Real Estate / Property', value: 'realestate' },
                { label: 'Gym / Fitness / Yoga', value: 'fitness' },
                { label: 'Portfolio / Freelancer / Agency', value: 'creative' },
                { label: 'Business / Corporate', value: 'business' },
                { label: 'F&B / Cafe / Bakery', value: 'fnb' },
                { label: 'Events / Wedding', value: 'events' },
                { label: 'Blog / Media / Magazine', value: 'blog' },
                { label: 'Travel / Tourism', value: 'travel' },
            ],
            admin: { description: 'Primary category for this pack' },
        },
        {
            name: 'personality',
            type: 'select',
            options: [
                { label: 'Warm Traditional', value: 'warm-traditional' },
                { label: 'Warm Homestyle', value: 'warm-homestyle' },
                { label: 'Bold Dark', value: 'bold-dark' },
                { label: 'Soft Feminine', value: 'soft-feminine' },
                { label: 'Calm Wellness', value: 'calm-wellness' },
                { label: 'Modern Vibrant', value: 'modern-vibrant' },
                { label: 'Editorial Clean', value: 'editorial-clean' },
                { label: 'Luxury Travel', value: 'luxury-travel' },
                { label: 'Playful Kids', value: 'playful-kids' },
            ],
            admin: { description: 'Style personality for AI matching' },
        },
    ],
    timestamps: true,
}
