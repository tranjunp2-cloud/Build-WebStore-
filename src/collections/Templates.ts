import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { checkCompliance } from '@/lib/admin/dna-compliance'

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

/**
 * afterChange hook: recompute DNA compliance cache when template is saved.
 * Guard: skip when context.skipComplianceHook to prevent infinite loop.
 */
const recomputeComplianceHook: CollectionAfterChangeHook = async ({ doc, req, context }) => {
    if (context?.skipComplianceHook) return doc

    const categories = Array.isArray(doc.category) ? doc.category : [doc.category].filter(Boolean)
    if (categories.length === 0) return doc

    try {
        // Fetch first matching category's DNA
        const categorySlug = categories[0]
        const catResult = await req.payload.find({
            collection: 'categories',
            where: { slug: { equals: categorySlug } },
            limit: 1,
            depth: 0,
        })

        const dna = catResult.docs[0]?.dna ?? null
        if (!dna) return doc

        const compliance = checkCompliance(doc, dna as Record<string, unknown>)

        await req.payload.update({
            collection: 'templates',
            id: doc.id,
            data: { dnaComplianceCache: compliance },
            context: { skipComplianceHook: true },
        })
    } catch (err) {
        // Non-fatal: compliance cache is best-effort
        console.warn('[Templates] compliance recompute failed:', err)
    }

    return doc
}

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
    hooks: {
        afterChange: [recomputeComplianceHook],
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
            name: 'status',
            type: 'select',
            defaultValue: 'live',
            options: [
                { label: 'Live', value: 'live' },
                { label: 'Draft', value: 'draft' },
                { label: 'Review', value: 'review' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Archived', value: 'archived' },
            ],
            admin: { description: 'Publication status of the template' },
        },
        {
            name: 'scheduledFor',
            type: 'date',
            admin: { description: 'Publish at this date/time (only applies when status=scheduled)' },
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
            admin: { description: 'Visual personality / style profile for AI matching' },
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
        {
            name: 'dnaComplianceCache',
            type: 'json',
            admin: {
                readOnly: true,
                description: 'Auto-populated compliance result from Category DNA check. Do not edit manually.',
            },
        },
        {
            name: 'blockPromptOverrides',
            type: 'json',
            defaultValue: {},
            admin: {
                description: 'Per-block AI prompt overrides. Shape: { [blockSlug]: { prompt: string, updatedAt: string, updatedBy?: string } }',
            },
        },
    ],
    timestamps: true,
}
