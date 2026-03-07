import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
    slug: 'users',
    auth: true,
    admin: {
        useAsTitle: 'email',
        description: 'Platform users — can be super-admins or tenant members.',
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
            required: true,
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
