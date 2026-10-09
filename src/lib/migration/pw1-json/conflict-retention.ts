/** Evidence-bound CSV retention shared with the importer. No source values are embedded. */
export const CONFLICT_RETENTION_RULE = 'MASTER-5.2-REVIEWED-CONFLICT-SOURCE'
type Policy = { resolveDuplicateVariantTuples?: boolean; pruneInvalidVariantSkus?: boolean; pruneUnreferencedTiers?: boolean; treatSingleSkuWithoutSelectionsAsSimple?: boolean }
type Diagnostic = { code: string; severity: string; storeId?: string; sourceId?: string; table?: string; field?: string; reason?: string }
type Owner = { storeId: string | null; rule: string; parentTable?: string; parentId?: string }
const fieldSets: Record<string, Set<string>> = {
  product_skus: new Set(['id','store_id','product_id','sku','stock','price','cost','status','created_by','created_at','updated_at','deleted_at']),
  product_variants: new Set(['id','product_sku_id','attribute_id','attribute_value_id','created_by','created_at','updated_at','deleted_at']),
  product_attributes: new Set(['id','product_id','attribute_id','attribute_value_id','created_by','created_at','updated_at','deleted_at']),
}
export function conflictRetentionField(table: string, field: string): boolean { return fieldSets[table]?.has(field) ?? false }
export function createConflictRetention(policy?: Policy) {
  const aliases = new Set<string>(), pruned = new Set<string>(), definitions = new Set<string>()
  const key = (storeId: string, sourceId: string) => JSON.stringify([storeId, sourceId])
  return {
    add(d: Diagnostic) {
      if (d.severity !== 'warning' || !d.storeId || !d.sourceId || d.field) return
      const id = key(d.storeId, d.sourceId)
      if (policy?.resolveDuplicateVariantTuples && d.table === 'product_skus' && d.code === 'DUPLICATE_VARIANT_TUPLE_RESOLVED' && d.reason === 'CANONICAL_SKU_ALIAS') aliases.add(id)
      if (policy?.pruneInvalidVariantSkus && d.table === 'product_skus' && d.code === 'PRODUCT_VARIANT_SKU_EXCLUDED' && ['MISSING_SELECTION','DUPLICATE_SELECTION','OUT_OF_DOMAIN','SOURCE_SELECTED_TIER_COUNT'].includes(d.reason ?? '')) pruned.add(id)
      if (d.table === 'product_attributes' && d.code === 'PRODUCT_VARIANT_DEFINITION_RETAINED' && ((policy?.pruneUnreferencedTiers && d.reason === 'UNREFERENCED_TIER') || (policy?.treatSingleSkuWithoutSelectionsAsSimple && d.reason === 'SIMPLE_PRODUCT_ATTRIBUTES'))) definitions.add(id)
    },
    allows(table: string, sourceId: string, field: string, owner: Owner): boolean {
      if (!owner.storeId || owner.rule !== 'SOURCE_PARENT_RELATION' || !conflictRetentionField(table, field)) return false
      const id = key(owner.storeId, sourceId)
      if (table === 'product_skus' && owner.parentTable === 'products') return aliases.has(id) || pruned.has(id)
      if (table === 'product_variants' && owner.parentTable === 'product_skus' && owner.parentId) return pruned.has(key(owner.storeId, owner.parentId))
      return table === 'product_attributes' && owner.parentTable === 'products' && definitions.has(id)
    },
  }
}
