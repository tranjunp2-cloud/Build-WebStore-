import type { CollectionConfig } from 'payload'
import { PLAN_CODES } from './PlanSubscriptions'

export const FEATURE_CODE_OPTIONS = [
  { label: 'Website Builder', value: 'website_builder' },
  { label: 'Template Limit', value: 'template_limit' },
  { label: 'Code Snippet', value: 'code_snippet' },
  { label: 'Sitemap & Robot Config', value: 'sitemap_robot_configuration' },
  { label: 'Live Chat Plugin', value: 'live_chat_plugin' },
  { label: 'Domain Connection', value: 'domain_connection' },
  { label: 'Shipping Fee Configuration', value: 'shipping_fee_configuration' },
  { label: 'Delivery Provider Limit', value: 'delivery_provider_limit' },
  { label: 'Allowing Buyer Making Order', value: 'allowing_buyer_making_order' },
  { label: 'Allowing Buyer Tracking Order', value: 'allowing_buyer_tracking_order' },
  { label: 'Payment Integration', value: 'payment_integration' },
  { label: 'Order Management', value: 'order_management' },
  { label: 'Product Management', value: 'product_management' },
  { label: 'Promotion Management', value: 'promotion_management' },
  { label: 'Content Management', value: 'content_management' },
  { label: 'Email Confirmation', value: 'email_confirmation' },
  { label: 'Email Template Configuration', value: 'email_template_configuration' },
  { label: 'Staff Limit', value: 'staff_limit' },
  { label: 'Account Profile', value: 'account_profile' },
  { label: 'Distribution Integration', value: 'distribution_integration' },
] as const

export type FeatureCode = (typeof FEATURE_CODE_OPTIONS)[number]['value']

export const PlanFeatures: CollectionConfig = {
  slug: 'plan-features',
  admin: {
    useAsTitle: 'featureCode',
    description:
      'Feature matrix per plan. Seeded with YES for all. Admin can adjust per business needs.',
    defaultColumns: ['planCode', 'featureCode', 'value'],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
  },
  fields: [
    {
      name: 'planCode',
      type: 'select',
      required: true,
      index: true,
      options: [...PLAN_CODES],
      admin: { description: 'Plan this feature rule applies to' },
    },
    {
      name: 'featureCode',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'Feature code (e.g. website_builder, staff_limit). Mirrors PW1 plan_features.code.',
      },
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      defaultValue: 'YES',
      admin: {
        description:
          'YES | UNLIMITED | 0 (disabled) | numeric limit (e.g. "3" for staff_limit=3)',
      },
    },
    {
      name: 'settings',
      type: 'json',
      admin: {
        description:
          'Whitelist config JSON. template_limit: {"name":["template-a"]}. payment_integration: {"code":["cod","billplz"]}. Mirrors PW1 plan_features.settings.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      admin: { description: 'Display sort order. Mirrors PW1 plan_features.sort_order.' },
    },
  ],
  timestamps: true,
}
