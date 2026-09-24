import type { Doc, MappingContext } from '../contracts'
import { live } from '../contracts'
import { classifyShipping } from '../gap-inventory'
import { sourceDiscountMinorUnits } from '../../pw2-commerce-reconciliation.mjs'
import { SHIPPING_DEFAULTS, RATE_MAX } from '../../../shipping/constants'

/** PW2 behavior only: no legacy tier engine, provider credentials or activation. */
export function applySitePolicy(ctx: MappingContext, site: Doc): void {
  const policy = ctx.config.migrationPolicy
  if (!policy) {
    ctx.issue('SITE_TYPE_DEFAULT_REQUIRES_REVIEW', 'stores', ctx.storeId, 'siteType')
    ctx.issue('SITE_SHIPPING_MAPPING_UNRESOLVED', 'store_deliveries', ctx.storeId)
    return
  }
  site.siteType = policy.siteTypeOverrides[ctx.storeId] ?? policy.siteTypeDefault
  ctx.issue('SITE_TYPE_POLICY_APPLIED', 'stores', ctx.storeId, 'siteType', 'warning',
    Object.hasOwn(policy.siteTypeOverrides, ctx.storeId) ? 'EXPLICIT_STORE_OVERRIDE' : 'APPROVED_ECOMMERCE_DEFAULT')

  const store = ctx.find('stores', ctx.storeId)
  const currency = ctx.find('currencies', store?.currency_id)?.code
  if (currency !== 'MYR') {
    ctx.issue('SITE_SHIPPING_CURRENCY_UNSUPPORTED', 'stores', ctx.storeId, 'currency_id')
    return
  }
  if (policy.shippingPolicy === 'pw2-defaults') {
    site.shippingConfig = { enabled: true, westRate: SHIPPING_DEFAULTS.westRate, eastRate: SHIPPING_DEFAULTS.eastRate, freeAbove: null, shippingSetupConfirmed: false }
    ctx.issue('SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', 'stores', ctx.storeId, 'shipping_fee_config', 'warning', 'APPROVED_PW2_DEFAULTS')
    return
  }
  const rows = ctx.rows('store_deliveries').filter(row => live(row) && row.store_id === ctx.storeId)
  const self = rows.filter(row => {
    const provider = ctx.find('delivery_providers', row.delivery_provider_id)
    return provider && live(provider) && provider.status === '1' && provider.code === 'self_delivery'
  })
  let reason = 'MISSING_OR_UNCONFIGURED_SOURCE'
  let rate: number | undefined
  let selected = self.length === 1 ? self[0] : undefined
  if (store?.selected_delivery_method !== '1') {
    reason = 'PROVIDER_OR_UNKNOWN_SOURCE_MODE'
    selected = undefined
  } else if (self.length > 1) reason = 'AMBIGUOUS_SELF_DELIVERY'
  if (selected && selected.status === '1' && selected.config_status === '1') {
    const source = classifyShipping(selected, ctx.find('delivery_providers', selected.delivery_provider_id))
    if (source.classification === 'fixed-fee' && 'fee' in source && source.fee !== null) {
      try {
        const candidate = sourceDiscountMinorUnits(source.fee, currency)
        if (candidate > RATE_MAX) reason = 'FIXED_FEE_EXCEEDS_PW2_LIMIT'
        else rate = candidate
      } catch {
        reason = 'FIXED_FEE_PRECISION_OR_VALUE_INVALID'
      }
    } else reason = source.classification === 'tiered-fee' ? 'LEGACY_TIER_NOT_MAPPED'
      : source.classification === 'dynamic-provider' ? 'LEGACY_DYNAMIC_NOT_MAPPED' : 'INVALID_SOURCE_CONFIGURATION'
  }
  if (rate === undefined && policy.shippingPolicy === 'review') {
    ctx.issue('SITE_SHIPPING_RECONFIGURATION_REQUIRED', 'store_deliveries', selected?.id ?? ctx.storeId,
      'shipping_fee_config', 'blocker', reason)
    return
  }
  site.shippingConfig = {
    enabled: true,
    westRate: rate ?? SHIPPING_DEFAULTS.westRate,
    eastRate: rate ?? SHIPPING_DEFAULTS.eastRate,
    freeAbove: null,
    shippingSetupConfirmed: false,
  }
  if (rate !== undefined && selected) {
    ctx.contribute('store_deliveries', selected,
      ['store_id', 'delivery_provider_id', 'status', 'config_status', 'shipping_fee_method', 'shipping_fee_config'],
      `${site._ref}.shippingConfig`, 'MASTER-4-PW2-FIXED-SHIPPING')
    if (store) ctx.contribute('stores', store, ['currency_id', 'selected_delivery_method'],
      `${site._ref}.shippingConfig`, 'MASTER-4-PW2-FIXED-SHIPPING')
    ctx.issue('SHIPPING_FIXED_FEE_MAPPED', 'store_deliveries', selected.id, 'shipping_fee_config', 'warning')
  } else {
    // Source configuration remains in source/raw inventory, not described as migrated equivalent.
    ctx.issue('SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', 'store_deliveries', selected?.id ?? ctx.storeId,
      'shipping_fee_config', 'warning', reason)
  }
}
