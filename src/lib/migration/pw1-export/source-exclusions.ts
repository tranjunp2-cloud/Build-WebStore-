import { z } from 'zod'
import type { Diagnostic, MigrationPolicy } from './contracts'
import type { RowDisposition } from './source-dispositions'
export const SOURCE_EXCLUSION_CODE = 'SOURCE_ENTITY_EXCLUDED'
export const SOURCE_EXCLUSION_RULE = 'MASTER-APPROVED-SOURCE-ENTITY-EXCLUSION'
const productReasons = new Set(`SOURCE_DUPLICATE_OPTION_DOMAIN SOURCE_DUPLICATE_VARIANT_TUPLE SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH SOURCE_NO_ELIGIBLE_SKU SOURCE_NO_VALID_VARIANT SOURCE_SELECTED_OPTION_INVALID SOURCE_SELECTED_TIER_COUNT SOURCE_SKU_OWNER_MISMATCH SOURCE_SKU_PRICE_INVALID SOURCE_SKU_STATUS_INVALID SOURCE_SKU_STOCK_INVALID SOURCE_SPARSE_VARIANT_MATRIX SOURCE_VARIANT_DOMAIN_MISSING PRODUCT_STATUS_UNVERIFIED PRODUCT_NAME_TOO_SHORT PRODUCT_NAME_TOO_LONG REQUIRED_FIELD_MISSING INVALID_CURRENCY INVALID_NUMBER NUMBER_OUT_OF_RANGE NUMBER_ABOVE_MAX NUMBER_BELOW_MIN COMPARE_AT_PRICE_NOT_GREATER PRODUCT_SKU_TOO_LONG TOO_MANY_PRODUCT_IMAGES PRODUCT_IMAGE_ALT_TOO_LONG TOO_MANY_VARIANT_CONFIGS DUPLICATE_VARIANT_CONFIG_NAME VARIANT_CONFIG_NAME_TOO_LONG VARIANT_OPTION_COUNT_INVALID DUPLICATE_VARIANT_OPTION VARIANT_OPTION_TOO_LONG TOO_MANY_VARIANTS DUPLICATE_VARIANT_NAME DUPLICATE_PRODUCT_SKU VARIANT_SKU_TOO_LONG TOO_MANY_ATTRIBUTES ATTRIBUTE_KEY_TOO_LONG ATTRIBUTE_VALUE_TOO_LONG CATEGORY_CARDINALITY_INVALID CATEGORY_REFERENCE_UNRESOLVED MEDIA_REFERENCE_UNRESOLVED MEDIA_EXTERNAL_URL_INVALID PRODUCT_WEIGHT_INVALID PRODUCT_WEIGHT_UNIT_UNVERIFIED MEDIA_OWNER MEDIA_ID UNSAFE_URL INVALID_URL MISSING_URL URL_QUERY_REQUIRES_REVIEW MISSING_TIMESTAMP INVALID_TIMESTAMP DOCUMENT_SCHEMA_INVALID`.split(' '))
const blogReasons = new Set('BLOG_CATEGORY_NAME_MISSING BLOG_STATUS_UNVERIFIED BLOG_CATEGORY_STATUS_UNVERIFIED CONTENT_TIMESTAMP_INVALID BLOG_TITLE_MISSING BLOG_SLUG_INVALID BLOG_SLUG_COLLISION BLOG_AUTHOR_UNRESOLVED BLOG_CATEGORY_UNRESOLVED BLOG_MEDIA_UNRESOLVED DOCUMENT_SCHEMA_INVALID UNSAFE_URL'.split(' '))
const paymentReasons = new Set('PAYMENT_PROVIDER_UNKNOWN PAYMENT_STATUS_UNKNOWN PAYMENT_PROVIDER_NOT_ACTIVATED COD_CONFIGURATION_AMBIGUOUS'.split(' '))
export function approvedSourceExclusionReason(table: string, reason: string): boolean {
  return table === 'products' ? productReasons.has(reason) : table === 'orders' ? ['ORDER_STATUS_UNVERIFIED', 'APPROVED_NEGATIVE_TOTAL'].includes(reason) : ['blog_posts','blog_categories'].includes(table) ? blogReasons.has(reason) : table === 'store_payments' && paymentReasons.has(reason)
}
export const sourceExclusionSchema = z.object({ table: z.enum(['products','orders','blog_posts','blog_categories','store_payments']), sourceId: z.string().regex(/^[1-9]\d*$/), storeId: z.string().regex(/^[1-9]\d*$/), reason: z.string() }).strict().refine(v => approvedSourceExclusionReason(v.table,v.reason))
export type SourceExclusion = z.infer<typeof sourceExclusionSchema>
export function sourceExclusionEnabled(ex: SourceExclusion, policy?: MigrationPolicy): boolean {
  return ex.table === 'products' ? policy?.excludeInvalidProducts === true : ex.table === 'orders' ? ex.reason === 'APPROVED_NEGATIVE_TOTAL' ? policy?.approvedNegativeTotalOrders?.some(entry => entry.storeId === ex.storeId && entry.orderId === ex.sourceId) === true : policy?.skipUnverifiedOrders === true : ex.table === 'store_payments' ? policy?.omitUnmappablePayments === true : policy?.excludeInvalidBlogs === true
}
export function sourceExclusionDiagnostic(d: Diagnostic): SourceExclusion | undefined {
  if (d.code !== SOURCE_EXCLUSION_CODE || d.severity !== 'warning' || d.field !== undefined) return
  const parsed = sourceExclusionSchema.safeParse({table:d.table,sourceId:d.sourceId,storeId:d.storeId,reason:d.reason})
  return parsed.success ? parsed.data : undefined
}
export const sourceExclusionKey = (table: string, id: string) => JSON.stringify([table,id])
const productFamily = new Set(['products','product_skus','product_attributes','product_variants','product_images','product_sku_images','product_sku_promotion_prices','model_settings'])
export function sourceExclusionFamily(root: string, table: string): boolean {
  return root === 'products' ? productFamily.has(table) : root === 'orders' ? ['orders','order_details','order_status_histories'].includes(table) : root === table
}
/** Validate excluded source families without rewriting failed ownership into a valid tenant relation. */
export function validateSourceExclusions(rows: readonly RowDisposition[], diagnostics: readonly Diagnostic[], policy: MigrationPolicy | undefined, emittedRefs: ReadonlySet<string>, enabled: boolean, fail: () => never): Set<string> {
  const proofRows=rows.filter(row=>row.sourceExclusion)
  if(proofRows.length>100_000)fail()
  const index = new Map(proofRows.map(row => [sourceExclusionKey(row.table,row.sourceId),row]))
  const warnings = new Map<string,SourceExclusion>()
  const accepted = new Set<string>()
  for (const d of diagnostics) {
    if (d.code !== SOURCE_EXCLUSION_CODE) continue
    const ex = sourceExclusionDiagnostic(d)
    if (!enabled || !ex || !sourceExclusionEnabled(ex,policy)) fail()
    const key=sourceExclusionKey(ex.table,ex.sourceId)
    if(warnings.has(key) && JSON.stringify(warnings.get(key))!==JSON.stringify(ex)) fail()
    warnings.set(key,ex)
  }
  for (const row of rows) {
    const ex=row.sourceExclusion
    if (!ex) { if(Object.values(row.fieldRetentionRules??{}).includes(SOURCE_EXCLUSION_RULE)) fail();continue }
    if (!enabled || !sourceExclusionSchema.safeParse(ex).success || !sourceExclusionEnabled(ex,policy) || row.productExclusion || !sourceExclusionFamily(ex.table,row.table) || row.disposition!=='retained-source' || row.contributions.length || !row.ownership || Object.entries(row.fields).some(([field,value])=>value!=='security-excluded' && (value!=='retained-source'||row.fieldRetentionRules?.[field]!==SOURCE_EXCLUSION_RULE))) fail()
    const rootKey=sourceExclusionKey(ex.table,ex.sourceId),root=index.get(rootKey)
    if(!root || root.storeId!==ex.storeId || root.ownership?.rule.startsWith('OWNERSHIP_') || JSON.stringify(warnings.get(rootKey))!==JSON.stringify(ex) || JSON.stringify(root.sourceExclusion)!==JSON.stringify(ex)) fail()
    const collection=ex.table==='blog_posts'?'blogs':ex.table
    if(emittedRefs.has(`@${collection}:${ex.table}:${ex.sourceId}`)) fail()
    let cursor:RowDisposition|undefined=row;const seen=new Set<string>()
    while(cursor!==root){
      if(!cursor?.ownership || !cursor.sourceExclusion || JSON.stringify(cursor.sourceExclusion)!==JSON.stringify(ex)) fail()
      const key=sourceExclusionKey(cursor.table,cursor.sourceId);if(seen.has(key))fail();seen.add(key)
      const owner=cursor.ownership
      if(!owner.parentTable||!owner.parentId || !['SOURCE_PARENT_RELATION','OWNERSHIP_STORE_CONFLICT','OWNERSHIP_PARENT_UNVERIFIED'].includes(owner.rule)) fail()
      cursor=index.get(sourceExclusionKey(owner.parentTable,owner.parentId))
    }
    accepted.add(sourceExclusionKey(row.table,row.sourceId))
  }
  for(const key of warnings.keys())if(!accepted.has(key))fail()
  return accepted
}
