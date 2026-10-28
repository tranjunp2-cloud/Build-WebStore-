import type { CollectionConfig } from 'payload'
import { EMAIL_TEMPLATE_TYPES } from '../lib/email/types'
import type { invalidateTemplateConfigCache as InvalidateTemplateConfigCache } from '../lib/email/get-template-config'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// Loaded on use: it imports the Payload config, which imports this collection (a static import is a cycle that breaks production builds).
const invalidateTemplateConfigCache: typeof InvalidateTemplateConfigCache = async (...args) =>
    (await import('../lib/email/get-template-config')).invalidateTemplateConfigCache(...args)

// Security-critical templates — disabling via any API path is rejected at collection level
const CRITICAL_TYPES = ['otp-verification', 'forgot-password', 'password-changed'] as const

export const EmailTemplateSettings: CollectionConfig = {
    slug: 'email-template-settings',
    admin: {
        useAsTitle: 'templateType',
        defaultColumns: ['templateType', 'recipient', 'enabled', 'updatedAt'],
        description: 'Per-tenant email template content overrides (subject, greeting, CTA, closing).',
    },
    access: {
        create: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                if (!(await canUse(req.payload, sub.plan as PlanCode, 'email_template_configuration'))) return false
            } catch { return false }
            return { tenant: { in: tenantIds } }
        },
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                if (!(await canUse(req.payload, sub.plan as PlanCode, 'email_template_configuration'))) return false
            } catch { return false }
            return { tenant: { in: tenantIds } }
        },
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
    hooks: {
        beforeChange: [
            ({ data }) => {
                // Security check first (index 0) — must never be skipped by a prior hook failure
                const isCritical = CRITICAL_TYPES.includes(data.templateType as typeof CRITICAL_TYPES[number])
                if (isCritical && !data.enabled) {
                    throw new Error(
                        `Cannot disable security-critical template "${data.templateType}". This template is required for account security flows.`
                    )
                }
                return data
            },
            ({ data, req }) => {
                if (req.user?.id) {
                    data.updatedBy = req.user.id
                }
                return data
            },
        ],
        afterChange: [
            async ({ doc }) => {
                const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
                if (tenantId && doc.templateType && doc.recipient) {
                    await invalidateTemplateConfigCache(tenantId, doc.templateType, doc.recipient)
                }
            },
        ],
        afterDelete: [
            async ({ doc }) => {
                const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
                if (tenantId && doc.templateType && doc.recipient) {
                    await invalidateTemplateConfigCache(tenantId, doc.templateType, doc.recipient)
                }
            },
        ],
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            hasMany: false,
            admin: {
                description: 'The tenant this email template config belongs to.',
            },
        },
        {
            name: 'templateType',
            type: 'select',
            required: true,
            options: EMAIL_TEMPLATE_TYPES.map((t) => ({ label: t, value: t })),
            admin: {
                description: 'Which email template this row configures.',
            },
        },
        {
            name: 'recipient',
            type: 'select',
            required: true,
            options: [
                { label: 'Buyer', value: 'buyer' },
                { label: 'Seller', value: 'seller' },
            ],
            admin: {
                description: 'The recipient role this configuration targets.',
            },
        },
        {
            name: 'enabled',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'When disabled, the default hard-coded template is used instead.',
            },
        },
        {
            name: 'contentEn',
            type: 'group',
            label: 'Content (English)',
            fields: [
                {
                    name: 'subject',
                    type: 'text',
                    maxLength: 200,
                    admin: { description: 'Email subject line (English).' },
                },
                {
                    name: 'greeting',
                    type: 'textarea',
                    maxLength: 500,
                    admin: { description: 'Opening greeting paragraph (English).' },
                },
                {
                    name: 'ctaLabel',
                    type: 'text',
                    maxLength: 100,
                    admin: { description: 'Call-to-action button label (English).' },
                },
                {
                    name: 'closing',
                    type: 'textarea',
                    maxLength: 2000,
                    admin: { description: 'Closing paragraph / sign-off (English).' },
                },
            ],
        },
        {
            name: 'contentMs',
            type: 'group',
            label: 'Content (Bahasa Malaysia)',
            fields: [
                {
                    name: 'subject',
                    type: 'text',
                    maxLength: 200,
                    admin: { description: 'Email subject line (Bahasa Malaysia).' },
                },
                {
                    name: 'greeting',
                    type: 'textarea',
                    maxLength: 500,
                    admin: { description: 'Opening greeting paragraph (Bahasa Malaysia).' },
                },
                {
                    name: 'ctaLabel',
                    type: 'text',
                    maxLength: 100,
                    admin: { description: 'Call-to-action button label (Bahasa Malaysia).' },
                },
                {
                    name: 'closing',
                    type: 'textarea',
                    maxLength: 2000,
                    admin: { description: 'Closing paragraph / sign-off (Bahasa Malaysia).' },
                },
            ],
        },
        {
            name: 'updatedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: {
                position: 'sidebar',
                readOnly: true,
                description: 'Last user to modify this record (system-set).',
            },
        },
    ],
    timestamps: true,
}
