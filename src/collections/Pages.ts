import type { Block, CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { queueSEOAutoGeneration } from '../lib/ai/seo-queue'
// Block definitions — each block is a section of a page
const HeroBlock = {
    slug: 'hero',
    labels: { singular: 'Hero Section', plural: 'Hero Sections' },
    fields: [
        {
            name: 'variant',
            type: 'select',
            defaultValue: 'centered',
            options: [
                { label: 'Centered', value: 'centered' },
                { label: 'Split (Text Left / Image Right)', value: 'split-left' },
                { label: 'Split (Image Left / Text Right)', value: 'split-right' },
                { label: 'Full-Screen Background', value: 'fullscreen' },
                { label: 'Video Background', value: 'video' },
            ],
        },
        { name: 'headline', type: 'text', required: true },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'ctaButtons',
            type: 'array',
            maxRows: 3,
            fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'url', type: 'text', required: true },
                {
                    name: 'style', type: 'select', defaultValue: 'primary',
                    options: [
                        { label: 'Primary', value: 'primary' },
                        { label: 'Secondary', value: 'secondary' },
                        { label: 'Outline', value: 'outline' },
                        { label: 'Ghost', value: 'ghost' },
                    ],
                },
            ],
        },
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'backgroundImage', type: 'upload', relationTo: 'media' },
        { name: 'videoUrl', type: 'text', admin: { condition: (_: unknown, s: Record<string, unknown>) => s?.variant === 'video' } },
        {
            name: 'badge',
            type: 'group',
            fields: [
                { name: 'show', type: 'checkbox', defaultValue: false },
                { name: 'text', type: 'text' },
            ],
        },
    ],
}

const NavigationBlock = {
    slug: 'navigation',
    labels: { singular: 'Navigation Bar', plural: 'Navigation Bars' },
    fields: [
        {
            name: 'style',
            type: 'select',
            defaultValue: 'fixed',
            options: [
                { label: 'Fixed (always visible)', value: 'fixed' },
                { label: 'Sticky (sticks on scroll)', value: 'sticky' },
                { label: 'Static', value: 'static' },
                { label: 'Transparent (hero overlay)', value: 'transparent' },
            ],
        },
        { name: 'logo', type: 'upload', relationTo: 'media' },
        { name: 'logoText', type: 'text' },
        {
            name: 'links',
            type: 'array',
            fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'url', type: 'text', required: true },
                { name: 'openInNewTab', type: 'checkbox', defaultValue: false },
            ],
        },
        {
            name: 'ctaButton',
            type: 'group',
            fields: [
                { name: 'show', type: 'checkbox', defaultValue: true },
                { name: 'label', type: 'text', defaultValue: 'Get Started' },
                { name: 'url', type: 'text' },
            ],
        },
    ],
}

const AboutBlock = {
    slug: 'about',
    labels: { singular: 'About Section', plural: 'About Sections' },
    fields: [
        {
            name: 'layout',
            type: 'select',
            defaultValue: 'image-right',
            options: [
                { label: 'Image Right', value: 'image-right' },
                { label: 'Image Left', value: 'image-left' },
                { label: 'Centered (no image)', value: 'centered' },
                { label: 'Cards Grid', value: 'cards' },
            ],
        },
        { name: 'sectionLabel', type: 'text', defaultValue: 'About Us' },
        { name: 'headline', type: 'text', required: true },
        { name: 'body', type: 'richText' },
        { name: 'image', type: 'upload', relationTo: 'media' },
        {
            name: 'stats',
            type: 'array',
            maxRows: 4,
            admin: { condition: (_: unknown, s: Record<string, unknown>) => s?.layout === 'cards' },
            fields: [
                { name: 'value', type: 'text', required: true },
                { name: 'label', type: 'text', required: true },
            ],
        },
    ],
}

const ContactBlock = {
    slug: 'contact',
    labels: { singular: 'Contact Section', plural: 'Contact Sections' },
    fields: [
        { name: 'headline', type: 'text', defaultValue: 'Contact Us' },
        { name: 'subtext', type: 'textarea' },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'textarea' },
        {
            name: 'formFields',
            type: 'array',
            defaultValue: [
                { fieldName: 'name', fieldType: 'text', label: 'Your Name', required: true },
                { fieldName: 'email', fieldType: 'email', label: 'Email Address', required: true },
                { fieldName: 'message', fieldType: 'textarea', label: 'Message', required: true },
            ],
            fields: [
                { name: 'fieldName', type: 'text', required: true },
                { name: 'label', type: 'text', required: true },
                {
                    name: 'fieldType', type: 'select', required: true,
                    options: [
                        { label: 'Text', value: 'text' },
                        { label: 'Email', value: 'email' },
                        { label: 'Phone', value: 'phone' },
                        { label: 'Textarea', value: 'textarea' },
                        { label: 'Select', value: 'select' },
                    ],
                },
                { name: 'required', type: 'checkbox', defaultValue: false },
                { name: 'placeholder', type: 'text' },
            ],
        },
        { name: 'showMap', type: 'checkbox', defaultValue: false },
        { name: 'mapEmbedUrl', type: 'text' },
    ],
}

const FooterBlock = {
    slug: 'footer',
    labels: { singular: 'Footer Section', plural: 'Footer Sections' },
    fields: [
        { name: 'logoText', type: 'text' },
        { name: 'logo', type: 'upload', relationTo: 'media' },
        { name: 'tagline', type: 'text' },
        {
            name: 'columns',
            type: 'array',
            maxRows: 4,
            fields: [
                { name: 'title', type: 'text', required: true },
                {
                    name: 'links',
                    type: 'array',
                    fields: [
                        { name: 'label', type: 'text', required: true },
                        { name: 'url', type: 'text', required: true },
                    ],
                },
            ],
        },
        { name: 'copyrightText', type: 'text' },
        { name: 'showSocialLinks', type: 'checkbox', defaultValue: true },
    ],
}

const FeaturesBlock = {
    slug: 'features',
    labels: { singular: 'Features Section', plural: 'Features Sections' },
    fields: [
        { name: 'sectionLabel', type: 'text' },
        { name: 'headline', type: 'text', required: true },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'layout',
            type: 'select',
            defaultValue: 'grid-3',
            options: [
                { label: 'Grid (3 columns)', value: 'grid-3' },
                { label: 'Grid (2 columns)', value: 'grid-2' },
                { label: 'Alternating (icon + text)', value: 'alternating' },
                { label: 'Centered list', value: 'centered-list' },
            ],
        },
        {
            name: 'features',
            type: 'array',
            required: true,
            fields: [
                { name: 'icon', type: 'text', admin: { description: 'Lucide icon name or emoji' } },
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'textarea', required: true },
            ],
        },
    ],
}

const TestimonialsBlock = {
    slug: 'testimonials',
    labels: { singular: 'Testimonials Section', plural: 'Testimonials Sections' },
    fields: [
        { name: 'headline', type: 'text', defaultValue: 'What Our Customers Say' },
        {
            name: 'variant',
            type: 'select',
            defaultValue: 'carousel',
            options: [
                { label: 'Carousel', value: 'carousel' },
                { label: 'Grid', value: 'grid' },
                { label: 'Masonry', value: 'masonry' },
                { label: 'Single Featured', value: 'single' },
            ],
        },
        {
            name: 'testimonials',
            type: 'array',
            fields: [
                { name: 'quote', type: 'textarea', required: true },
                { name: 'name', type: 'text', required: true },
                { name: 'title', type: 'text', admin: { description: 'Job title / role' } },
                { name: 'company', type: 'text' },
                { name: 'avatar', type: 'upload', relationTo: 'media' },
                { name: 'rating', type: 'number', min: 1, max: 5, defaultValue: 5 },
            ],
        },
    ],
}

const GalleryBlock = {
    slug: 'gallery',
    labels: { singular: 'Gallery Section', plural: 'Gallery Sections' },
    fields: [
        { name: 'headline', type: 'text' },
        {
            name: 'layout',
            type: 'select',
            defaultValue: 'masonry',
            options: [
                { label: 'Masonry', value: 'masonry' },
                { label: 'Grid', value: 'grid' },
                { label: 'Carousel', value: 'carousel' },
                { label: 'Lightbox Grid', value: 'lightbox' },
            ],
        },
        {
            name: 'images',
            type: 'array',
            fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'caption', type: 'text' },
            ],
        },
    ],
}

const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation }) => {
    const isPublishingUpdate = operation === 'update' && doc._status === 'published' && previousDoc?._status !== 'published'
    const isPublishingCreate = operation === 'create' && doc._status === 'published'

    // Wait until it becomes published and seo title is empty
    if ((isPublishingUpdate || isPublishingCreate) && !doc.seo?.title) {
        // Collect text content for context (very basic extraction)
        let textContext = ''
        if (Array.isArray(doc.layout)) {
            const texts = doc.layout.map((block: any) => block.headline || block.sectionLabel || '').filter(Boolean)
            textContext = texts.join('. ')
        }
        
        // Trigger background generation
        queueSEOAutoGeneration('pages', doc.id, typeof doc.site === 'object' ? doc.site.id : doc.site, doc.title, textContext)
    }
}

export const Pages: CollectionConfig = {
    slug: 'pages',
    hooks: {
        afterChange: [afterChangeHook],
    },
    admin: {
        useAsTitle: 'title',
        description: 'Pages belong to a site and contain ordered blocks.',
        livePreview: {
            url: ({ data, req }) => {
                const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                return `${baseUrl}/preview/${data?.site}/${data?.slug}?preview=true`
            },
        },
    },
    versions: {
        drafts: {
            autosave: { interval: 5000 },
        },
    },
    fields: [
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
            admin: {
                description: 'URL path — "/" for homepage, "/about" for about page',
            },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
        },
        {
            name: 'isHomepage',
            type: 'checkbox',
            defaultValue: false,
        },
        {
            name: 'layout',
            type: 'blocks',
            label: 'Page Blocks',
            blocks: [
                NavigationBlock,
                HeroBlock,
                AboutBlock,
                FeaturesBlock,
                TestimonialsBlock,
                ContactBlock,
                GalleryBlock,
                FooterBlock,
            ] as Block[],
        },
        {
            name: 'seo',
            type: 'group',
            fields: [
                { name: 'title', type: 'text' },
                { name: 'description', type: 'textarea' },
                { name: 'ogImage', type: 'upload', relationTo: 'media' },
                { name: 'noIndex', type: 'checkbox', defaultValue: false },
            ],
        },
        {
            name: 'publishedAt',
            type: 'date',
        },
    ],
    timestamps: true,
}
