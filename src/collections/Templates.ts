import type { CollectionConfig } from 'payload'

export const TEMPLATE_CATEGORY_OPTIONS = [
    { label: '🍽️ Restaurant / Cafe / F&B', value: 'restaurant' },
    { label: '🛍️ Shop / Fashion / E-commerce', value: 'ecommerce' },
    { label: '💄 Beauty / Spa / Wellness', value: 'beauty' },
    { label: '💻 Tech / IT / SaaS', value: 'tech' },
    { label: '🏥 Health / Dental / Clinic', value: 'health' },
    { label: '📚 Education / Training', value: 'education' },
    { label: '🏠 Real Estate / Property', value: 'realestate' },
    { label: '💪 Gym / Fitness / Yoga', value: 'fitness' },
    { label: '🎨 Portfolio / Freelancer / Agency', value: 'creative' },
    { label: '🏢 Business / Corporate', value: 'business' },
    { label: '🍜 F&B / Cafe / Bakery', value: 'fnb' },
    { label: '🎉 Events / Wedding', value: 'events' },
    { label: '📝 Blog / Media / Magazine', value: 'blog' },
    { label: '✈️ Travel / Tourism', value: 'travel' },
]

export const Templates: CollectionConfig = {
    slug: 'templates',
    admin: {
        useAsTitle: 'name',
        description: 'Pre-built page/site templates that users can select during onboarding.',
    },
    access: {
        read: () => true, // Public — all users can see templates
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        {
            name: 'category',
            type: 'select',
            required: true,
            hasMany: true,
            options: TEMPLATE_CATEGORY_OPTIONS,
        },
        {
            name: 'thumbnail',
            type: 'upload',
            relationTo: 'media',
            required: false,
        },
        {
            name: 'previewUrl',
            type: 'text',
            admin: { description: 'Live preview URL for this template' },
        },
        {
            name: 'isPremium',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Premium templates are only available on Pro/Business plans' },
        },
        {
            name: 'isFeatured',
            type: 'checkbox',
            defaultValue: false,
        },
        {
            name: 'tags',
            type: 'array',
            fields: [{ name: 'tag', type: 'text' }],
        },
        {
            name: 'defaultTheme',
            type: 'group',
            admin: { description: 'Default theme settings for this template' },
            fields: [
                { name: 'primaryColor', type: 'text', defaultValue: '#0ea5e9' },
                { name: 'secondaryColor', type: 'text', defaultValue: '#d946ef' },
                { name: 'fontHeading', type: 'text', defaultValue: 'Outfit' },
                { name: 'fontBody', type: 'text', defaultValue: 'Inter' },
                { name: 'colorMode', type: 'select', options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }], defaultValue: 'light' },
            ],
        },
        {
            name: 'defaultBlocks',
            type: 'json',
            admin: {
                description: 'Default homepage blocks (JSON). Kept for backward compat — prefer templatePages.',
            },
        },
        {
            name: 'templatePages',
            type: 'array',
            admin: {
                description: 'Multi-page template structure. Professional=3 pages, Premium=5 pages.',
            },
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'slug', type: 'text', required: true },
                { name: 'isHomepage', type: 'checkbox', defaultValue: false },
                { name: 'layout', type: 'json' },
            ],
        },
        {
            name: 'sortOrder',
            type: 'number',
            defaultValue: 0,
        },
        {
            name: 'usageCount',
            type: 'number',
            defaultValue: 0,
            admin: { readOnly: true },
        },
    ],
    timestamps: true,
}
