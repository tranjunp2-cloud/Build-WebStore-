import type { CollectionConfig } from 'payload'
import { isReservedSlug, validateSlugFormat } from '@/lib/utils/reserved-slugs'

export const Tenants: CollectionConfig = {
    slug: 'tenants',
    admin: {
        useAsTitle: 'name',
        description: 'Each tenant is a customer who has a subscription and owns one or more websites.',
    },
    hooks: {
        beforeChange: [
            ({ data, operation }) => {
                // F23: Validate slug format on create and update
                if (data?.slug) {
                    const slug = (data.slug as string).toLowerCase().trim()
                    data.slug = slug

                    const formatError = validateSlugFormat(slug)
                    if (formatError) {
                        throw new Error(`Invalid slug: ${formatError}`)
                    }

                    if (isReservedSlug(slug)) {
                        throw new Error(`Invalid slug: "${slug}" is a reserved subdomain`)
                    }
                }
                return data
            },
        ],
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
            name: 'previousSlugs',
            type: 'array',
            admin: {
                description: 'Previous slugs for 301 redirect (30-day grace period)',
                readOnly: true,
            },
            fields: [
                { name: 'slug', type: 'text', required: true },
                { name: 'expiresAt', type: 'date', required: true },
            ],
        },
        {
            name: 'customDomains',
            type: 'array',
            admin: {
                description: 'List of custom domains attached to this store',
            },
            fields: [
                { name: 'domain', type: 'text', required: true, index: true },
                { name: 'status', type: 'select', defaultValue: 'pending', options: [{ label: 'Pending', value: 'pending' }, { label: 'Active', value: 'active' }] },
                { name: 'isPrimary', type: 'checkbox', defaultValue: false },
                {
                    name: 'vercelDomainId',
                    type: 'text',
                    admin: {
                        description: 'Vercel project-domain handle. Auto-managed.',
                        readOnly: true,
                    },
                },
                {
                    name: 'vercelVerification',
                    type: 'json',
                    admin: {
                        description: 'Outstanding TXT challenges from Vercel verify. Auto-managed.',
                        readOnly: true,
                    },
                },
            ],
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
            name: 'xenditAccountId',
            type: 'text',
            index: true,
            admin: {
                readOnly: true,
                description: 'Xendit MANAGED sub-account ID returned by POST /v2/accounts',
            },
        },
        {
            name: 'xenditAccountStatus',
            type: 'select',
            defaultValue: 'NOT_CONNECTED',
            options: [
                { label: 'Not Connected', value: 'NOT_CONNECTED' },
                { label: 'Invited', value: 'INVITED' },
                { label: 'Registered', value: 'REGISTERED' },
                { label: 'Awaiting Documents', value: 'AWAITING_DOCS' },
                { label: 'Pending Verification', value: 'PENDING_VERIFICATION' },
                { label: 'Live', value: 'LIVE' },
                { label: 'Suspended', value: 'SUSPENDED' },
            ],
            admin: {
                readOnly: true,
                description: 'Xendit onboarding lifecycle status. Updated by /api/webhooks/xendit.',
            },
        },
        {
            name: 'xenditOnboardingComplete',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                readOnly: true,
                description: 'True once Xendit account.activated webhook fires (status=LIVE).',
            },
        },
        // Model C: merchant provides their own Xendit keys (self-register flow)
        {
            name: 'xenditSecretKey',
            type: 'text',
            access: { read: () => false },
            admin: {
                description: 'Xendit Secret Key (xnd_development_... or xnd_production_...). Merchant provides via Settings > Payments.',
            },
        },
        {
            name: 'xenditCallbackToken',
            type: 'text',
            access: { read: () => false },
            admin: {
                description: 'Xendit Callback Token for webhook signature verification. Merchant copies from Xendit Dashboard > Settings > Configuration.',
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
            name: 'migrationStatus',
            type: 'select',
            defaultValue: 'migrated',
            options: [
                { label: 'Migrated', value: 'migrated' },
                { label: 'Pending', value: 'pending' },
                { label: 'Failed', value: 'failed' },
            ],
            admin: { description: 'Migration status from legacy SSO system' },
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
            name: 'payments',
            type: 'group',
            fields: [
                {
                    name: 'payment_card',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Credit / Debit Card (via Stripe)',
                    admin: {
                        description:
                            'Master toggle: accept Card via Stripe Checkout across all sites. Requires Stripe Connect onboarding complete. Each site can override via its paymentConfig.cardEnabled (layer-2 guard).',
                    },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                // Block enabling if Stripe onboarding not complete (defense-in-depth)
                                if (value && originalDoc?.stripeOnboardingComplete !== true) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'payment_fpx',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'FPX Online Banking (via Stripe)',
                    admin: {
                        description:
                            'Master toggle: accept FPX Online Banking (Malaysia) across all sites. Requires Stripe Connect onboarding complete. Each site can override via its paymentConfig.fpxEnabled (layer-2 guard).',
                    },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && originalDoc?.stripeOnboardingComplete !== true) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_tng',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Touch \'n Go (TNG) via Xendit',
                    admin: { description: 'Nhận thanh toán TNG e-wallet qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_grabpay',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'GrabPay via Xendit',
                    admin: { description: 'Nhận thanh toán GrabPay qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_duitnow',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'DuitNow QR via Xendit',
                    admin: { description: 'Nhận thanh toán DuitNow QR qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_fpx',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'FPX (via Xendit)',
                    admin: { description: 'Online banking Malaysia qua Xendit (khác Stripe FPX). Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_shopeepay',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'ShopeePay via Xendit',
                    admin: { description: 'Nhận thanh toán ShopeePay qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_boost',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Boost via Xendit',
                    admin: { description: 'Nhận thanh toán Boost e-wallet qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'xendit_mae',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'MAE by Maybank via Xendit',
                    admin: { description: 'Nhận thanh toán MAE (Maybank) qua Xendit. Yêu cầu Xendit onboarding hoàn tất.' },
                    hooks: {
                        beforeChange: [
                            ({ value, originalDoc }) => {
                                if (value && !originalDoc?.xenditSecretKey) return false
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'payment_cod',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Cash on Delivery (COD)',
                    admin: { description: 'Enable Cash on Delivery' },
                },
                {
                    name: 'payment_qr',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Bank Transfer / QR Banking',
                    admin: { description: 'Enable QR Banking / Bank Transfer' },
                    hooks: {
                        beforeChange: [
                            ({ siblingData, value }) => {
                                // Enforce rule: cannot enable QR without an image
                                if (value && !siblingData.qr_image) {
                                    return false
                                }
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'qr_image',
                    type: 'upload',
                    relationTo: 'media',
                    label: 'QR Code Image',
                    admin: {
                        description: 'Upload QR Code image (Max 2MB, JPG/PNG)',
                    },
                    hooks: {
                        beforeChange: [
                            ({ value, siblingData }) => {
                                // If image is removed, disable the qr toggle
                                if (!value) {
                                    siblingData.payment_qr = false
                                }
                                return value
                            },
                        ],
                    },
                },
                {
                    name: 'bank_name',
                    type: 'text',
                    label: 'Bank Name',
                    admin: {
                        description: 'Shown to buyers as fallback if QR fails (e.g. Maybank Berhad)',
                    },
                },
                {
                    name: 'account_holder_name',
                    type: 'text',
                    label: 'Account Holder Name',
                    admin: {
                        description: 'Must match exactly the name on the bank account (shown to buyers for transfer reference)',
                    },
                },
                {
                    name: 'account_number',
                    type: 'text',
                    label: 'Account Number',
                    admin: {
                        description: 'Masked at checkout — only last 4 digits shown to buyers',
                    },
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
