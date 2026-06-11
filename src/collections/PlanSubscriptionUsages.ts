import type { CollectionConfig } from 'payload'
// Note: featureCode uses type: 'text' (not select) to avoid importing FEATURE_CODE_OPTIONS
// from PlanFeatures.ts which is created in Phase 04 — prevents circular compile dependency.

export const PlanSubscriptionUsages: CollectionConfig = {
  slug: 'plan-subscription-usages',
  admin: {
    useAsTitle: 'featureCode',
    description: 'Per-feature usage tracking per subscription. Mirrors PW1 plan_subscription_usages.',
    defaultColumns: ['subscription', 'featureCode', 'used', 'validUntil'],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
  },
  fields: [
    {
      name: 'subscription',
      type: 'relationship',
      relationTo: 'plan-subscriptions',
      required: true,
      index: true,
    },
    {
      // type: 'text' — set programmatically by recordUsage(), not via admin UI
      name: 'featureCode',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Feature code being tracked (e.g. staff_limit). Set by recordUsage(), not admin.',
      },
    },
    {
      name: 'used',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: 'Current usage count (e.g. staff members created)' },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: {
        description:
          'Usage quota resets after this date (mirrors PW1 valid_until). Null = no expiry.',
      },
    },
  ],
  timestamps: true,
}
