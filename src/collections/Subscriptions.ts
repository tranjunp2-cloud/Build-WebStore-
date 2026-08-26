import type { CollectionConfig } from 'payload'

export const Subscriptions: CollectionConfig = {
    slug: 'subscriptions',
    admin: {
        useAsTitle: 'id',
        description: 'Stripe subscription records linked to tenants.',
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: () => false, // Only created via Stripe webhook
        update: () => false, // Only updated via Stripe webhook
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
        },
        {
            name: 'stripeSubscriptionId',
            type: 'text',
            required: true,
            unique: true,
            index: true,
        },
        {
            name: 'stripeCustomerId',
            type: 'text',
            required: true,
        },
        {
            name: 'plan',
            type: 'select',
            required: true,
            options: [
                { label: 'Free', value: 'free' },
                { label: 'Starter', value: 'starter' },
                { label: 'Pro', value: 'pro' },
                { label: 'Business', value: 'business' },
            ],
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            options: [
                { label: 'Active', value: 'active' },
                { label: 'Trialing', value: 'trialing' },
                { label: 'Past Due', value: 'past_due' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Unpaid', value: 'unpaid' },
                { label: 'Paused', value: 'paused' },
            ],
        },
        {
            name: 'currentPeriodStart',
            type: 'date',
        },
        {
            name: 'currentPeriodEnd',
            type: 'date',
        },
        {
            name: 'cancelAtPeriodEnd',
            type: 'checkbox',
            defaultValue: false,
        },
        {
            name: 'cancelledAt',
            type: 'date',
        },
        {
            name: 'trialEnd',
            type: 'date',
        },
        {
            name: 'metadata',
            type: 'json',
            admin: { description: 'Raw Stripe subscription metadata' },
        },
    ],
    timestamps: true,
}
