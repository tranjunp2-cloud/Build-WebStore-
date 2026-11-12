import type { CollectionConfig } from 'payload'
import { revalidatePlanSubscriptionAfterChange, revalidatePlanSubscriptionAfterDelete } from '@/lib/cache/revalidate-storefront'

// Plan codes matching PW1 DB + SSO subscription codes
export const PLAN_CODES = [
  { label: 'Freemium', value: 'FREEMIUM' },
  { label: 'Starter (TM)', value: 'STARTER_TM_USER' },
  { label: 'Starter (Non-TM)', value: 'STARTER_NON_TM_USER' },
  { label: 'Standard (TM)', value: 'STANDARD_TM_USER' },
  { label: 'Standard (Non-TM)', value: 'STANDARD_NON_TM_USER' },
  { label: 'Professional (TM)', value: 'PROFESSIONAL_TM_USER' },
  { label: 'Professional (Non-TM)', value: 'PROFESSIONAL_NON_TM_USER' },
] as const

export type PlanCode = (typeof PLAN_CODES)[number]['value']

export const PlanSubscriptions: CollectionConfig = {
  slug: 'plan-subscriptions',
  admin: {
    useAsTitle: 'plan',
    description: 'Tenant subscription records synced from SSO. Source of truth: SSO.',
  },
  access: {
    // Only super-admin can read/write; created/updated via SSO endpoints only
    read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
  },
  hooks: {
    afterChange: [revalidatePlanSubscriptionAfterChange],
    afterDelete: [revalidatePlanSubscriptionAfterDelete],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: { description: 'Tenant this subscription belongs to' },
    },
    {
      name: 'name',
      type: 'text',
      defaultValue: 'main',
      admin: { description: 'Subscription name (always "main" for primary subscription)' },
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      options: [...PLAN_CODES],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Ended', value: 'ended' },
        { label: 'Canceled', value: 'canceled' },
      ],
    },
    {
      name: 'startsAt',
      type: 'date',
      required: true,
      admin: { description: 'Subscription period start (from SSO start_date)' },
    },
    {
      name: 'endsAt',
      type: 'date',
      required: true,
      index: true,
      admin: { description: 'Subscription period end (from SSO end_date)' },
    },
    {
      name: 'canceledAt',
      type: 'date',
      admin: { description: 'Set when subscription is canceled by SSO' },
    },
    {
      name: 'canceledImmediately',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'PW1 canceled_immediately: true = cancel now (deactivates immediately), false = cancel at period end (subscription stays active until endsAt).',
      },
    },
    {
      name: 'packCode',
      type: 'text',
      admin: { description: 'Raw pack_code from SSO (e.g. PROFESSIONAL, STARTER)' },
    },
  ],
  timestamps: true,
}
