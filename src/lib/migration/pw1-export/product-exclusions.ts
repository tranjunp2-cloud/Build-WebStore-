import { z } from 'zod'
import type { MigrationPolicy } from './contracts'

export const PRODUCT_EXCLUSION_CODE = 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED'
export const PRODUCT_CATALOG_EXCLUSION_CODE = 'PRODUCT_CATALOG_POLICY_EXCLUDED'
export const PRODUCT_CATALOG_EXCLUSION_RULE = 'MASTER-5.2-PRODUCT-CATALOG-POLICY'
const catalogReasons = new Set(['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN', 'INACTIVE_CATEGORY'])
export const PRODUCT_EXCLUSION_RULE = 'MASTER-5.2-PRODUCT-MISSING-PRICE-STOCK'
export const productExclusionSchema = z.object({ productId: z.string().regex(/^[1-9]\d*$/), reason: z.enum(['MISSING_PRICE', 'MISSING_STOCK', 'MISSING_PRICE_AND_STOCK', 'NO_SKU_ROWS', 'NO_LIVE_OWNED_SKU', 'DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN', 'INACTIVE_CATEGORY']), canonicalProductId: z.string().regex(/^[1-9]\d*$/).optional() }).strict().refine(v => v.reason === 'DUPLICATE_PRODUCT_SLUG' ? !!v.canonicalProductId && /^[1-9]\d*$/.test(v.canonicalProductId) && /^[1-9]\d*$/.test(v.productId) && BigInt(v.canonicalProductId) < BigInt(v.productId) : v.canonicalProductId === undefined)
export type ProductExclusion = z.infer<typeof productExclusionSchema>
type Diagnostic = { code: string; severity: string; storeId?: string; sourceId?: string; table?: string; field?: string; reason?: string }
export function isProductExclusionDiagnostic(d: Diagnostic): boolean {
  return (d.code === PRODUCT_EXCLUSION_CODE || d.code === PRODUCT_CATALOG_EXCLUSION_CODE) && d.severity === 'warning' && d.table === 'products' && !!d.storeId && !!d.sourceId && !d.field && (d.code === PRODUCT_CATALOG_EXCLUSION_CODE ? catalogReasons.has(d.reason ?? '') : productExclusionSchema.safeParse({ productId: d.sourceId, reason: d.reason }).success && !catalogReasons.has(d.reason ?? ''))
}
const family = new Set(['products', 'product_skus', 'product_attributes', 'product_variants', 'product_images', 'product_sku_images', 'product_sku_promotion_prices', 'model_settings'])
type EvidenceRow = { table: string; sourceId: string; storeId: string | null; disposition: string; fields: Record<string,string>; fieldRetentionRules?: Record<string,string>; productExclusion?: ProductExclusion; ownership?: { rule: string; parentTable?: string; parentId?: string }; contributions: { rule:string }[] }
/** Internal consistency proof; source values remain in the manifest-hashed CSV snapshot. */
export function createProductExclusionIndex(fail: () => never, enabled = true, policy?: MigrationPolicy) {
  const roots = new Map<string, string | null>()
  const allowed = (reason: string) => !catalogReasons.has(reason) || (reason === 'INACTIVE_CATEGORY' ? policy?.excludeProductsInInactiveCategories === true : reason === 'DUPLICATE_PRODUCT_SLUG' ? policy?.excludeDuplicateProductSlugs === true : policy?.excludeProductsWithoutValidVariants === true)
  const rows = new Map<string, EvidenceRow>(), warnings = new Map<string,string>(), emitted = new Set<string>()
  const key = (store: string, product: string) => JSON.stringify([store, product])
  return {
    addProduct(store: string, reference: string) { if (emitted.size >= 1_000_000) fail(); emitted.add(key(store, reference.replace(/^@products:products:/, ''))) },
    addDiagnostic(d: Diagnostic) {
      if (d.code !== PRODUCT_EXCLUSION_CODE && d.code !== PRODUCT_CATALOG_EXCLUSION_CODE) return
      if (!enabled || !isProductExclusionDiagnostic(d) || !allowed(d.reason ?? '')) fail()
      const identity = key(d.storeId!, d.sourceId!)
      if (warnings.size >= 100_000 || (warnings.has(identity) && warnings.get(identity) !== d.reason)) fail()
      warnings.set(identity, d.reason!)
    },
    addRow(row: EvidenceRow) {
      if (row.table === 'products') { if (roots.size >= 1_000_000) fail(); roots.set(row.sourceId, row.storeId) }
      const rule = row.productExclusion && catalogReasons.has(row.productExclusion.reason) ? PRODUCT_CATALOG_EXCLUSION_RULE : PRODUCT_EXCLUSION_RULE
      const rules = Object.values(row.fieldRetentionRules ?? {})
      if (!row.productExclusion) { if ((rules.includes(PRODUCT_EXCLUSION_RULE) || rules.includes(PRODUCT_CATALOG_EXCLUSION_RULE))) fail(); return }
      if (!enabled || !productExclusionSchema.safeParse(row.productExclusion).success || !allowed(row.productExclusion.reason) || !row.storeId || !family.has(row.table) || !row.ownership || row.ownership.rule.startsWith('OWNERSHIP_') || row.disposition !== 'retained-source' || row.contributions.length || Object.entries(row.fields).some(([field,value]) => value !== 'security-excluded' && (value !== 'retained-source' || row.fieldRetentionRules?.[field] !== rule))) fail()
      if (rows.size >= 100_000) fail()
      const id = JSON.stringify([row.table,row.sourceId]); if (rows.has(id)) fail()
      // Keep only compact identities and parent proof, not every field/contribution.
      rows.set(id, { ...row, fields: {}, fieldRetentionRules: undefined, contributions: [] })
    },
    finish() {
      for (const row of rows.values()) {
        const ex = row.productExclusion!, k = key(row.storeId!,ex.productId)
        const product = rows.get(JSON.stringify(['products',ex.productId]))
        if (!product || product.storeId !== row.storeId || product.productExclusion?.reason !== ex.reason || warnings.get(k) !== ex.reason || emitted.has(k)) fail()
        if (ex.canonicalProductId !== product.productExclusion?.canonicalProductId || (ex.canonicalProductId && roots.get(ex.canonicalProductId) !== row.storeId)) fail()
        if (row.table === 'products' && row.sourceId !== ex.productId) fail()
        if (row.table !== 'products') {
          const owner = row.ownership!
          const parent = rows.get(JSON.stringify([owner.parentTable,owner.parentId]))
          if (row.table === 'product_skus' && (owner.parentTable !== 'products' || owner.parentId !== ex.productId)) fail()
          if (owner.rule !== 'SOURCE_PARENT_RELATION' || !parent || parent.productExclusion?.productId !== ex.productId || parent.storeId !== row.storeId) fail()
        }
      }
      for (const [k,reason] of warnings) {
        const [store,productId] = JSON.parse(k) as [string,string]
        const product = rows.get(JSON.stringify(['products',productId]))
        if (!product || product.storeId !== store || product.productExclusion?.reason !== reason) fail()
      }
      rows.clear();warnings.clear();emitted.clear();roots.clear()
    },
  }
}
