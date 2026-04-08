import type { CollectionConfig } from 'payload'

export const Subscribers: CollectionConfig = {
    slug: 'subscribers',
    admin: {
        useAsTitle: 'email',
        description: 'Newsletter email subscribers per site.',
        defaultColumns: ['email', 'site', 'source', 'createdAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: () => true, // Public — via /api/subscribe
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'email',
            type: 'email',
            required: true,
            index: true,
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
        },
        {
            name: 'source',
            type: 'select',
            defaultValue: 'newsletter',
            options: [
                { label: 'Newsletter Block', value: 'newsletter' },
                { label: 'Popup', value: 'popup' },
                { label: 'Footer', value: 'footer' },
            ],
        },
    ],
    timestamps: true,
}
