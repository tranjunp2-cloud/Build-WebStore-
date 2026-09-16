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
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            index: true,
            admin: { description: 'Frozen tenant ownership for this generation and any isolated recovery child.' },
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
        { name: 'traceId', type: 'text', index: true, admin: { description: 'Route request trace ID for this generation run' } },
        { name: 'inputSnapshot', type: 'json', admin: { description: 'Frozen, normalized input used for this run' } },
        { name: 'inputSchemaVersion', type: 'text', admin: { description: 'Schema version of frozen input' } },
        { name: 'inputHash', type: 'text', index: true, admin: { description: 'SHA256 of frozen normalized input' } },
        {
            name: 'lifecycle', type: 'select', index: true,
            options: ['queued', 'running', 'terminal'],
            admin: { description: 'F41 lifecycle; terminal is written only after site/page persistence' },
        },
        {
            name: 'outcome', type: 'select', index: true,
            options: ['succeeded', 'partial_failed', 'failed', 'cancelled'],
            admin: { description: 'Terminal persistence outcome, independent from legacy status' },
        },
        {
            name: 'recoveryStatus', type: 'select', index: true,
            options: ['none', 'eligible', 'retrying', 'exhausted', 'ticket_required', 'ticket_created', 'stale_running'],
            admin: { description: 'Operations recovery state; do not infer from error text in UI' },
        },
        {
            name: 'source', type: 'select', index: true,
            defaultValue: 'user_submit',
            options: ['user_submit', 'ops_retry'],
            admin: { description: 'How this run was initiated. Retry runs must be isolated child records.' },
        },
        {
            name: 'parentGeneration', type: 'relationship', relationTo: 'ai-generation-records', index: true,
            admin: { description: 'Immutable source run for an operations retry.' },
        },
        {
            name: 'retryRootGeneration', type: 'relationship', relationTo: 'ai-generation-records', index: true,
            admin: { description: 'First run in a retry lineage.' },
        },
        { name: 'retryAttempt', type: 'number', min: 0, admin: { description: 'Zero for original runs; increments only for a child retry.' } },
        {
            name: 'recoveredSite', type: 'relationship', relationTo: 'sites', index: true,
            admin: { description: 'Isolated draft site created by an operations retry; never replaces the parent site.' },
        },
        {
            name: 'pageSummary', type: 'group', fields: [
                { name: 'expected', type: 'number' },
                { name: 'persisted', type: 'number' },
                { name: 'failed', type: 'number' },
            ],
        },
        {
            name: 'pageOutcomes', type: 'array', fields: [
                { name: 'pageKey', type: 'text' }, { name: 'title', type: 'text' }, { name: 'slug', type: 'text' },
                { name: 'pageId', type: 'text' }, { name: 'status', type: 'select', options: ['persisted', 'failed'] },
                { name: 'blockCount', type: 'number' }, { name: 'errorCode', type: 'text' }, { name: 'errorSummary', type: 'textarea' },
            ],
        },
        {
            name: 'generationErrors', type: 'array', fields: [
                { name: 'phase', type: 'text' }, { name: 'locationType', type: 'text' }, { name: 'locationKey', type: 'text' },
                { name: 'code', type: 'text' }, { name: 'category', type: 'text' }, { name: 'retryabilityReason', type: 'text' },
                { name: 'operatorMessage', type: 'textarea' }, { name: 'userSafeMessage', type: 'textarea' },
                { name: 'sanitizedTechnicalMessage', type: 'textarea' }, { name: 'signature', type: 'text' },
            ],
        },
        { name: 'userSafeMessage', type: 'text', admin: { description: 'Never contains provider/raw error details' } },
        { name: 'startedAt', type: 'date' }, { name: 'terminalAt', type: 'date', index: true }, { name: 'lastHeartbeatAt', type: 'date' },
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
        // Phase 04 — override-rate fields (populated at gen time + on edit)
        {
            name: 'fieldsTotal',
            type: 'number',
            admin: { description: 'Total template fields at generation time (used for override-rate denominator)' },
        },
        {
            name: 'fieldsFilled',
            type: 'number',
            admin: { description: 'Fields auto-filled by AI (non-empty values in output snapshot)' },
        },
        {
            name: 'fieldsEdited',
            type: 'number',
            defaultValue: 0,
            admin: { description: 'Fields user edited post-generation (incremented via save-sections)' },
        },
    ],
    timestamps: true,
}
