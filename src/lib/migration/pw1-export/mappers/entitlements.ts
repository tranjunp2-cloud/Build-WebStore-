import { type MappingContext, ref, live } from '../contracts'
import { numberValue } from '../primitives'
import { sourceTime, times } from './identity-lifecycle'

// Pinned schema enum; keep offline import graph independent of Payload collection modules.
const FEATURES = new Set([
  'website_builder',
  'template_limit',
  'code_snippet',
  'sitemap_robot_configuration',
  'live_chat_plugin',
  'domain_connection',
  'shipping_fee_configuration',
  'delivery_provider_limit',
  'allowing_buyer_making_order',
  'allowing_buyer_tracking_order',
  'payment_integration',
  'order_management',
  'product_management',
  'promotion_management',
  'content_management',
  'email_confirmation',
  'email_template_configuration',
  'staff_limit',
  'account_profile',
  'distribution_integration',
])
export function mapEntitlements(ctx: MappingContext): void {
  const subscription = ctx.output['plan-subscriptions'][0]
  if (!subscription) return
  const source = (ctx.tables.plan_subscriptions ?? []).find(
    (row) =>
      ref('plan-subscriptions', 'plan_subscriptions', row.id!) ===
      subscription._ref,
  )
  if (!source) {
    ctx.issue('SUBSCRIPTION_SOURCE_UNRESOLVED')
    return
  }
  if (!ctx.tables.plan_subscription_usages || !ctx.tables.plan_features) {
    ctx.issue('SUBSCRIPTION_USAGE_SOURCE_MISSING')
    return
  }
  const usages = ctx.tables.plan_subscription_usages.filter(
    (row) => row.subscription_id === source.id && live(row),
  )
  for (const row of usages) {
    try {
      const code = row.code ?? ''
      if (!FEATURES.has(code)) throw new Error('USAGE_FEATURE_UNKNOWN')
      const features = ctx.tables.plan_features.filter(
        (feature) =>
          feature.plan_id === source.plan_id &&
          feature.code === code &&
          live(feature),
      )
      if (features.length !== 1)
        throw new Error('USAGE_FEATURE_SOURCE_UNRESOLVED')
      if (usages.filter((other) => other.code === code).length !== 1)
        throw new Error('USAGE_FEATURE_DUPLICATE')
      const used = numberValue(row.used)
      if (!Number.isInteger(used) || used < 0 || used > 32767)
        throw new Error('USAGE_COUNT_INVALID')
      const validUntil = row.valid_until
        ? sourceTime(row.valid_until, ctx)
        : null
      if (
        validUntil &&
        Date.parse(validUntil) <= Date.parse(ctx.config.asOf) &&
        used > 0
      )
        ctx.issue(
          'SUBSCRIPTION_USAGE_EXPIRY',
          'plan_subscription_usages',
          row.id,
        )
      if (
        code === 'staff_limit' &&
        used !==
          ctx.output.users.filter(
            (user) => !(user.roles as string[]).includes('tenant-owner'),
          ).length
      )
        ctx.issue('STAFF_USAGE_MISMATCH', 'plan_subscription_usages', row.id)
      ctx.output['plan-subscription-usages'].push({
        _ref: ref(
          'plan-subscription-usages',
          'plan_subscription_usages',
          row.id!,
        ),
        subscription: subscription._ref,
        featureCode: code,
        used,
        validUntil,
        ...times(row, ctx),
      })
      ctx.contribute(
        'plan_subscription_usages',
        row,
        [
          'id',
          'subscription_id',
          'code',
          'used',
          'valid_until',
          'created_at',
          'updated_at',
        ],
        ref('plan-subscription-usages', 'plan_subscription_usages', row.id!),
        'MASTER-9.2',
      )
      ctx.contribute(
        'plan_features',
        features[0],
        ['plan_id', 'code'],
        ref('plan-subscription-usages', 'plan_subscription_usages', row.id!) +
          '.featureCode',
        'MASTER-9.2-FEATURE',
      )
    } catch (error) {
      ctx.issue(
        error instanceof Error ? error.message : 'USAGE_MAPPING_FAILED',
        'plan_subscription_usages',
        row.id,
      )
    }
  }
}
