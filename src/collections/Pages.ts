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
                { label: 'Magazine', value: 'magazine' },
                { label: 'Minimal', value: 'minimal' },
                { label: 'Cards Overlay', value: 'cards-overlay' },
                { label: 'Gradient', value: 'gradient' },
                { label: 'Parallax', value: 'parallax' },
                { label: 'Slideshow', value: 'slideshow' },
                { label: 'Split Video', value: 'split-video' },
            ],
        },
        { name: 'headline', type: 'text' },
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
            name: 'variant',
            type: 'select',
            defaultValue: 'simple',
            options: [
                { label: 'Simple', value: 'simple' },
                { label: 'Centered', value: 'centered' },
                { label: 'Mega Menu', value: 'mega-menu' },
                { label: 'Transparent', value: 'transparent' },
                { label: 'Sidebar', value: 'sidebar' },
                { label: 'Pill', value: 'pill' },
            ],
        },
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
            name: 'variant',
            type: 'select',
            defaultValue: 'simple',
            options: [
                { label: 'Simple', value: 'simple' },
                { label: 'Split', value: 'split' },
                { label: 'Story', value: 'story' },
                { label: 'Two Column', value: 'two-column' },
                { label: 'Founder Quote', value: 'founder-quote' },
                { label: 'Centered Large', value: 'centered-large' },
                { label: 'Image Overlay', value: 'image-overlay' },
            ],
        },
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
        { name: 'headline', type: 'text' },
        { name: 'body', type: 'textarea' },
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
        {
            // Plan 260415 — contact block previously had no variant field,
            // so Payload stripped the variant set by AI gen / composer and
            // every contact rendered as `form`. Now persisted + rotated
            // per category via CONTACT_VARIANT_BY_CATEGORY.
            name: 'variant',
            type: 'select',
            defaultValue: 'form',
            options: [
                { label: 'Form (info left, form right)', value: 'form' },
                { label: 'Info Only', value: 'info-only' },
                { label: 'Split (form left, info right)', value: 'split' },
                { label: 'Card Float', value: 'card-float' },
                { label: 'Map Split', value: 'map-split' },
                { label: 'Minimal Inline', value: 'minimal-inline' },
            ],
        },
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
        {
            // Plan 260415 — persist footer variant so same-category sites
            // rotate across footer shapes via FOOTER_VARIANT_BY_CATEGORY.
            name: 'variant',
            type: 'select',
            defaultValue: 'simple',
            options: [
                { label: 'Simple', value: 'simple' },
                { label: 'Minimal', value: 'minimal' },
                { label: 'Centered Stack', value: 'centered-stack' },
                { label: 'Dark Gradient', value: 'dark-gradient' },
            ],
        },
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

const SocialWidgetBlock = {
    slug: 'socialWidget',
    labels: { singular: 'Social Widget', plural: 'Social Widgets' },
    fields: [
        {
            name: 'variant',
            type: 'select',
            defaultValue: 'floating',
            options: [
                { label: 'Floating', value: 'floating' },
                { label: 'Inline', value: 'inline' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'links',
            type: 'array',
            fields: [
                {
                    name: 'platform',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Facebook', value: 'facebook' },
                        { label: 'WhatsApp', value: 'whatsapp' },
                        { label: 'Instagram', value: 'instagram' },
                        { label: 'LinkedIn', value: 'linkedin' },
                        { label: 'YouTube', value: 'youtube' },
                    ],
                },
                { name: 'url', type: 'text' },
                { name: 'enabled', type: 'checkbox', defaultValue: true },
            ],
        },
    ],
}

const CartWidgetBlock = {
    slug: 'cartWidget',
    labels: { singular: 'Cart Widget', plural: 'Cart Widgets' },
    fields: [
        {
            name: 'variant',
            type: 'select',
            defaultValue: 'floating',
            options: [
                { label: 'Floating', value: 'floating' },
                { label: 'Inline', value: 'inline' },
            ],
        },
        { name: 'label', type: 'text', defaultValue: 'Cart' },
        { name: 'showLabel', type: 'checkbox', defaultValue: false },
    ],
}

const FeaturesBlock = {
    slug: 'features',
    labels: { singular: 'Features Section', plural: 'Features Sections' },
    fields: [
        { name: 'sectionLabel', type: 'text' },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'variant',
            type: 'select',
            defaultValue: 'grid-3',
            options: [
                { label: 'Grid (2 columns)', value: 'grid-2' },
                { label: 'Grid (3 columns)', value: 'grid-3' },
                { label: 'Grid (4 columns)', value: 'grid-4' },
                { label: 'List', value: 'list' },
                { label: 'Icon Top', value: 'icon-top' },
                { label: 'Icon Left', value: 'icon-left' },
                { label: 'Zigzag', value: 'zigzag' },
                { label: 'Carousel', value: 'carousel' },
            ],
        },
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
            defaultValue: 'cards',
            options: [
                { label: 'Cards', value: 'cards' },
                { label: 'Carousel', value: 'carousel' },
                { label: 'Simple', value: 'simple' },
                { label: 'Masonry', value: 'masonry' },
                { label: 'Spotlight', value: 'spotlight' },
                { label: 'Minimal Quote', value: 'minimal-quote' },
                { label: 'Avatar Row', value: 'avatar-row' },
                { label: 'Video Text', value: 'video-text' },
                { label: 'Grid', value: 'grid' },
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
            name: 'variant',
            type: 'select',
            defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'Masonry', value: 'masonry' },
                { label: 'Carousel', value: 'carousel' },
                { label: 'Lightbox', value: 'lightbox' },
                { label: 'Filmstrip', value: 'filmstrip' },
                { label: 'Justified', value: 'justified' },
            ],
        },
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
                { name: 'image', type: 'upload', relationTo: 'media', required: false },
                { name: 'caption', type: 'text' },
            ],
        },
    ],
}


const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    const isPublishingUpdate = operation === 'update' && doc._status === 'published' && previousDoc?._status !== 'published'
    const isPublishingCreate = operation === 'create' && doc._status === 'published'

    // Wait until it becomes published and seo title is empty
    if ((isPublishingUpdate || isPublishingCreate) && !doc.seo?.title) {
        const siteId = typeof doc.site === 'object' ? doc.site.id : doc.site

        // Guard: req.payload may be unavailable when called from custom API routes
        if (!req?.payload) return

        // Check if auto meta generation is enabled for this site
        try {
            const site = await req.payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
            if (site.seo?.autoMetaEnabled === false) return
        } catch { /* proceed if can't check */ }

        // Collect text content for context (very basic extraction)
        let textContext = ''
        if (Array.isArray(doc.layout)) {
            const texts = doc.layout.map((block: Record<string, unknown>) => block.headline || block.sectionLabel || '').filter(Boolean)
            textContext = texts.join('. ')
        }

        // Trigger background generation
        queueSEOAutoGeneration('pages', doc.id, siteId, doc.title, textContext)
    }
}

const StatsBlock = {
    slug: 'stats',
    labels: { singular: 'Stats Section', plural: 'Stats Sections' },
    fields: [
        {
            // Plan 260415 — previously the stats block persisted no variant
            // so every gen rendered the same `row` default.
            name: 'variant',
            type: 'select',
            defaultValue: 'row',
            options: [
                { label: 'Row', value: 'row' },
                { label: 'Grid', value: 'grid' },
                { label: 'Highlight', value: 'highlight' },
                { label: 'Cards', value: 'cards' },
                { label: 'Inline Text', value: 'inline-text' },
                { label: 'Chart Bars', value: 'chart-bars' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'stats',
            type: 'array',
            required: true,
            fields: [
                { name: 'value', type: 'text', required: true },
                { name: 'label', type: 'text', required: true },
            ],
        },
    ],
}

const PricingBlock = {
    slug: 'pricing',
    labels: { singular: 'Pricing Section', plural: 'Pricing Sections' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'cards',
            options: [
                { label: 'Cards', value: 'cards' },
                { label: 'Table', value: 'table' },
                { label: 'Horizontal', value: 'horizontal' },
                { label: 'Toggle', value: 'toggle' },
                { label: 'Tiered', value: 'tiered' },
                { label: 'Comparison', value: 'comparison' },
                { label: 'Minimal', value: 'minimal' },
                { label: 'Slider', value: 'slider' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'plans',
            type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'price', type: 'text', required: true },
                { name: 'description', type: 'textarea' },
                {
                    name: 'features',
                    type: 'array',
                    fields: [
                        { name: 'text', type: 'text', required: true },
                        { name: 'included', type: 'checkbox', defaultValue: true },
                    ],
                },
                { name: 'isPopular', type: 'checkbox', defaultValue: false },
                { name: 'ctaLabel', type: 'text', defaultValue: 'Get Started' },
                { name: 'ctaUrl', type: 'text' },
            ],
        },
    ],
}

const FAQBlock = {
    slug: 'faq',
    labels: { singular: 'FAQ Section', plural: 'FAQ Sections' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'accordion',
            options: [
                { label: 'Accordion', value: 'accordion' },
                { label: 'Grid', value: 'grid' },
                { label: 'Simple', value: 'simple' },
                { label: 'Two Column Accordion', value: 'two-column-accordion' },
                { label: 'Chat Bubbles', value: 'chat-bubbles' },
                { label: 'Numbered', value: 'numbered' },
            ],
        },
        { name: 'headline', type: 'text', defaultValue: 'Frequently Asked Questions' },
        {
            name: 'faqs',
            type: 'array',
            fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
            ],
        },
    ],
}

const TeamBlock = {
    slug: 'team',
    labels: { singular: 'Team Section', plural: 'Team Sections' },
    fields: [
        {
            // Plan 260415 — persist team variant (grid vs list).
            // Plan 260417 A5 — added 4 new variants for pool diversity.
            name: 'variant',
            type: 'select',
            defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
                { label: 'Cards (hover reveal)', value: 'cards-hover-reveal' },
                { label: 'Horizontal Scroll', value: 'horizontal-scroll' },
                { label: 'Bio Modal', value: 'bio-modal' },
                { label: 'Compact Row', value: 'compact-row' },
            ],
        },
        { name: 'headline', type: 'text', defaultValue: 'Meet Our Team' },
        {
            name: 'members',
            type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'role', type: 'text' },
                { name: 'bio', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
            ],
        },
    ],
}

// ── Additional blocks for AI generation ─────────────────────────────────────

const CTABlock = {
    slug: 'cta',
    labels: { singular: 'Call to Action', plural: 'Call to Actions' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'banner',
            options: [
                { label: 'Banner', value: 'banner' },
                { label: 'Inline', value: 'inline' },
                { label: 'Card', value: 'card' },
                { label: 'Floating Sticky', value: 'floating-sticky' },
                { label: 'Image BG', value: 'image-bg' },
                { label: 'Split Testimonial', value: 'split-testimonial' },
                { label: 'Dark Card', value: 'dark-card' },
                { label: 'Mesh Gradient Hero', value: 'mesh-gradient-hero' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'ctaLabel', type: 'text', defaultValue: 'Get Started' },
        { name: 'ctaUrl', type: 'text' },
        {
            name: 'ctaStyle', type: 'select', defaultValue: 'primary',
            options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Outline', value: 'outline' },
            ],
        },
        { name: 'secondaryCtaLabel', type: 'text' },
        { name: 'secondaryCtaUrl', type: 'text' },
    ],
}

const NewsletterBlock = {
    slug: 'newsletter',
    labels: { singular: 'Newsletter Section', plural: 'Newsletter Sections' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'inline',
            options: [
                { label: 'Inline', value: 'inline' },
                { label: 'Popup', value: 'popup' },
                { label: 'Banner', value: 'banner' },
                { label: 'Stacked Card', value: 'stacked-card' },
                { label: 'Minimal', value: 'minimal' },
                { label: 'Incentive Grid', value: 'incentive-grid' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'buttonLabel', type: 'text', defaultValue: 'Subscribe' },
        { name: 'placeholder', type: 'text', defaultValue: 'Enter your email' },
    ],
}

const VideoBlock = {
    slug: 'video',
    labels: { singular: 'Video Section', plural: 'Video Sections' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'embed',
            options: [
                { label: 'Embed', value: 'embed' },
                { label: 'Background', value: 'background' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'videoUrl', type: 'text', required: true },
        { name: 'posterImage', type: 'upload', relationTo: 'media' },
    ],
}

const LogoCloudBlock = {
    slug: 'logo-cloud',
    labels: { singular: 'Logo Cloud', plural: 'Logo Clouds' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'row',
            options: [
                { label: 'Row', value: 'row' },
                { label: 'Grid', value: 'grid' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'logos', type: 'array',
            fields: [
                { name: 'name', type: 'text' },
                { name: 'logo', type: 'upload', relationTo: 'media' },
            ],
        },
    ],
}

const BlogListBlock = {
    slug: 'blog-list',
    labels: { singular: 'Blog List', plural: 'Blog Lists' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'cards',
            options: [
                { label: 'Cards', value: 'cards' },
                { label: 'List', value: 'list' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'limit', type: 'number', defaultValue: 6 },
    ],
}

const ProductsGridBlock = {
    slug: 'products-grid',
    labels: { singular: 'Products Grid', plural: 'Products Grids' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid-3',
            options: [
                { label: 'Grid (3 columns)', value: 'grid-3' },
                { label: 'Grid (4 columns)', value: 'grid-4' },
                { label: 'List', value: 'list' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'limit', type: 'number', defaultValue: 6 },
        { name: 'category', type: 'text' },
    ],
}

const ProductsFeaturedBlock = {
    slug: 'products-featured',
    labels: { singular: 'Featured Products', plural: 'Featured Products' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'hero-product',
            options: [
                { label: 'Hero Product', value: 'hero-product' },
                { label: 'Carousel', value: 'carousel' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
    ],
}

const CustomHtmlBlock = {
    slug: 'custom-html',
    labels: { singular: 'Custom HTML', plural: 'Custom HTML Blocks' },
    fields: [
        { name: 'html', type: 'code', required: true, admin: { language: 'html' } },
    ],
}

const ServiceCardsBlock = {
    slug: 'service-cards',
    labels: { singular: 'Service Cards', plural: 'Service Cards' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
                { label: 'Featured', value: 'featured' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'services', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'textarea' },
                { name: 'icon', type: 'text' },
                { name: 'price', type: 'text' },
                { name: 'priceUnit', type: 'text' },
            ],
        },
    ],
}

const CarouselBlock = {
    slug: 'carousel',
    labels: { singular: 'Carousel', plural: 'Carousels' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'images',
            options: [
                { label: 'Images', value: 'images' },
                { label: 'Cards', value: 'cards' },
                { label: 'Testimonials', value: 'testimonials' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'autoplay', type: 'checkbox', defaultValue: true },
        { name: 'interval', type: 'number', defaultValue: 5000 },
        {
            name: 'items', type: 'array',
            fields: [
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'title', type: 'text' },
                { name: 'description', type: 'textarea' },
                { name: 'linkUrl', type: 'text' },
            ],
        },
    ],
}

const StepProcessBlock = {
    slug: 'step-process',
    labels: { singular: 'Step Process', plural: 'Step Processes' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'vertical',
            options: [
                { label: 'Vertical', value: 'vertical' },
                { label: 'Horizontal', value: 'horizontal' },
                { label: 'Alternating', value: 'alternating' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'steps', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'textarea', required: true },
                { name: 'icon', type: 'text' },
            ],
        },
    ],
}

const DividerBlock = {
    slug: 'divider',
    labels: { singular: 'Divider', plural: 'Dividers' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'line',
            options: [
                { label: 'Line', value: 'line' },
                { label: 'Dots', value: 'dots' },
                { label: 'Wave', value: 'wave' },
                { label: 'Spacer', value: 'spacer' },
            ],
        },
        { name: 'height', type: 'number', defaultValue: 1 },
        { name: 'color', type: 'text' },
    ],
}

const AnnouncementBarBlock = {
    slug: 'announcement-bar',
    labels: { singular: 'Announcement Bar', plural: 'Announcement Bars' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'solid',
            options: [
                { label: 'Gradient', value: 'gradient' },
                { label: 'Solid', value: 'solid' },
                { label: 'Minimal', value: 'minimal' },
            ],
        },
        { name: 'message', type: 'text', required: true },
        { name: 'linkText', type: 'text' },
        { name: 'linkUrl', type: 'text' },
        { name: 'dismissible', type: 'checkbox', defaultValue: true },
        { name: 'backgroundColor', type: 'text' },
    ],
}

const WhatsappButtonBlock = {
    slug: 'whatsapp-button',
    labels: { singular: 'WhatsApp Button', plural: 'WhatsApp Buttons' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'floating',
            options: [
                { label: 'Floating', value: 'floating' },
                { label: 'Inline', value: 'inline' },
            ],
        },
        { name: 'phoneNumber', type: 'text', required: true },
        { name: 'message', type: 'text' },
        { name: 'label', type: 'text', defaultValue: 'Chat with us' },
        {
            name: 'position', type: 'select', defaultValue: 'bottom-right',
            options: [
                { label: 'Bottom Right', value: 'bottom-right' },
                { label: 'Bottom Left', value: 'bottom-left' },
            ],
        },
    ],
}

const GoogleMapsBlock = {
    slug: 'google-maps',
    labels: { singular: 'Google Maps', plural: 'Google Maps' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'full-width',
            options: [
                { label: 'Full Width', value: 'full-width' },
                { label: 'Card', value: 'card' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'embedUrl', type: 'text', required: true },
        { name: 'address', type: 'textarea' },
        { name: 'height', type: 'number', defaultValue: 400 },
    ],
}

const AccordionBlock = {
    slug: 'accordion',
    labels: { singular: 'Accordion', plural: 'Accordions' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'bordered',
            options: [
                { label: 'Bordered', value: 'bordered' },
                { label: 'Separated', value: 'separated' },
                { label: 'Flush', value: 'flush' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'description', type: 'textarea' },
        {
            name: 'items', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'content', type: 'textarea', required: true },
            ],
        },
    ],
}

const CountdownTimerBlock = {
    slug: 'countdown-timer',
    labels: { singular: 'Countdown Timer', plural: 'Countdown Timers' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'banner',
            options: [
                { label: 'Banner', value: 'banner' },
                { label: 'Card', value: 'card' },
                { label: 'Minimal', value: 'minimal' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'targetDate', type: 'date', required: true },
        { name: 'expiredMessage', type: 'text' },
        { name: 'showDays', type: 'checkbox', defaultValue: true },
        { name: 'showHours', type: 'checkbox', defaultValue: true },
        { name: 'showMinutes', type: 'checkbox', defaultValue: true },
        { name: 'showSeconds', type: 'checkbox', defaultValue: true },
    ],
}

const SocialProofBlock = {
    slug: 'social-proof',
    labels: { singular: 'Social Proof', plural: 'Social Proofs' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'cards',
            options: [
                { label: 'Cards', value: 'cards' },
                { label: 'Minimal', value: 'minimal' },
                { label: 'Grid', value: 'grid' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'reviews', type: 'array',
            fields: [
                { name: 'author', type: 'text', required: true },
                { name: 'role', type: 'text' },
                { name: 'content', type: 'textarea', required: true },
                { name: 'rating', type: 'number', min: 1, max: 5, defaultValue: 5 },
                { name: 'avatar', type: 'upload', relationTo: 'media' },
            ],
        },
    ],
}

const BreadcrumbBlock = {
    slug: 'breadcrumb',
    labels: { singular: 'Breadcrumb', plural: 'Breadcrumbs' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'simple',
            options: [
                { label: 'Simple', value: 'simple' },
                { label: 'With Icon', value: 'with-icon' },
            ],
        },
        {
            name: 'items', type: 'array',
            fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'url', type: 'text' },
            ],
        },
    ],
}

const ClientLogosBlock = {
    slug: 'client-logos',
    labels: { singular: 'Client Logos', plural: 'Client Logos' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'scroll',
            options: [
                { label: 'Scroll', value: 'scroll' },
                { label: 'Grid', value: 'grid' },
                { label: 'Fade', value: 'fade' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'logos', type: 'array',
            fields: [
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'alt', type: 'text' },
                { name: 'linkUrl', type: 'text' },
            ],
        },
    ],
}

const MenuFoodBlock = {
    slug: 'menu-food',
    labels: { singular: 'Food Menu', plural: 'Food Menus' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'classic',
            options: [
                { label: 'Classic', value: 'classic' },
                { label: 'Cards', value: 'cards' },
                { label: 'Minimal', value: 'minimal' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'categories', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                {
                    name: 'items', type: 'array',
                    fields: [
                        { name: 'name', type: 'text', required: true },
                        { name: 'description', type: 'textarea' },
                        { name: 'price', type: 'text', required: true },
                        { name: 'currency', type: 'text', defaultValue: 'RM' },
                        { name: 'tag', type: 'text' },
                        { name: 'image', type: 'upload', relationTo: 'media' },
                    ],
                },
            ],
        },
    ],
}

const PortfolioGridBlock = {
    slug: 'portfolio-grid',
    labels: { singular: 'Portfolio Grid', plural: 'Portfolio Grids' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'Masonry', value: 'masonry' },
                { label: 'Showcase', value: 'showcase' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'projects', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'category', type: 'text' },
                { name: 'linkUrl', type: 'text' },
            ],
        },
    ],
}

// ── Industry-specific blocks (composer-driven, aiVisible=false) ─────────────
// These 6 blocks were authored as React components but never registered in
// Payload, so sanitizeBlocksForPayload was dropping them. Registering here
// unblocks 5 WEAK categories (health, realestate, fitness, education, tech)
// whose signature blocks were going to /dev/null.
// Plan: plans/260417-0837-all-cate-full-and-strong/phase-01-hot-fixes.md (1.1)

const DoctorProfileBlock = {
    slug: 'doctor-profile',
    labels: { singular: 'Doctor Profile', plural: 'Doctor Profiles' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'cards',
            options: [
                { label: 'Cards', value: 'cards' },
                { label: 'Detailed', value: 'detailed' },
                { label: 'List', value: 'list' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        {
            name: 'doctors', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'specialisation', type: 'text' },
                { name: 'qualifications', type: 'json' },
                { name: 'photoUrl', type: 'text' },
                { name: 'availableDays', type: 'json' },
                { name: 'languages', type: 'text' },
                { name: 'consultationFee', type: 'text' },
                { name: 'bio', type: 'textarea' },
            ],
        },
    ],
}

const PropertyCardBlock = {
    slug: 'property-card',
    labels: { singular: 'Property Card', plural: 'Property Cards' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
                { label: 'Featured', value: 'featured' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'showMap', type: 'checkbox', defaultValue: false },
        { name: 'currency', type: 'text', defaultValue: 'RM' },
        {
            name: 'properties', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'price', type: 'number' },
                { name: 'location', type: 'text' },
                { name: 'bedrooms', type: 'number' },
                { name: 'bathrooms', type: 'number' },
                { name: 'area', type: 'number' },
                { name: 'imageUrls', type: 'json' },
                {
                    name: 'type', type: 'select', defaultValue: 'sale',
                    options: [
                        { label: 'For Sale', value: 'sale' },
                        { label: 'For Rent', value: 'rent' },
                    ],
                },
                { name: 'status', type: 'text' },
                { name: 'mapUrl', type: 'text' },
                { name: 'description', type: 'textarea' },
            ],
        },
    ],
}

const ClassScheduleBlock = {
    slug: 'class-schedule',
    labels: { singular: 'Class Schedule', plural: 'Class Schedules' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
                { label: 'Cards', value: 'cards' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'showCapacity', type: 'checkbox', defaultValue: true },
        { name: 'highlightToday', type: 'checkbox', defaultValue: true },
        {
            name: 'classes', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'instructor', type: 'text' },
                { name: 'day', type: 'number', min: 0, max: 6 },
                { name: 'startTime', type: 'text' },
                { name: 'endTime', type: 'text' },
                { name: 'capacity', type: 'number' },
                { name: 'enrolled', type: 'number' },
                { name: 'category', type: 'text' },
                { name: 'level', type: 'text' },
            ],
        },
    ],
}

const VideoShowcaseBlock = {
    slug: 'video-showcase',
    labels: { singular: 'Video Showcase', plural: 'Video Showcases' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'Featured', value: 'featured' },
                { label: 'Full-width', value: 'fullwidth' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'showCategories', type: 'checkbox', defaultValue: true },
        { name: 'autoplay', type: 'checkbox', defaultValue: false },
        {
            name: 'videos', type: 'array',
            fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'thumbnailUrl', type: 'text' },
                { name: 'videoUrl', type: 'text', required: true },
                { name: 'category', type: 'text' },
                { name: 'duration', type: 'text' },
                { name: 'description', type: 'textarea' },
            ],
        },
    ],
}

const ProductQuickViewBlock = {
    slug: 'product-quick-view',
    labels: { singular: 'Product Quick View', plural: 'Product Quick Views' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'grid',
            options: [
                { label: 'Grid', value: 'grid' },
                { label: 'Carousel', value: 'carousel' },
                { label: 'Minimal', value: 'minimal' },
            ],
        },
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'columns', type: 'number', defaultValue: 4 },
        { name: 'showQuickView', type: 'checkbox', defaultValue: true },
        { name: 'currency', type: 'text', defaultValue: 'RM' },
        {
            name: 'products', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'price', type: 'number' },
                { name: 'originalPrice', type: 'number' },
                { name: 'imageUrls', type: 'json' },
                { name: 'description', type: 'textarea' },
                { name: 'variants', type: 'json' },
                { name: 'badge', type: 'text' },
                { name: 'ctaLabel', type: 'text' },
                { name: 'ctaUrl', type: 'text' },
            ],
        },
    ],
}

const FeatureComparisonBlock = {
    slug: 'feature-comparison',
    labels: { singular: 'Feature Comparison', plural: 'Feature Comparisons' },
    fields: [
        {
            name: 'variant', type: 'select', defaultValue: 'table',
            options: [
                { label: 'Table', value: 'table' },
                { label: 'Cards', value: 'cards' },
            ],
        },
        { name: 'headline', type: 'text' },
        {
            name: 'products', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'highlighted', type: 'checkbox', defaultValue: false },
            ],
        },
        {
            name: 'features', type: 'array',
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'values', type: 'json' },
            ],
        },
    ],
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
                // Core blocks
                NavigationBlock,
                HeroBlock,
                AboutBlock,
                FeaturesBlock,
                TestimonialsBlock,
                ContactBlock,
                GalleryBlock,
                FooterBlock,
                StatsBlock,
                PricingBlock,
                FAQBlock,
                TeamBlock,
                SocialWidgetBlock,
                CartWidgetBlock,
                // AI-generated blocks
                CTABlock,
                NewsletterBlock,
                VideoBlock,
                LogoCloudBlock,
                BlogListBlock,
                ProductsGridBlock,
                ProductsFeaturedBlock,
                CustomHtmlBlock,
                ServiceCardsBlock,
                CarouselBlock,
                StepProcessBlock,
                DividerBlock,
                AnnouncementBarBlock,
                WhatsappButtonBlock,
                GoogleMapsBlock,
                AccordionBlock,
                CountdownTimerBlock,
                SocialProofBlock,
                BreadcrumbBlock,
                ClientLogosBlock,
                MenuFoodBlock,
                PortfolioGridBlock,
                // Industry-specific (composer-driven, aiVisible=false in block meta)
                DoctorProfileBlock,
                PropertyCardBlock,
                ClassScheduleBlock,
                VideoShowcaseBlock,
                ProductQuickViewBlock,
                FeatureComparisonBlock,
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
        {
            name: 'isVisible',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Show this page on live site and in navigation.',
            },
        },
        {
            name: 'deletedAt',
            type: 'date',
            admin: {
                position: 'sidebar',
                description: 'Soft delete timestamp. If set, the page is considered deleted.',
            },
        },
    ],
    timestamps: true,
}
