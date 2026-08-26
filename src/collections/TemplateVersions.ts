import type { CollectionConfig } from 'payload'

/**
 * TemplateVersions — immutable snapshots of template sections on each save.
 * Super-admin read-only via Payload admin. Writes happen via save-sections API.
 * Rollback deferred to F07 milestone.
 */
export const TemplateVersions: CollectionConfig = {
    slug: 'template-versions',
    admin: {
        useAsTitle: 'versionNumber',
        description: 'Immutable section snapshots created on every builder save. Rollback: F07.',
        defaultColumns: ['template', 'versionNumber', 'changelog', 'createdBy', 'createdAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: () => false, // immutable
        delete: () => false, // retained for audit
    },
    fields: [
        {
            name: 'template',
            type: 'relationship',
            relationTo: 'templates',
            required: true,
            index: true,
            admin: { description: 'Template this version belongs to.' },
        },
        {
            name: 'versionNumber',
            type: 'number',
            required: true,
            index: true,
            admin: { description: 'Monotonically increasing per template.' },
        },
        {
            name: 'sectionsSnapshot',
            type: 'json',
            required: true,
            admin: { description: 'Snapshot of templatePages[0].layout at save time.' },
        },
        {
            name: 'changelog',
            type: 'textarea',
            admin: { description: 'Optional user-entered note on save.' },
        },
        {
            name: 'createdBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { description: 'Admin who triggered the save.' },
        },
    ],
    timestamps: true,
}
