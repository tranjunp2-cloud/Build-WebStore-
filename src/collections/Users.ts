import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { forgotPasswordEmail } from '@/lib/email/templates/forgot-password'

/**
 * afterChange hook: send Welcome email to new users.
 * Non-blocking — registration succeeds even if email fails.
 */
const sendWelcomeEmailHook: CollectionAfterChangeHook = async ({ doc, operation }) => {
    if (operation !== 'create') return doc

    const userName = doc.firstName || doc.email?.split('@')[0] || 'there'
    const { subject, html } = welcomeEmail({ userName })

    // Fire-and-forget — don't block registration
    sendEmail({ to: doc.email, subject, html }).catch((err) => {
        console.error(`[Users] Failed to send welcome email to ${doc.email}:`, err)
    })

    return doc
}

export const Users: CollectionConfig = {
    slug: 'users',
    auth: {
        forgotPassword: {
            generateEmailHTML: (args) => {
                const token = args?.token || ''
                const user = args?.user || {}
                const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                const resetUrl = `${serverUrl}/reset-password?token=${token}`
                const userName = user.firstName || user.email?.split('@')[0] || 'there'
                const { html } = forgotPasswordEmail({ userName, resetUrl })
                return html
            },
            generateEmailSubject: () => {
                return 'Reset your PrimeWeb password \uD83D\uDD10'
            },
        },
    },
    admin: {
        useAsTitle: 'email',
        description: 'Platform users — can be super-admins or tenant members.',
    },
    hooks: {
        afterChange: [sendWelcomeEmailHook],
    },
    access: {
        // Allow anyone to register (public create)
        create: () => true,
        // Users can read their own data, super-admin can read all
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { id: { equals: req.user.id } }
        },
        // Users can update their own data
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { id: { equals: req.user.id } }
        },
        // Only super-admin can delete
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'firstName',
            type: 'text',
            required: true,
        },
        {
            name: 'lastName',
            type: 'text',
        },
        {
            name: 'roles',
            type: 'select',
            hasMany: true,
            defaultValue: ['tenant-owner'],
            options: [
                { label: 'Super Admin', value: 'super-admin' },
                { label: 'Tenant Owner', value: 'tenant-owner' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
            ],
            access: {
                update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
            },
        },
        {
            name: 'tenants',
            type: 'array',
            label: 'Tenant Memberships',
            admin: {
                description: 'Which tenants this user has access to',
            },
            fields: [
                {
                    name: 'tenant',
                    type: 'relationship',
                    relationTo: 'tenants',
                    required: true,
                },
                {
                    name: 'role',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Owner', value: 'owner' },
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                        { label: 'Viewer', value: 'viewer' },
                    ],
                },
            ],
        },
        {
            name: 'avatar',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'lastLoginAt',
            type: 'date',
            admin: { readOnly: true },
        },
    ],
    timestamps: true,
}
