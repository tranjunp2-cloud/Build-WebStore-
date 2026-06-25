import type { CollectionConfig } from 'payload'
import { revalidateSiteAfterChange, revalidateSiteAfterDelete } from '../lib/cache/revalidate-storefront'

export const Sites: CollectionConfig = {
    slug: 'sites',
    admin: {
        useAsTitle: 'name',
        description: 'Each tenant can have one or more websites.',
    },
    hooks: {
        // Bust the storefront data cache on any site write (admin edits included).
        afterChange: [revalidateSiteAfterChange],
        afterDelete: [revalidateSiteAfterDelete],
    },
    access: {
        // Authenticated users can create sites
        create: ({ req }) => Boolean(req.user),
        // Users can only read their own tenant's sites
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        // Users can update their own tenant's sites
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        // Users can delete their own tenant's sites
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
            name: 'generationStatus',
            type: 'select',
            defaultValue: 'none',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Tracks AI site generation state (system-managed)',
            },
            options: [
                { label: 'None', value: 'none' },
                { label: 'Generating', value: 'generating' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
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
            // F26: Locale the AI generated flat blocks in — immutable after generation.
            // Differs from `locale` which the user can change. Used by editor to determine
            // which language flat blocks are stored in (siteLocale in editorStore).
            // Text field (not select) to support any ISO 639-1 code e.g. 'el', 'th', 'zh'.
            name: 'generationLocale',
            type: 'text',
            defaultValue: 'ms',
            admin: { description: 'Locale AI used to generate flat blocks — do not change' },
        },
        {
            // F26-01: Flag set by AI generate; cleared once user confirms/dismisses dialog
            name: 'pendingLocaleConfirm',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Show language confirm dialog when user opens editor after AI generation' },
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
                {
                    name: 'accentColor',
                    type: 'text',
                },
                {
                    name: 'surfaceColor',
                    type: 'text',
                },
                {
                    name: 'textColor',
                    type: 'text',
                },
                {
                    name: 'mutedColor',
                    type: 'text',
                },
                {
                    name: 'spacingPreset',
                    type: 'select',
                    defaultValue: 'default',
                    options: [
                        { label: 'Compact', value: 'compact' },
                        { label: 'Default', value: 'default' },
                        { label: 'Relaxed', value: 'relaxed' },
                    ],
                },
                {
                    name: 'shadowPreset',
                    type: 'select',
                    defaultValue: 'subtle',
                    options: [
                        { label: 'None', value: 'none' },
                        { label: 'Subtle', value: 'subtle' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'Dramatic', value: 'dramatic' },
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
                    name: 'autoMetaEnabled',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Automatically generate SEO meta tags when publishing pages/products' },
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
            name: 'branding',
            type: 'group',
            fields: [
                { name: 'logo', type: 'text' },
                { name: 'favicon', type: 'text' },
            ],
        },
        {
            name: 'contactInfo',
            type: 'group',
            fields: [
                { name: 'phone', type: 'text' },
                { name: 'email', type: 'text' },
                { name: 'address', type: 'textarea' },
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
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Enable shipping calculation. If off, shipping fee = 0' },
                },
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
                {
                    name: 'shippingSetupConfirmed',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Set true when user explicitly saves shipping settings' },
                },
            ],
        },
        {
            name: 'paymentConfig',
            type: 'group',
            label: 'Payment Configuration',
            fields: [
                {
                    name: 'merchantQrCode',
                    type: 'upload',
                    relationTo: 'media',
                    label: 'Merchant QR Code',
                    admin: { description: 'QR code image for QR Banking payments. Shown to customer at checkout.' },
                },
                {
                    name: 'enableCod',
                    type: 'checkbox',
                    label: 'Enable Cash on Delivery',
                    defaultValue: true,
                },
                {
                    name: 'enableQrBanking',
                    type: 'checkbox',
                    label: 'Enable QR Banking',
                    defaultValue: true,
                },
                {
                    name: 'bankName',
                    type: 'text',
                    label: 'Bank Name',
                    admin: { description: 'e.g. Maybank, CIMB, Public Bank' },
                },
                {
                    name: 'bankAccountNo',
                    type: 'text',
                    label: 'Account Number',
                },
                {
                    name: 'bankAccountHolder',
                    type: 'text',
                    label: 'Account Holder Name',
                },
                {
                    name: 'cardEnabled',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Allow Credit/Debit Card via Stripe (layer-2 guard)' },
                },
                {
                    name: 'fpxEnabled',
                    type: 'checkbox',
                    defaultValue: true,
                    admin: { description: 'Allow FPX (Online Banking) via Stripe — Malaysia only (layer-2 guard)' },
                },
            ],
        },
        {
            name: 'themeCustomized',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'True once user has explicitly saved a theme change from editor' },
        },
        {
            name: 'headerBlock',
            type: 'json',
            admin: { description: 'Global header/navigation block — published/live version' },
        },
        {
            name: 'pendingHeaderBlock',
            type: 'json',
            admin: { description: 'Draft header block — promoted to headerBlock on publish. null = no pending changes.' },
        },
        {
            name: 'footerBlock',
            type: 'json',
            admin: { description: 'Global footer block — published/live version' },
        },
        {
            name: 'pendingFooterBlock',
            type: 'json',
            admin: { description: 'Draft footer block — promoted to footerBlock on publish. null = no pending changes.' },
        },
        {
            name: 'globalBlocks',
            type: 'json',
            admin: { description: 'Global floating widgets (cart, whatsapp, social) — published/live version' },
        },
        {
            name: 'pendingGlobalBlocks',
            type: 'json',
            admin: { description: 'Draft global floating widgets — copied to globalBlocks on publish. null = no pending changes.' },
        },
    ],
    timestamps: true,
}
