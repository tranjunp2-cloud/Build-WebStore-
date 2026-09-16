import type { CollectionConfig } from 'payload'

/**
 * Durable, server-owned queue for an operator-approved website recovery.
 *
 * The retry endpoint only inserts this record and a child generation. A cron
 * worker claims it with a lease and creates a separate draft site, so no retry
 * can mutate the source generation's evidence or published website.
 */
export const GenerationRecoveryJobs: CollectionConfig = {
    slug: 'generation_recovery_jobs',
    admin: {
        useAsTitle: 'idempotencyKey',
        defaultColumns: ['sourceGeneration', 'childGeneration', 'status', 'queuedAt', 'updatedAt'],
        description: 'Durable queue for safe website generation recovery.',
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: () => false,
        update: () => false,
        delete: () => false,
    },
    fields: [
        { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
        { name: 'sourceGeneration', type: 'relationship', relationTo: 'ai-generation-records', required: true, index: true },
        { name: 'childGeneration', type: 'relationship', relationTo: 'ai-generation-records', required: true, unique: true, index: true },
        { name: 'requestedBy', type: 'relationship', relationTo: 'users', required: true, index: true },
        { name: 'idempotencyKey', type: 'text', required: true, index: true, maxLength: 128 },
        { name: 'retryAttempt', type: 'number', required: true, min: 1 },
        {
            name: 'status', type: 'select', required: true, defaultValue: 'queued', index: true,
            options: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
        },
        { name: 'queuedAt', type: 'date', required: true, index: true },
        { name: 'startedAt', type: 'date' },
        { name: 'finishedAt', type: 'date' },
        { name: 'leaseToken', type: 'text', index: true, admin: { readOnly: true } },
        { name: 'leaseExpiresAt', type: 'date', index: true, admin: { readOnly: true } },
        { name: 'lastHeartbeatAt', type: 'date', admin: { readOnly: true } },
        { name: 'attemptCount', type: 'number', required: true, defaultValue: 0, min: 0 },
        { name: 'failureCode', type: 'text', admin: { readOnly: true } },
        { name: 'userSafeMessage', type: 'text', admin: { readOnly: true } },
    ],
    timestamps: true,
}
