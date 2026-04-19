import type { CollectionConfig } from 'payload'

/**
 * AiGenerationRecords — full snapshot per user-triggered AI generation.
 *
 * Complements AiUsageLogs (tokens/cost metadata) with the full prompt,
 * selected blocks, output snapshot, and status lifecycle for admin monitoring.
 *
 * Privacy: promptMode controls what is stored.
 *   full      → full promptText + SHA256 hash (default, decided 2026-04-19)
 *   truncated → first 500 chars + hash
 *   hashed    → hash only, no text
 *
 * Source: plans/260419-1637-GH-1-admin-design-build/phase-05-monitoring-user-generations.md
 */
export const AiGenerationRecords: CollectionConfig = {
    slug: 'ai-generation-records',
    admin: {
        description: 'Per-generation snapshot for admin monitoring — prompt, blocks, output, status.',
        defaultColumns: ['createdAt', 'endpoint', 'category', 'status', 'durationMs', 'costUsd'],
        useAsTitle: 'endpoint',
    },
    access: {
        read: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        create: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        update: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        delete: ({ req }) => req.user?.roles?.includes('super-admin') || false,
    },
    fields: [
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            index: false,
            admin: { description: 'Site being generated (optional — not set for template gens)' },
        },
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            index: true,
            admin: { description: 'User who triggered the generation' },
        },
        {
            name: 'endpoint',
            type: 'text',
            required: true,
            admin: { description: 'AI pipeline entry point, e.g. "site-generator", "generate-meta"' },
        },
        {
            name: 'category',
            type: 'text',
            admin: { description: 'Industry category resolved from business info' },
        },
        {
            name: 'promptMode',
            type: 'select',
            required: true,
            defaultValue: 'full',
            options: [
                { label: 'Full (store complete prompt)', value: 'full' },
                { label: 'Truncated (first 500 chars)', value: 'truncated' },
                { label: 'Hashed (SHA256 only, no text)', value: 'hashed' },
            ],
        },
        {
            name: 'promptText',
            type: 'textarea',
            maxLength: 8000,
            admin: { description: 'Raw user brief (stored per promptMode setting)' },
        },
        {
            name: 'promptHash',
            type: 'text',
            admin: { description: 'SHA256 of original prompt — always stored for dedup analytics' },
        },
        {
            name: 'selectedBlocks',
            type: 'array',
            admin: { description: 'Block slugs selected in the generated output' },
            fields: [
                {
                    name: 'value',
                    type: 'text',
                },
            ],
        },
        {
            name: 'outputSnapshot',
            type: 'json',
            admin: { description: 'Capped at ADMIN_GEN_SNAPSHOT_MAX_KB (default 50KB). Larger outputs are truncated.' },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'running',
            index: true,
            options: [
                { label: 'Running', value: 'running' },
                { label: 'Success', value: 'success' },
                { label: 'Failed', value: 'failed' },
            ],
        },
        {
            name: 'errorLog',
            type: 'textarea',
            admin: {
                description: 'Sanitized error message (file paths stripped from stack traces)',
                condition: (data) => data?.status === 'failed',
            },
        },
        {
            name: 'durationMs',
            type: 'number',
            admin: { description: 'Wall-clock latency from start to finish/fail' },
        },
        {
            name: 'costUsd',
            type: 'number',
            admin: {
                description: 'Estimated OpenAI cost in USD',
                step: 0.000001,
            },
        },
        {
            name: 'completedAt',
            type: 'date',
            admin: { description: 'When status transitioned to success or failed' },
        },
    ],
    timestamps: true,
}
