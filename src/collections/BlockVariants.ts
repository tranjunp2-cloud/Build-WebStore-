import type { CollectionConfig } from 'payload'

/**
 * BlockVariants — admin-curated override metadata for individual block variants.
 * Base variants are code-first (registry). This collection persists only overrides.
 * blockSlug must match a registry key; variantName must match a variant in that block's meta.
 */
export const BlockVariants: CollectionConfig = {
    slug: 'block-variants',
    admin: {
        useAsTitle: 'variantName',
        description: 'Admin override metadata for individual block variants (preview URLs, notes).',
        defaultColumns: ['blockSlug', 'variantName', 'previewUrlOverride', 'updatedAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'blockSlug',
            type: 'text',
            required: true,
            index: true,
            admin: {
                description: 'Block registry key (e.g. "hero"). Must match registry.',
            },
        },
        {
            name: 'variantName',
            type: 'text',
            required: true,
            admin: {
                description: 'Variant identifier (e.g. "centered", "split-left").',
            },
        },
        {
            name: 'previewUrlOverride',
            type: 'text',
            admin: {
                description: 'Admin-curated preview image URL for this variant.',
            },
        },
        {
            name: 'notes',
            type: 'textarea',
            admin: {
                description: 'Internal notes about this variant (not shown to end users).',
            },
        },
        {
            name: 'displayName',
            type: 'text',
            admin: {
                description: 'Human-friendly label shown in admin UI (falls back to variantName).',
            },
        },
        {
            name: 'enabled',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'If unchecked, variant is hidden from AI gen selection pool.',
            },
        },
    ],
    timestamps: true,
}
