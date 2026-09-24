import { EXCLUDED_DISCOUNT_RULE, excludedDiscountDiagnostic, PAGE_MENU_SCOPE_RULE, PAGE_MENU_TABLES, ADDRESS_OVERFLOW_RULE, APPROVED_METADATA_RULE, MAPPED_ORDER_METADATA_RULE, TECHNICAL_SCOPE_RULE, TECHNICAL_TABLES, STORE_CODES_RULE, approvedMetadataField } from './approved-source-scope'
import { MEDIA_METADATA_RULE } from './mappers/library-media'
import { MODEL_SETTINGS_SCOPE_RULE, MODEL_SETTINGS_RETAIN_RULE } from './model-settings-scope'
import { SOURCE_EXCLUSION_RULE } from './source-exclusions'
import { createConflictRetention, conflictRetentionField, CONFLICT_RETENTION_RULE } from './conflict-retention'
import { PRODUCT_EXCLUSION_RULE, PRODUCT_CATALOG_EXCLUSION_RULE } from './product-exclusions'
import { EXTERNAL_SOURCE_RULE, externalSourceField } from './external-source'
import type { Diagnostic, Row, SourceConfig } from './contracts'
import { ARCHIVE_TABLES, SOURCE_HEADERS } from './source-registry'

export const CLASSIFICATION_VERSION = 'source-classification-v1' as const
export interface Ownership { storeId: string | null; rule: string; parentTable?: string; parentId?: string }
const parents: Record<string, [string, string]> = {
  product_skus: ['products', 'product_id'],
  category_attributes: ['categories', 'category_id'], product_attributes: ['products', 'product_id'],
  product_images: ['products', 'product_id'], product_variants: ['product_skus', 'product_sku_id'],
  product_sku_images: ['product_skus', 'product_sku_id'], product_sku_promotion_prices: ['product_skus', 'product_sku_id'],
  order_details: ['orders', 'order_id'], order_status_histories: ['orders', 'order_id'],
  promotion_codes: ['promotions', 'promotion_id'], promotion_product_skus: ['promotions', 'promotion_id'],
  voucher_product_skus: ['vouchers', 'voucher_id'], page_components: ['pages', 'page_id'],
  menu_items: ['menus', 'menu_id'], menu_lines: ['menu_items', 'menu_item_id'],
  plan_subscription_usages: ['plan_subscriptions', 'subscription_id'], chat_logs: ['users', 'user_id'],
}
const models: Record<string, string> = {
  'App\\Models\\Store': 'stores', 'App\\Models\\User': 'users', 'App\\Models\\Page': 'pages',
  'App\\Models\\PageComponent': 'page_components', 'App\\Models\\Menu': 'menus',
  'App\\Models\\MenuItem': 'menu_items', 'App\\Models\\MenuLine': 'menu_lines',
  'App\\Models\\Product': 'products', 'App\\Models\\Category': 'categories',
}
// Inventory outside the 20 operational roots: auth/session material is never replayed;
// source-only lookup/support/history remains in the exact manifest-hashed CSV snapshot.
const sourceOnlyTables: Record<string, string> = {
  oauth_access_tokens: 'MASTER-3.2-AUTH-NO-REPLAY', oauth_auth_codes: 'MASTER-3.2-AUTH-NO-REPLAY',
  oauth_clients: 'MASTER-3.2-AUTH-NO-REPLAY', oauth_personal_access_clients: 'MASTER-3.2-AUTH-NO-REPLAY',
  oauth_refresh_tokens: 'MASTER-3.2-AUTH-NO-REPLAY', password_resets: 'MASTER-3.2-AUTH-NO-REPLAY',
  service_tokens: 'MASTER-3.2-AUTH-NO-REPLAY', migrations: 'MASTER-2.2-SOURCE-BOOKKEEPING',
  import_histories: 'MASTER-2.2-SOURCE-BOOKKEEPING', import_history_details: 'MASTER-2.2-SOURCE-BOOKKEEPING',
  chat_logs: 'MASTER-2.2-SOURCE-BOOKKEEPING',
  delivery_providers: 'MASTER-4.1-PROVIDER-LOOKUP', discount_types: 'MASTER-7-LOOKUP',
  promotion_types: 'MASTER-7-LOOKUP', order_statuses: 'MASTER-7-LOOKUP',
  email_template_types: 'MASTER-8.3-TEMPLATE-LOOKUP', postcodes: 'MASTER-6-GEOGRAPHY-LOOKUP',
  frontend_template_categories: 'MASTER-4-TEMPLATE-LOOKUP', icons: 'MASTER-4-TEMPLATE-LOOKUP',
  faq_categories: 'MASTER-2.2-SOURCE-SUPPORT-CONTENT', faqs: 'MASTER-2.2-SOURCE-SUPPORT-CONTENT',
  product_sku_images: 'MASTER-5.2-SKU-IMAGES-SOURCE-ONLY',
}
const userSourceFields = new Set([
  'username', 'backup_email', 'gender', 'company_name', 'introduce', 'address', 'signature', 'birth_day',
  'first_login_status', 'account_type', 'verified_at', 'initial_step1_completed_at',
  'initial_step2_completed_at', 'initial_step3_completed_at', 'initial_step4_completed_at',
  'is_enabled_mfa', 'mfa_type', 'completed_pages_tour', 'completed_menu_tour',
  'completed_add_product_tour', 'completed_delivery_setting_tour',
])

/** Shared structural rule registry. Value-level evidence stays in the hashed source CSV. */
export function classificationParentTables(table: string): readonly string[] {
  if (table === 'plan_subscriptions') return ['stores']
  if (['model_has_roles', 'model_has_permissions', 'model_settings'].includes(table)) return [...new Set(Object.values(models))]
  if (table === 'shortlist_items') return ['page_components']
  return parents[table] ? [parents[table][0]] : []
}
export function classificationRequiresParent(table: string): boolean {
  return table !== 'shortlist_items' && table !== 'product_skus' && classificationParentTables(table).length > 0
}
export function retentionRuleMatches(rule: string, table: string, field: string, owner: Ownership): boolean {
  if (rule === PAGE_MENU_SCOPE_RULE) return PAGE_MENU_TABLES.has(table)
  if (rule === TECHNICAL_SCOPE_RULE) return TECHNICAL_TABLES.has(table)
  if (rule === MODEL_SETTINGS_RETAIN_RULE) return table === 'model_settings'
  if (rule === MODEL_SETTINGS_SCOPE_RULE) return table === 'model_settings'
  if (!SOURCE_HEADERS[table]?.includes(field)) return false
  if (rule === SOURCE_EXCLUSION_RULE) return true // Full root/family proof is checked separately.
  if (owner.rule.startsWith('OWNERSHIP_')) return false
  if (rule === CONFLICT_RETENTION_RULE) return conflictRetentionField(table, field)
  if (rule === PRODUCT_EXCLUSION_RULE || rule === PRODUCT_CATALOG_EXCLUSION_RULE) return ['products','product_skus','product_attributes','product_variants','product_images','product_sku_images','product_sku_promotion_prices','model_settings'].includes(table)
  if (sourceOnlyTables[table] === rule) return true
  if (rule === APPROVED_METADATA_RULE) return approvedMetadataField(table, field)
  if (rule === MAPPED_ORDER_METADATA_RULE) return ['orders','order_details'].includes(table)
  if (rule === EXCLUDED_DISCOUNT_RULE) return ['promotions','promotion_codes'].includes(table)
  if (rule === ADDRESS_OVERFLOW_RULE) return table === 'addresses'
  if (rule === STORE_CODES_RULE) return table === 'store_codes'
  if (rule === MEDIA_METADATA_RULE) return table === 'medias'
  if (rule === 'MASTER-4-SOCIAL-SOURCE-METADATA') return table === 'stores' && field === 'social_channel'
  if (rule === EXTERNAL_SOURCE_RULE) return externalSourceField(table, field)
  switch (rule) {
    case 'MASTER-2.2-EXISTING-SOURCE-RETENTION': return ARCHIVE_TABLES.has(table)
    case 'MASTER-3.4-GLOBAL-USER-DEPENDENCY': return table === 'users' && owner.storeId === null
    case 'MASTER-3.4-ROLE-SOURCE-EVIDENCE': return table === 'model_has_roles'
    case 'MASTER-3.2-USER-METADATA-SOURCE-ONLY': return table === 'users' && userSourceFields.has(field)
    case 'MASTER-3.2-OPTIONAL-AVATAR-ABSENT': return table === 'users' && field === 'profile_picture'
    case 'MASTER-2.3-LIVE-ROW-EVIDENCE': return field === 'deleted_at'
    case 'MASTER-9.1-TRIAL-SOURCE-EVIDENCE': return table === 'plan_subscriptions' && field === 'trial_ends_at'
    case 'MASTER-4.1-APPROVED-SHIPPING-SOURCE': return table === 'store_deliveries'
    case 'MASTER-17-COD-NON-GATEWAY-METADATA': return table === 'store_payments' && !['payment_method_id', 'status'].includes(field)
    default: return false
  }
}

export function createSourceClassifier(tables: Readonly<Record<string, Row[]>>, config: SourceConfig, diagnostics: Diagnostic[], mappedOrders: ReadonlySet<string> = new Set()) {
  const byId = new Map(Object.entries(tables).map(([table, rows]) => [table, new Map(rows.filter(r => r.id).map(r => [r.id!, r]))]))
  const cache = new WeakMap<Row, Ownership>()
  const lookup = (table: string, id: string | null | undefined) => id ? byId.get(table)?.get(id) : undefined
  function ownership(table: string, row: Row, trail = new Set<Row>()): Ownership {
    const cached = cache.get(row); if (cached) return cached
    if (trail.has(row)) return { storeId: null, rule: 'OWNERSHIP_CYCLE' }
    const next = new Set(trail); next.add(row)
    const direct = table === 'stores' ? row.id : row.store_id
    let parent = parents[table]
    let parentId = parent ? row[parent[1]] : undefined
    if (table === 'plan_subscriptions') {
      if (row.subscribable_type === 'App\\Models\\Store') { parent = ['stores', 'subscribable_id']; parentId = row.subscribable_id }
      else return { storeId: null, rule: 'OWNERSHIP_MODEL_UNVERIFIED' }
    }
    if (['model_has_roles', 'model_has_permissions', 'model_settings'].includes(table)) {
      const model = models[row.model_type ?? '']
      if (!model) return table === 'model_settings' && direct && lookup('stores', direct) ? { storeId: direct, rule: 'SOURCE_SETTING_STORE_ID' } : { storeId: null, rule: 'OWNERSHIP_MODEL_UNVERIFIED' }
      parent = [model, 'model_id']; parentId = row.model_id
    }
    if (table === 'shortlist_items' && row.page_component_id) { parent = ['page_components', 'page_component_id']; parentId = row.page_component_id }
    let result: Ownership
    if (parent) {
      const sourceParent = lookup(parent[0], parentId)
      const owner = sourceParent ? ownership(parent[0], sourceParent, next) : undefined
      if (!owner || owner.rule.startsWith('OWNERSHIP_')) result = { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: parent[0], ...(parentId ? { parentId } : {}) }
      else if (direct && direct !== owner.storeId) result = { storeId: null, rule: 'OWNERSHIP_STORE_CONFLICT', parentTable: parent[0], parentId: parentId! }
      else result = { storeId: owner.storeId, rule: 'SOURCE_PARENT_RELATION', parentTable: parent[0], parentId: parentId! }
    } else if (direct) {
      result = lookup('stores', direct) ? { storeId: direct, rule: 'SOURCE_STORE_ID' } : { storeId: null, rule: 'OWNERSHIP_STORE_MISSING' }
    } else result = { storeId: null, rule: 'SOURCE_GLOBAL_SCOPE' }
    if (table === 'model_settings' && result.rule.startsWith('OWNERSHIP_') && direct && lookup('stores', direct)) result = { storeId: direct, rule: 'SOURCE_SETTING_STORE_ID' }
    cache.set(row, result); return result
  }

  const excludedDiscountCodes = new Set(diagnostics.filter(excludedDiscountDiagnostic).map(d => JSON.stringify([d.storeId,d.sourceId])))
  const promotionCodes = new Map<string, Row[]>()
  for (const code of tables.promotion_codes ?? []) { const parentId = code.promotion_id ?? ''; const list = promotionCodes.get(parentId) ?? []; list.push(code); promotionCodes.set(parentId,list) }
  const addressOverflow = new Set(diagnostics.filter(d => d.code === 'CUSTOMER_ADDRESS_OVERFLOW' && d.table === 'addresses' && d.severity === 'warning').map(d => JSON.stringify([d.storeId,d.sourceId])))
  const conflicts = createConflictRetention(config.migrationPolicy)
  diagnostics.forEach(d => conflicts.add(d))
  const sourceOnlyMedia = new Set(diagnostics.filter(d => d.code === 'MEDIA_SOURCE_ONLY' && d.table === 'medias' && d.severity === 'warning').map(d => JSON.stringify([d.storeId,d.sourceId])))
  function retention(table: string, row: Row, field: string, owner: Ownership): string | undefined {
    if (PAGE_MENU_TABLES.has(table)) return PAGE_MENU_SCOPE_RULE
    if (TECHNICAL_TABLES.has(table)) return TECHNICAL_SCOPE_RULE
    if (table === 'model_settings') return MODEL_SETTINGS_RETAIN_RULE
    if (!SOURCE_HEADERS[table]?.includes(field) || owner.rule.startsWith('OWNERSHIP_')) return undefined
    if (config.migrationPolicy?.skipInvalidDiscountCodes && ((table === 'promotion_codes' && excludedDiscountCodes.has(JSON.stringify([owner.storeId,row.id]))) || (table === 'promotions' && (promotionCodes.get(row.id ?? '')?.length ?? 0) > 0 && promotionCodes.get(row.id ?? '')!.every(code => excludedDiscountCodes.has(JSON.stringify([owner.storeId,code.id])))))) return EXCLUDED_DISCOUNT_RULE
    if (table === 'addresses' && config.migrationPolicy?.allowCustomerAddressOverflow && addressOverflow.has(JSON.stringify([owner.storeId,row.id]))) return ADDRESS_OVERFLOW_RULE
    if (approvedMetadataField(table, field)) return APPROVED_METADATA_RULE
    if ((table === 'orders' && mappedOrders.has(row.id ?? '')) || (table === 'order_details' && mappedOrders.has(row.order_id ?? ''))) return MAPPED_ORDER_METADATA_RULE
    if (table === 'store_codes') return STORE_CODES_RULE
    if (conflicts.allows(table, row.id ?? '', field, owner)) return CONFLICT_RETENTION_RULE
    if (table === 'medias' && (['id','store_id','signature','type','parent_id','created_by','deleted_at'].includes(field) || sourceOnlyMedia.has(JSON.stringify([owner.storeId,row.id])))) return MEDIA_METADATA_RULE
    if (table === 'stores' && field === 'social_channel') return 'MASTER-4-SOCIAL-SOURCE-METADATA'
    if (sourceOnlyTables[table]) return sourceOnlyTables[table]
    if (ARCHIVE_TABLES.has(table)) return 'MASTER-2.2-EXISTING-SOURCE-RETENTION'
    if (table === 'users' && !owner.storeId) return 'MASTER-3.4-GLOBAL-USER-DEPENDENCY'
    if (table === 'model_has_roles') return 'MASTER-3.4-ROLE-SOURCE-EVIDENCE'
    if (table === 'users' && userSourceFields.has(field)) return 'MASTER-3.2-USER-METADATA-SOURCE-ONLY'
    if (table === 'users' && field === 'profile_picture' && (row[field] === '' || row[field] === null)) return 'MASTER-3.2-OPTIONAL-AVATAR-ABSENT'
    if (field === 'deleted_at' && !row.deleted_at) return 'MASTER-2.3-LIVE-ROW-EVIDENCE'
    if (table === 'plan_subscriptions' && field === 'trial_ends_at') return 'MASTER-9.1-TRIAL-SOURCE-EVIDENCE'
    if (table === 'store_deliveries' && config.migrationPolicy?.shippingPolicy === 'pw2-defaults') return 'MASTER-4.1-APPROVED-SHIPPING-SOURCE'
    if (table === 'store_payments' && lookup('payment_methods', row.payment_method_id)?.code === 'cod' &&
      !['payment_method_id', 'status'].includes(field)) return 'MASTER-17-COD-NON-GATEWAY-METADATA'
    return undefined
  }
  return { ownership, retention }
}
