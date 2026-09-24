import { SOURCE_HEADERS } from './source-registry'
export const APPROVED_METADATA_RULE = 'MASTER-2.2-APPROVED-SOURCE-METADATA'
export const MAPPED_ORDER_METADATA_RULE = 'MASTER-7-MAPPED-ORDER-SOURCE-METADATA'
export const TECHNICAL_SCOPE_RULE = 'MASTER-2.2-TECHNICAL-OUTSIDE-SCOPE'
export const TECHNICAL_SCOPE_CODE = 'SOURCE_TABLE_OUTSIDE_SCOPE'
export const ADDRESS_OVERFLOW_RULE = 'MASTER-6-ADDRESS-OVERFLOW-SOURCE-ONLY'
export const EXCLUDED_DISCOUNT_RULE = 'MASTER-7-EXCLUDED-DISCOUNT-SOURCE'
export function excludedDiscountDiagnostic(d: { code: string; table?: string; severity: string; storeId?: string; sourceId?: string; field?: string; reason?: string }): boolean {
  return d.table === 'promotion_codes' && d.severity === 'warning' && !!d.storeId && !!d.sourceId && d.field === undefined && d.reason === undefined && ['DISCOUNT_MAPPING_INVALID','DISCOUNT_CODE_COLLISION'].includes(d.code)
}
export const STORE_CODES_RULE = 'MASTER-2.2-STORE-CODES-SOURCE-ONLY'
export const PAGE_MENU_SCOPE_RULE = 'MASTER-PAGE-MENU-RAW-SOURCE'
export const PAGE_MENU_SCOPE_CODE = 'PAGE_MENU_RAW_SOURCE_ONLY'
export const PAGE_MENU_TABLES = new Set(['pages','page_components','banners','shortlist_items','menus','menu_items','menu_lines','frontend_components','frontend_templates','menu_line_types'])
export const TECHNICAL_TABLES = new Set(['queue_sync', 'model_exports'])
const metadata: Record<string, readonly string[]> = {
  addresses: ['phone', 'full_address', 'comment', 'created_at', 'updated_at'],
  product_skus: ['cost', 'created_at', 'updated_at'],
  product_attributes: ['created_at', 'updated_at'],
  product_variants: ['created_at', 'updated_at'],
  promotions: ['name_ms', 'slug', 'description_ms', 'image', 'signature', 'type_id', 'is_max_discount_value', 'max_discount_value', 'is_min_payment', 'min_payment', 'limit_per_user'],
  promotion_codes: ['used'],
}
/** Only target-unsupported fields; no blanket waiver of missing source relations or operational fields. */
export function approvedMetadataField(table: string, field: string): boolean {
  if (table === 'medias' || !SOURCE_HEADERS[table]?.includes(field)) return false
  return (field === 'created_by' && table !== 'users') || field === 'signature' || field.endsWith('_signature') || (metadata[table]?.includes(field) ?? false)
}
