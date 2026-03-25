import type { CollectionConfig } from 'payload'

export const Tenants: CollectionConfig = {
    slug: 'tenants',
    admin: {
        useAsTitle: 'name',
        description: 'Each tenant is a customer who has a subscription and owns one or more websites.',
    },
    access: {
        read: ({ req }) => {
            if (req.user?.roles?.includes('super-admin')) return true
            return {
                id: {
                    in: req.user?.tenants?.map((t: any) =>
                        t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
                    ).filter(Boolean) ?? [],
                },
            }
        },
        // Any authenticated user can create their own tenant (registration flow)
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => {
            if (req.user?.roles?.includes('super-admin')) return true
            // Tenant owners can update their own tenant
            return {
                id: {
                    in: req.user?.tenants?.map((t: any) =>
                        t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
                    ) ?? [],
                },
            }
        },
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Business / organization name',
            },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'Unique slug used for subdomain (e.g. "mybakery" → mybakery.primeweb.app)',
            },
        },
        {
            name: 'customDomain',
            type: 'text',
            unique: true,
            admin: {
                description: 'Custom domain (e.g. www.mybakery.com). Leave blank to use subdomain.',
            },
        },
        {
            name: 'plan',
            type: 'select',
            required: true,
            defaultValue: 'free',
            options: [
                { label: 'Free', value: 'free' },
                { label: 'Starter', value: 'starter' },
                { label: 'Pro', value: 'pro' },
                { label: 'Business', value: 'business' },
            ],
        },
        // ── SSO Integration Fields ──
        {
            name: 'customerId',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                description: 'Customer ID Number synced from SSO (customer_id_number)',
            },
        },
        {
            name: 'serviceId',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                description: 'Service ID from SSO. Must not be "NA" or empty.',
            },
        },
        {
            name: 'packCode',
            type: 'text',
            admin: {
                description: 'Pack code from SSO payload (e.g. STARTER, PRO)',
            },
        },
        {
            name: 'orderId',
            type: 'text',
            admin: {
                description: 'Unifi Order ID from SSO (unifi_order_id)',
            },
        },
        {
            name: 'address',
            type: 'json',
            admin: {
                description: 'Structured address data from SSO payload',
            },
        },
        {
            name: 'metaData',
            type: 'json',
            admin: {
                description: 'Full raw SSO payload stored for future analytics',
            },
        },
        // ────────────────────────────
        {
            name: 'stripeCustomerId',
            type: 'text',
            admin: { readOnly: true },
        },
        {
            name: 'stripeSubscriptionId',
            type: 'text',
            admin: { readOnly: true },
        },
        {
            name: 'stripeAccountId',
            type: 'text',
            index: true,
            admin: {
                readOnly: true,
                description: 'Stripe Connected Account ID (acct_xxx) for Direct Charges',
            },
        },
        {
            name: 'stripeOnboardingComplete',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                readOnly: true,
                description: 'Whether the merchant has completed Stripe Connect onboarding',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Trialing', value: 'trialing' },
                { label: 'Past Due', value: 'past_due' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Suspended', value: 'suspended' },
            ],
        },
        {
            name: 'settings',
            type: 'group',
            fields: [
                {
                    name: 'allowedWebsites',
                    type: 'number',
                    defaultValue: 1,
                    admin: { description: 'Max number of websites this tenant can create' },
                },
                {
                    name: 'storageUsed',
                    type: 'number',
                    defaultValue: 0,
                    admin: { description: 'Storage used in bytes', readOnly: true },
                },
                {
                    name: 'storageLimitBytes',
                    type: 'number',
                    defaultValue: 524288000, // 500MB
                },
                {
                    name: 'dashboardPreferences',
                    type: 'json',
                    admin: { description: 'User widget layout configuration for Dashboard' },
                },
            ],
        },
        {
            name: 'onboardingCompleted',
            type: 'checkbox',
            defaultValue: false,
        },
        {
            name: 'aiGenerationsCount',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Number of times this tenant has used the AI Site Builder',
                readOnly: true,
            },
        },
        {
            name: 'whatsappNumber',
            type: 'text',
            admin: {
                description: 'WhatsApp number with country code, e.g. 60123456789',
            },
        },
        {
            name: 'ssmNumber',
            type: 'text',
            admin: {
                description: 'SSM Registration Number (Suruhanjaya Syarikat Malaysia)',
            },
        },
        {
            name: 'businessAddress',
            type: 'textarea',
            admin: {
                description: 'Physical business address for trust signals',
            },
        },
        {
            name: 'echIntegration',
            type: 'group',
            label: 'Centralised Distribution Integration',
            admin: {
                description: 'Connect to ECH Centralised Distribution for inventory/order sync',
            },
            fields: [
                {
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: false,
                },
                {
                    name: 'apiKey',
                    type: 'text',
                    admin: { description: 'ECH API key for this tenant' },
                },
                {
                    name: 'merchantId',
                    type: 'text',
                },
            ],
        },
    ],
    timestamps: true,
}
