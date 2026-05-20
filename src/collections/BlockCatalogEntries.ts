import type { CollectionConfig } from 'payload'

/**
 * BlockCatalogEntries — admin-curated overrides for code-first block registry.
 * Source of truth for blocks is the registry (src/blocks/registry.ts).
 * This collection only persists admin-added metadata (descriptions, display order, etc.).
 * slug must match a key in the block registry.
 */
export const BlockCatalogEntries: CollectionConfig = {
    slug: 'block-catalog-entries',
    admin: {
        useAsTitle: 'slug',
        description: 'Admin metadata overrides for code-first block registry. One row per block slug.',
        defaultColumns: ['slug', 'displayOrder', 'hiddenFromCatalog', 'updatedAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'Must match a block key in src/blocks/registry.ts (e.g. "hero", "cta").',
            },
        },
        {
            name: 'descriptionOverride',
            type: 'textarea',
            admin: {
                description: 'English description override. Falls back to registry description.',
            },
        },
        {
            name: 'descriptionOverrideVi',
            type: 'textarea',
            admin: {
                description: 'Vietnamese description override.',
            },
        },
        {
            name: 'displayOrder',
            type: 'number',
            defaultValue: 0,
            admin: {
                description: 'Sort order within category (lower = first).',
            },
        },
        {
            name: 'curatedPreviewUrl',
            type: 'text',
            admin: {
                description: 'Admin-curated preview image URL for this block.',
            },
        },
        {
            name: 'hiddenFromCatalog',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'When true, this block is hidden from the studio catalog grid.',
            },
        },
    ],
    timestamps: true,
}
