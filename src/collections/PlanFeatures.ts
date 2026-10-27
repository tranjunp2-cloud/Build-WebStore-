import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import {
  AI_BUDGET_FEATURE,
  AI_PICTURES_FEATURE,
  AI_PLATFORM_CONFIG_FEATURE,
  aiConfigProblem,
  aiLimitProblem,
} from '@/lib/ai-platform/ai-config-schema'
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
  { label: 'AI battery (USD per rolling 24 h, chat + writing tools)', value: 'ai_budget_usd_daily' },
  { label: 'AI pictures (per rolling 24 h)', value: 'ai_pictures_daily' },
  { label: 'AI platform config (all plans): prices + models', value: 'ai_platform_config' },
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
  hooks: {
    // AI rows feed ai-platform (spend limits, prices, model chains): reject what it could not use
    beforeChange: [
      ({ data, originalDoc, collection }) => {
        const featureCode = data?.featureCode ?? originalDoc?.featureCode
        const value = data?.value ?? originalDoc?.value
        const settings = data && 'settings' in data ? data.settings : originalDoc?.settings
        let message: string | null = null
        let path = 'value'
        if (featureCode === AI_BUDGET_FEATURE || featureCode === AI_PICTURES_FEATURE) message = aiLimitProblem(featureCode, value)
        else if (featureCode === AI_PLATFORM_CONFIG_FEATURE) {
          message = aiConfigProblem(settings)
          path = 'settings'
        }
        if (message) throw new ValidationError({ collection: collection.slug, errors: [{ message, path }] })
        return data
      },
    ],
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
          'Config JSON. ai_platform_config (platform-wide, keep ONE row, under FREEMIUM): {"prices":{"anthropic:claude-haiku-5-5":{"input":0.1,"output":0.5,"cachedInput":0.01,"cacheWrite":0.125}},"images":{"openai:gpt-image-1":0.042},"models":{"fast":"anthropic:claude-haiku-5-5, openai:gpt-4.1-nano"}} — USD per 1M tokens / per picture. Whitelist config: template_limit: {"name":["template-a"]}. payment_integration: {"code":["cod","billplz"]}. Mirrors PW1 plan_features.settings.',
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
