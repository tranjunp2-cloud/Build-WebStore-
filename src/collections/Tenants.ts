import type { CollectionConfig, FieldAccess } from 'payload'
import { isReservedSlug, validateSlugFormat } from '@/lib/utils/reserved-slugs'
import { revalidateTenantAfterChange, revalidateTenantAfterDelete } from '@/lib/cache/revalidate-storefront'
import { isMerchantAccessSession } from '@/lib/support/merchant-access-session'
import { canReadPayoutAccount } from '@/lib/payment/payout-account-access'

type PaymentQrHookArgs = {
    value?: boolean
    siblingData: Record<string, unknown>
    previousSiblingDoc?: Record<string, unknown>
}

type PaymentQrImageHookArgs = {
    value?: unknown
    siblingData: Record<string, unknown>
}

export function requireQrImageWhenEnabled({ value, siblingData, previousSiblingDoc }: PaymentQrHookArgs) {
    if (value !== true) return value
    const effectiveImage = siblingData.qr_image !== undefined
        ? siblingData.qr_image
        : previousSiblingDoc?.qr_image
    return effectiveImage ? value : false
}

export function disableQrWhenImageRemoved({ value, siblingData }: PaymentQrImageHookArgs) {
    // An omitted field is `undefined` in a partial Payload update. Only an explicit null removes it.
    if (value === null) siblingData.payment_qr = false
    return value
}

const isSuperAdmin = (user: unknown): boolean =>
    Array.isArray((user as { roles?: unknown } | null)?.roles) && ((user as { roles: unknown[] }).roles).includes('super-admin')

const superAdminField: FieldAccess = ({ req }) => isSuperAdmin(req.user)

/**
 * Platform-managed fields (plan, billing / SSO ids, Stripe / Xendit account state, domains, quotas): no request but a
 * super-admin's may write them (TC-PERF-155). Settings actions, webhooks, the Stripe / Xendit sync and the domain
 * verify job write them through the Local API (overrideAccess), which field access does not apply to.
 */
const PLATFORM_FIELD_ACCESS = { create: superAdminField, update: superAdminField }

/** Raw SSO payload (owner name, email, phone): platform team only (TC-PERF-151). */
export const superAdminReadOnly: FieldAccess = ({ req }) => isSuperAdmin(req.user)

/** Payout bank account (bank, holder, full number): owners / admins and super-admins (TC-PERF-151). */
export const ownerOrAdminRead: FieldAccess = ({ req, doc, id }) =>
    canReadPayoutAccount(req.user, (doc as { id?: unknown } | undefined)?.id ?? id)

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
        // Bust the storefront tenant-identity cache on slug/customDomain edits
        // made directly in the Payload admin (dashboard domain action handles its
        // own path revalidation).
        afterChange: [revalidateTenantAfterChange],
        afterDelete: [revalidateTenantAfterDelete],
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
            // Payout fields must not be writable by bypassing the guarded dashboard actions via REST.
            if (isMerchantAccessSession(req)) return false
            if (req.user?.roles?.includes('super-admin')) return true
            // Active owners and admins only: a viewer or pending member must not change the plan, status or payout
            // accounts over REST. Dashboard settings write through the Local API after their own role checks.
            return {
                id: {
                    in: req.user?.tenants
                        ?.filter((t: any) => (t.role === 'owner' || t.role === 'admin') && (t.status ?? 'active') === 'active')
                        .map((t: any) => (t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant))
                        .filter(Boolean) ?? [],
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
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
            unique: true,
            index: true,
            admin: {
                description: 'Customer ID Number synced from SSO (customer_id_number)',
            },
        },
        {
            name: 'serviceId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            unique: true,
            index: true,
            admin: {
                description: 'Service ID from SSO. Must not be "NA" or empty.',
            },
        },
        {
            name: 'packCode',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            admin: {
                description: 'Pack code from SSO payload (e.g. STARTER, PRO)',
            },
        },
        {
            name: 'orderId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            admin: {
                description: 'Unifi Order ID from SSO (unifi_order_id)',
            },
        },
        {
            name: 'address',
            type: 'json',
            access: PLATFORM_FIELD_ACCESS,
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
            // Holds the SSO payload and the pw1 store link the migration keys on, and `platformOrgId` picks the AI
            // platform org the workspace's tokens carry (lib/auth/bridge-token.ts; the copilot reads it server-side,
            // lib/ai-platform/context.ts), so a member must never write it, nor read the owner's contact details.
            // SSO provision and the pw1 migration use the Local API.
            access: {
                read: superAdminReadOnly,
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
            },
        },
        // ────────────────────────────
        {
            name: 'stripeCustomerId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            admin: { readOnly: true },
        },
        {
            name: 'stripeSubscriptionId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            admin: { readOnly: true },
        },
        {
            name: 'stripeAccountId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            index: true,
            admin: {
                readOnly: true,
                description: 'Stripe Connected Account ID (acct_xxx) for Direct Charges',
            },
        },
        {
            name: 'stripeOnboardingComplete',
            type: 'checkbox',
            access: PLATFORM_FIELD_ACCESS,
            defaultValue: false,
            admin: {
                readOnly: true,
                description: 'Whether the merchant has completed Stripe Connect onboarding',
            },
        },
        {
            name: 'xenditAccountId',
            type: 'text',
            access: PLATFORM_FIELD_ACCESS,
            index: true,
            admin: {
                readOnly: true,
                description: 'Xendit MANAGED sub-account ID returned by POST /v2/accounts',
            },
        },
        {
            name: 'xenditAccountStatus',
            type: 'select',
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
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
            access: PLATFORM_FIELD_ACCESS,
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
                    access: PLATFORM_FIELD_ACCESS,
                    defaultValue: 1,
                    admin: { description: 'Max number of websites this tenant can create' },
                },
                {
                    name: 'storageUsed',
                    type: 'number',
                    access: PLATFORM_FIELD_ACCESS,
                    defaultValue: 0,
                    admin: { description: 'Storage used in bytes', readOnly: true },
                },
                {
                    name: 'storageLimitBytes',
                    type: 'number',
                    access: PLATFORM_FIELD_ACCESS,
                    defaultValue: 524288000, // 500MB
                },
                {
                    name: 'dashboardPreferences',
                    type: 'json',
                    admin: { description: 'User widget layout configuration for Dashboard' },
                },
                {
                    name: 'automations',
                    type: 'json',
                    admin: {
                        description:
                            'Scheduled copilot reminders: { enabled: {<automation>: boolean}, lastRunDay }. No settings screen (#2176): missing switches use the defaults (all on); lastRunDay is written by /api/cron/shop-automations. Old digest keys are ignored (no digest email).',
                    },
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
                    defaultValue: true,
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
                            requireQrImageWhenEnabled,
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
                            disableQrWhenImageRemoved,
                        ],
                    },
                },
                {
                    name: 'bank_name',
                    type: 'text',
                    access: { read: ownerOrAdminRead },
                    label: 'Bank Name',
                    admin: {
                        description: 'Shown to buyers as fallback if QR fails (e.g. Maybank Berhad)',
                    },
                },
                {
                    name: 'account_holder_name',
                    type: 'text',
                    access: { read: ownerOrAdminRead },
                    label: 'Account Holder Name',
                    admin: {
                        description: 'Must match exactly the name on the bank account (shown to buyers for transfer reference)',
                    },
                },
                {
                    name: 'account_number',
                    type: 'text',
                    access: { read: ownerOrAdminRead },
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
            access: PLATFORM_FIELD_ACCESS,
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
                    access: { read: () => false },
                    admin: { description: 'ECH API key for this tenant — never exposed to client' },
                },
                {
                    name: 'merchantId',
                    type: 'text',
                },
            ],
        },
        {
            name: 'easyParcelIntegration',
            type: 'group',
            label: 'EasyParcel Integration',
            admin: {
                description: 'Connect tenant own EasyParcel account for shipping rates and label purchase',
            },
            fields: [
                {
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: false,
                    admin: { description: 'Master toggle — enable EasyParcel for this tenant' },
                },
                {
                    name: 'accessToken',
                    type: 'text',
                    access: { read: () => false },
                    admin: { description: 'EP OAuth access token — never exposed to client' },
                },
                {
                    name: 'refreshToken',
                    type: 'text',
                    access: { read: () => false },
                    admin: { description: 'EP OAuth refresh token — never exposed to client' },
                },
                {
                    name: 'tokenExpiresAt',
                    type: 'date',
                    access: { read: () => false },
                    admin: { readOnly: true, description: 'When the EP access token expires' },
                },
                {
                    name: 'tokenRefreshExpiresAt',
                    type: 'date',
                    access: { read: () => false },
                    admin: { readOnly: true, description: 'When the EP refresh token expires' },
                },
                {
                    name: 'warehouse',
                    type: 'json',
                    admin: {
                        description: 'Legacy single pickup warehouse (kept for back-compat). New configs use `warehouses`.',
                    },
                },
                {
                    name: 'warehouses',
                    type: 'json',
                    admin: {
                        description: 'Pickup addresses: [{id, label, phone, address1, address2, city, state, postcode, country, isDefault}]',
                    },
                },
                {
                    // DEPRECATED — unused since courier selection became fully automatic (2026-07-01).
                    // Column kept to avoid a migration; do NOT read or write from application code.
                    name: 'selectedCourier',
                    type: 'text',
                    defaultValue: 'flash',
                    admin: { description: '[DEPRECATED] Single courier ID — superseded by automatic cheapest-courier selection. Do not use.' },
                },
                {
                    // DEPRECATED — unused since courier selection became fully automatic (2026-07-01).
                    // Column kept to avoid a migration; do NOT read or write from application code.
                    name: 'selectedCouriers',
                    type: 'json',
                    admin: {
                        description:
                            '[DEPRECATED] Courier allowlist — superseded by automatic cheapest-courier selection. Do not use.',
                    },
                },
                {
                    name: 'testedAt',
                    type: 'date',
                    admin: { readOnly: true, description: 'Timestamp of last successful EP connection test' },
                },
                {
                    name: 'accountName',
                    type: 'text',
                    admin: { readOnly: true, description: 'Connected EP account name (from account info)' },
                },
                {
                    name: 'accountEmail',
                    type: 'text',
                    admin: { readOnly: true, description: 'Connected EP sender/pickup email (from account info)' },
                },
            ],
        },
    ],
    timestamps: true,
}
