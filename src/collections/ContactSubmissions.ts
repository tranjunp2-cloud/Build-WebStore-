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
            // Emails the shop sent to this person from this message (the dashboard assistant's "reply to a lead").
            // Written by lib/leads/lead-reply.ts only (field access closes it to requests); shown read-only in the Contact leads panel.
            name: 'replies',
            type: 'array',
            // Closed to every request: create is public (anyone can POST /api/contact-submissions), so without this a
            // visitor could forge "Reply sent" entries. Payload drops the value from a request that cannot write the
            // field; lib/leads/lead-reply.ts writes it through the Local API with overrideAccess.
            access: { create: () => false, update: () => false },
            admin: { readOnly: true, description: 'Replies the shop emailed to this person.' },
            fields: [
                { name: 'subject', type: 'text', required: true, maxLength: 200 },
                { name: 'body', type: 'textarea', required: true, maxLength: 4000 },
                { name: 'sentAt', type: 'date', required: true },
                { name: 'sentBy', type: 'text', admin: { description: 'Email of the user who approved the reply.' } },
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
