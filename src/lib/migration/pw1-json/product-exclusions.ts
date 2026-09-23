import { z } from 'zod'

export const PRODUCT_EXCLUSION_CODE = 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED'
export const PRODUCT_CATALOG_EXCLUSION_CODE = 'PRODUCT_CATALOG_POLICY_EXCLUDED'
export const PRODUCT_CATALOG_EXCLUSION_RULE = 'MASTER-5.2-PRODUCT-CATALOG-POLICY'
export type ProductCatalogPolicy = { excludeDuplicateProductSlugs?: boolean; excludeProductsWithoutValidVariants?: boolean }
export const PRODUCT_EXCLUSION_RULE = 'MASTER-5.2-PRODUCT-MISSING-PRICE-STOCK'
export const productExclusionSchema = z.object({ productId: z.string().regex(/^[1-9]\d*$/), reason: z.enum(['MISSING_PRICE', 'MISSING_STOCK', 'MISSING_PRICE_AND_STOCK', 'NO_SKU_ROWS', 'NO_LIVE_OWNED_SKU', 'DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN']), canonicalProductId: z.string().regex(/^[1-9]\d*$/).optional() }).strict().refine(value => value.reason === 'DUPLICATE_PRODUCT_SLUG' ? Boolean(value.canonicalProductId && BigInt(value.canonicalProductId) < BigInt(value.productId)) : value.canonicalProductId === undefined)
export type ProductExclusion = z.infer<typeof productExclusionSchema>
type Diagnostic = { code: string; severity: string; storeId?: string; sourceId?: string; table?: string; field?: string; reason?: string }
export function isProductExclusionDiagnostic(d: Diagnostic): boolean {
  return (d.code === PRODUCT_EXCLUSION_CODE ? !['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'].includes(d.reason ?? '') : d.code === PRODUCT_CATALOG_EXCLUSION_CODE && ['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'].includes(d.reason ?? '')) && d.severity === 'warning' && d.table === 'products' && !!d.storeId && !!d.sourceId && !d.field && (d.reason === 'DUPLICATE_PRODUCT_SLUG' ? /^[1-9]\d*$/.test(d.sourceId) : productExclusionSchema.safeParse({ productId: d.sourceId, reason: d.reason }).success)
}
export function catalogExclusionAllowed(reason: string | undefined, policy?: ProductCatalogPolicy): boolean {
  return reason === 'DUPLICATE_PRODUCT_SLUG' ? policy?.excludeDuplicateProductSlugs === true : ['NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'].includes(reason ?? '') && policy?.excludeProductsWithoutValidVariants === true
}
export function productExclusionRule(exclusion: ProductExclusion): string { return ['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'].includes(exclusion.reason) ? PRODUCT_CATALOG_EXCLUSION_RULE : PRODUCT_EXCLUSION_RULE }
const family = new Set(['products', 'product_skus', 'product_attributes', 'product_variants', 'product_images', 'product_sku_images', 'product_sku_promotion_prices', 'model_settings'])
type EvidenceRow = { table: string; sourceId: string; storeId: string | null; disposition: string; fields: Record<string,string>; fieldRetentionRules?: Record<string,string>; productExclusion?: ProductExclusion; ownership?: { rule: string; parentTable?: string; parentId?: string }; contributions: { rule:string }[] }
/** Internal consistency proof; source values remain in the manifest-hashed CSV snapshot. */
export function createProductExclusionIndex(fail: () => never, enabled = true, policy?: ProductCatalogPolicy) {
  const rows = new Map<string, EvidenceRow>(), warnings = new Map<string,string>(), emitted = new Set<string>(), sourceProducts = new Map<string, string>()
  const key = (store: string, product: string) => JSON.stringify([store, product])
  return {
    addProduct(store: string, reference: string) { if (emitted.size >= 1_000_000) fail(); emitted.add(key(store, reference.replace(/^@products:products:/, ''))) },
    addDiagnostic(d: Diagnostic) {
      if (![PRODUCT_EXCLUSION_CODE, PRODUCT_CATALOG_EXCLUSION_CODE].includes(d.code)) return
      if (d.code === PRODUCT_CATALOG_EXCLUSION_CODE && !catalogExclusionAllowed(d.reason, policy)) fail()
      if (!enabled || !isProductExclusionDiagnostic(d)) fail()
      const identity = key(d.storeId!, d.sourceId!)
      if (warnings.size >= 100_000 || (warnings.has(identity) && warnings.get(identity) !== d.reason)) fail()
      warnings.set(identity, d.reason!)
    },
    addRow(row: EvidenceRow) {
      if (row.table === 'products' && row.storeId) { if (sourceProducts.size >= 1_000_000) fail(); sourceProducts.set(row.sourceId, row.storeId) }
      const rules = Object.values(row.fieldRetentionRules ?? {})
      if (!row.productExclusion) { if ([PRODUCT_EXCLUSION_RULE, PRODUCT_CATALOG_EXCLUSION_RULE].some(rule => rules.includes(rule))) fail(); return }
      if (row.productExclusion && productExclusionRule(row.productExclusion) === PRODUCT_CATALOG_EXCLUSION_RULE && !catalogExclusionAllowed(row.productExclusion.reason, policy)) fail()
      if (!enabled || !productExclusionSchema.safeParse(row.productExclusion).success || !row.storeId || !family.has(row.table) || !row.ownership || row.ownership.rule.startsWith('OWNERSHIP_') || row.disposition !== 'retained-source' || row.contributions.length || Object.entries(row.fields).some(([field,value]) => value !== 'security-excluded' && (value !== 'retained-source' || row.fieldRetentionRules?.[field] !== productExclusionRule(row.productExclusion!)))) fail()
      if (rows.size >= 100_000) fail()
      const id = JSON.stringify([row.table,row.sourceId]); if (rows.has(id)) fail()
      // Keep only compact identities and parent proof, not every field/contribution.
      rows.set(id, { ...row, fields: {}, fieldRetentionRules: undefined, contributions: [] })
    },
    finish() {
      for (const row of rows.values()) {
        const ex = row.productExclusion!, k = key(row.storeId!,ex.productId)
        const product = rows.get(JSON.stringify(['products',ex.productId]))
        if (!product || product.storeId !== row.storeId || product.productExclusion?.reason !== ex.reason || product.productExclusion?.canonicalProductId !== ex.canonicalProductId || warnings.get(k) !== ex.reason || emitted.has(k)) fail()
        if (row.table === 'products' && row.sourceId !== ex.productId) fail()
        if (ex.canonicalProductId && sourceProducts.get(ex.canonicalProductId) !== row.storeId) fail()
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
      rows.clear();warnings.clear();emitted.clear();sourceProducts.clear()
    },
  }
}
