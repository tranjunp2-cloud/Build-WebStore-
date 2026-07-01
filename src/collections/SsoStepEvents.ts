import type { CollectionConfig } from 'payload'

/**
 * SSO Hub step-status sync log — read-only admin view into `sso_step_events` (GH-1293).
 *
 * The table is written exclusively via raw SQL from `src/lib/sso/sso-api-client.ts`
 * (persistStepEvent) and the retry cron `src/app/api/cron/process-sso-steps/route.ts`.
 * This collection only exposes it for /admin inspection on staging/production —
 * never create/update/delete through the Payload API.
 *
 * Step legend: 1 = Pick Template, 2 = Setup Shipping, 3 = Add Product.
 */
export const SsoStepEvents: CollectionConfig = {
    slug: 'sso-step-events',
    admin: {
        group: 'System',
        description: 'SSO Hub step-status sync log (read-only). Step 1 = Pick Template, 2 = Setup Shipping, 3 = Add Product.',
        defaultColumns: ['user', 'step', 'status', 'retryCount', 'lastError', 'updatedAt'],
    },
    access: {
        read: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        create: () => false,
        update: () => false,
        delete: () => false,
    },
    fields: [
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
            index: true,
        },
        {
            name: 'step',
            type: 'number',
            required: true,
            admin: { description: '1 = Pick Template, 2 = Setup Shipping, 3 = Add Product' },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'pending',
            index: true,
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
            ],
        },
        {
            name: 'retryCount',
            type: 'number',
            required: true,
            defaultValue: 0,
        },
        {
            name: 'lastError',
            type: 'text',
        },
    ],
    timestamps: true,
}
