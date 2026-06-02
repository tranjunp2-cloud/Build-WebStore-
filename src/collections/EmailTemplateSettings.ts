import type { CollectionConfig } from 'payload'
import { EMAIL_TEMPLATE_TYPES } from '../lib/email/types'
import { invalidateTemplateConfigCache } from '../lib/email/get-template-config'

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
        create: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
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
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
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
            ({ data, req }) => {
                if (req.user?.id) {
                    data.updatedBy = req.user.id
                }
                return data
            },
            ({ data }) => {
                // Reject any attempt to disable security-critical templates regardless of call path
                const isCritical = CRITICAL_TYPES.includes(data.templateType as typeof CRITICAL_TYPES[number])
                if (isCritical && data.enabled === false) {
                    throw new Error(
                        `Cannot disable security-critical template "${data.templateType}". This template is required for account security flows.`
                    )
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
