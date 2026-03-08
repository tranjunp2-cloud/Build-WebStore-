import type { CollectionConfig } from 'payload'

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
            options: [
                { label: '🍽️ Nhà hàng / Cafe / F&B', value: 'restaurant' },
                { label: '🛍️ Cửa hàng / Thời trang / E-commerce', value: 'ecommerce' },
                { label: '💄 Beauty / Spa / Thẩm mỹ', value: 'beauty' },
                { label: '💻 Công nghệ / IT / SaaS', value: 'tech' },
                { label: '🏥 Y tế / Nha khoa / Clinic', value: 'health' },
                { label: '📚 Giáo dục / Đào tạo', value: 'education' },
                { label: '🏠 Bất động sản', value: 'realestate' },
                { label: '💪 Gym / Fitness / Yoga', value: 'fitness' },
                { label: '🎨 Portfolio / Freelancer / Agency', value: 'creative' },
                { label: '🏢 Business / Doanh nghiệp chung', value: 'business' },
            ],
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
                description: 'Default page blocks configuration (JSON) applied when using this template',
            },
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
