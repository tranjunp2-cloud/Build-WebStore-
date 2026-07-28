import type { CollectionConfig } from 'payload'

/**
 * Plan 260415 contact-bugfix — lưu contact form submissions per site.
 * Copy pattern từ Subscribers collection: create public (qua API route),
 * read/update/delete chỉ super-admin. Admin panel list có thể filter theo
 * site + status để triage leads.
 */
export const ContactSubmissions: CollectionConfig = {
    slug: 'contact-submissions',
    admin: {
        useAsTitle: 'email',
        description: 'Contact form submissions per site.',
        defaultColumns: ['name', 'email', 'site', 'status', 'createdAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: () => true, // Public — via /api/contact-submit
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            index: true,
        },
        {
            name: 'email',
            type: 'email',
            required: true,
            index: true,
        },
        {
            name: 'phone',
            type: 'text',
            required: false,
        },
        {
            name: 'subject',
            type: 'text',
            required: false,
            maxLength: 300,
        },
        {
            name: 'message',
            type: 'textarea',
            required: true,
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
        },
        {
            name: 'status',
            type: 'select',
            defaultValue: 'new',
            options: [
                { label: 'New', value: 'new' },
                { label: 'Read', value: 'read' },
                { label: 'Replied', value: 'replied' },
                { label: 'Archived', value: 'archived' },
            ],
            index: true,
        },
        {
            name: 'source',
            type: 'select',
            defaultValue: 'contact-block',
            options: [
                { label: 'Contact Block', value: 'contact-block' },
                { label: 'Footer', value: 'footer' },
                { label: 'Popup', value: 'popup' },
            ],
        },
        {
            name: 'ipAddress',
            type: 'text',
            required: false,
            admin: {
                description: 'IP address for rate limit + spam detection.',
                readOnly: true,
            },
        },
    ],
    timestamps: true,
}
