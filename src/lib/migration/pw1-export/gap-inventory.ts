import type { Diagnostic, Row } from './contracts'

type Tables = Readonly<Record<string, Row[]>>
const live = (row: Row) => !row.deleted_at
const flag = (value: string | null | undefined) =>
  value === '0' ? false : value === '1' ? true : null
const numeric = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  return /^\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? text : null
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Source unit and tier order are preserved. This inventory never activates shipping. */
export function classifyShipping(row: Row, provider?: Row) {
  const providerCode = ['self_delivery', 'ghn', 'jnt', 'gdex', 'ninjavan'].includes(provider?.code ?? '')
    ? provider!.code! : 'unknown'
  const base = {
    sourceId: row.id ?? '', storeId: row.store_id ?? '',
    providerId: row.delivery_provider_id ?? '', provider: providerCode,
    providerActive: provider && live(provider) ? flag(provider.status) : false,
    active: flag(row.status), configured: flag(row.config_status),
    isDefault: flag(row.is_default), supportsCod: flag(row.is_support_cod),
    supportsDynamic: flag(row.is_support_dynamic_fee),
    feeUnit: 'source-unit-unverified', targetReady: false,
  }
  if (row.shipping_fee_method === '2') return { ...base, classification: 'dynamic-provider' }
  if (row.shipping_fee_method !== '1') return { ...base, classification: 'unknown-method' }
  if (!row.shipping_fee_config || row.shipping_fee_config === 'null')
    return { ...base, classification: 'missing-config' }
  let config: unknown
  try { config = JSON.parse(row.shipping_fee_config) }
  catch { return { ...base, classification: 'invalid-json' } }
  if (!object(config)) return { ...base, classification: 'invalid-shape' }
  if (String(config.condition_type) === '1') {
    const fee = numeric(config.shipping_fee)
    return { ...base, classification: fee === null ? 'invalid-fixed-fee' : 'fixed-fee', fee }
  }
  if (String(config.condition_type) !== '2' || !Array.isArray(config.condition_value))
    return { ...base, classification: 'unknown-condition' }
  const tiers = config.condition_value.map((item, index) => ({
    index,
    from: object(item) ? numeric(item.sub_total_from) : null,
    to: object(item) && item.sub_total_to === '--' ? '--' : object(item) ? numeric(item.sub_total_to) : null,
    fee: object(item) ? numeric(item.shipping_fee) : null,
  }))
  const valid = tiers.length > 0 && tiers.every((tier) => tier.from !== null && tier.fee !== null)
  return {
    ...base, classification: valid ? 'tiered-fee' : 'invalid-tiers', tiers,
    semantics: 'last-matching-from-in-source-order; upper-bound-not-used-by-PW1-runtime',
  }
}

export function shippingInventory(tables: Tables) {
  const providers = new Map((tables.delivery_providers ?? []).map((row) => [row.id, row]))
  const stores = new Set((tables.stores ?? []).filter(live).map((row) => row.id))
  const deliveries = (tables.store_deliveries ?? []).filter(live)
  const present = new Set(deliveries.map((row) => row.store_id))
  return {
    scope: 'all-source-live-stores-and-live-delivery-rows',
    missingTable: !tables.store_deliveries,
    storesWithoutDelivery: [...stores].filter((id) => !present.has(id)),
    rows: deliveries.map((row) => ({
      ...classifyShipping(row, providers.get(row.delivery_provider_id)),
      liveStoreFound: stores.has(row.store_id),
    })),
  }
}

/** Only bounded enum values and source IDs enter the case file; never source text/credentials. */
export function gapCases(tables: Tables, diagnostics: Diagnostic[]) {
  const indexes = new Map(Object.entries(tables).map(([table, rows]) => [table, new Map(rows.map((row) => [row.id, row]))]))
  const skus = new Map<string, Row[]>()
  for (const row of tables.product_skus ?? []) {
    const key = row.product_id ?? ''
    const list = skus.get(key) ?? []; list.push(row); skus.set(key, list)
  }
  const byStore = new Map<string, Row[]>()
  for (const row of tables.users ?? []) {
    const key = row.store_id ?? ''
    const group = byStore.get(key) ?? []; group.push(row); byStore.set(key, group)
  }
  const mainSubscriptions = new Map<string, number>()
  for (const row of tables.plan_subscriptions ?? []) {
    if (live(row) && row.subscribable_type === 'App\\Models\\Store' && row.name === 'main') {
      const key = row.subscribable_id ?? ''
      mainSubscriptions.set(key, (mainSubscriptions.get(key) ?? 0) + 1)
    }
  }
  const slugCounts = new Map<string, number>()
  for (const table of ['blog_posts', 'blog_categories'])
    for (const row of tables[table] ?? []) {
      if (!live(row)) continue
      const key = JSON.stringify([table, row.store_id, row.slug])
      slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1)
    }
  return diagnostics.filter((item) => item.severity === 'blocker').map((item) => {
    const row = indexes.get(item.table ?? '')?.get(item.sourceId ?? null)
    const evidence: Record<string, string | number | boolean | null> = {}
    let reason = ('reason' in item && typeof item.reason === 'string') ? item.reason : item.code
    if (row) {
      evidence.sourceRowFound = true
      for (const field of ['status', 'purchase_status', 'refund_status', 'type_id', 'is_frontend', 'is_store_owner'])
        if (field in row) evidence[field] = /^[0-9]{1,2}$/.test(row[field] ?? '') ? row[field] : row[field] ? 'unverified' : 'absent'
      for (const field of ['created_by', 'category_id', 'parent_id', 'model_id', 'store_id'])
        if (field in row) evidence[field] = /^\d+$/.test(row[field] ?? '') ? row[field] : row[field] ? 'unverified' : 'absent'
      if (item.table === 'stores') {
        const users = (byStore.get(row.id ?? '') ?? []).filter(live)
        const owners = users.filter((user) => user.is_frontend === '0' && user.is_store_owner === '1')
        evidence.liveOwnerFlagCount = owners.length
        evidence.ownerStoreStatusConflict = owners.some((owner) => owner.status !== row.status)
        evidence.liveMainSubscriptionCount = mainSubscriptions.get(row.id ?? '') ?? 0
      }
      if (item.code === 'USER_CREATOR_UNRESOLVED') {
        const creator = indexes.get('users')?.get(row.created_by)
        evidence.creatorFound = !!creator
        evidence.creatorLive = !!creator && live(creator)
        evidence.creatorSameStore = !!creator && creator.store_id === row.store_id
        evidence.creatorFrontend = creator ? flag(creator.is_frontend) : null
      }
      if (item.code === 'SOURCE_NO_ELIGIBLE_SKU') {
        const all = skus.get(row.id ?? '') ?? []
        const owned = all.filter((sku) => live(sku) && sku.store_id === row.store_id)
        reason = !all.length ? 'NO_SKU_ROWS' : !owned.length ? 'NO_LIVE_OWNED_SKU'
          : owned.every((sku) => sku.status === '0') ? 'ALL_LIVE_OWNED_SKUS_INACTIVE' : 'SKU_STATUS_REQUIRES_REVIEW'
        evidence.skuRows = all.length; evidence.liveOwnedSkuRows = owned.length
      }
      if (item.code === 'BLOG_SLUG_COLLISION') {
        const count = slugCounts.get(JSON.stringify([item.table, row.store_id, row.slug])) ?? 0
        reason = count > 1 ? 'SAME_TENANT_SLUG_COLLISION' : 'CROSS_TENANT_ONLY_SLUG_COLLISION'
        evidence.sameTenantRecords = count
      }
      if (item.code === 'CONTACT_STRUCTURE_UNRESOLVED' && item.field) {
        try {
          const value: unknown = JSON.parse(row[item.field] ?? '')
          reason = Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'number')
            ? 'NUMERIC_CONTACT_ARRAY' : 'CONTACT_SHAPE_REQUIRES_REVIEW'
        } catch { reason = 'CONTACT_INVALID_JSON' }
      }
      if (item.code === 'RAW_OWNERSHIP_MISSING') {
        const parent = indexes.get('stores')?.get(row.model_id)
        evidence.storeModel = row.model_type === 'App\\Models\\Store'
        evidence.modelMatchesDiagnosticStore = row.model_id === item.storeId
        evidence.liveParentFound = !!parent && live(parent)
      }
    } else evidence.sourceRowFound = false
    return { ...item, reason, evidence }
  })
}

export function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const result: Record<string, number> = Object.create(null)
  for (const row of rows) { const name = key(row); result[name] = (result[name] ?? 0) + 1 }
  return result
}
