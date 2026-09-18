import { reviewCategory } from './export-outcome'
import { z } from 'zod'
import { SITES_VALID_SITE_TYPES } from '../../ai/site-type'
import { checksum } from './projection'
import { MigrationError } from './errors'
import type { ImportDiagnostic } from './types'
import { CLASSIFIED_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH, isClassifiedMappingHash } from './classification'

export const migrationPolicySchema = z.object({
  decisionEvidence: z.string().trim().min(1).max(4096),
  preserveHistoricalOrders: z.boolean(), promoteActiveCategoriesToRoot: z.boolean(),
  deferredStoreIds: z.array(z.string().regex(/^[1-9]\d*$/)).refine(ids => new Set(ids).size === ids.length),
  activeCatalogOnly: z.boolean(), deferEmailTemplates: z.boolean(), allowSparseVariants: z.boolean(),
  preserveUserCreators: z.boolean(), siteTypeDefault: z.literal('ecommerce'),
  siteTypeOverrides: z.record(z.string().regex(/^[0-9]+$/), z.enum(SITES_VALID_SITE_TYPES)),
  shippingPolicy: z.enum(['pw2-defaults', 'review']),
}).strict()
type Policy = z.infer<typeof migrationPolicySchema>
type Disposition = 'BLOCKED' | 'OUT_OF_SCOPE' | 'APPROVED_POLICY' | 'INFORMATIONAL' | 'TARGET_CHECK_REQUIRED'
export interface DiagnosticBucket { diagnostic: ImportDiagnostic; count: number; disposition: Disposition; samples: ImportDiagnostic[] }
export interface DiagnosticSummary { total: number; rawBlockers: number; rawWarnings: number; blockingCount: number; buckets: DiagnosticBucket[] }
const pageTables = new Set(['pages', 'page_components', 'banners', 'shortlist_items', 'frontend_components'])
const pageCodes = new Set(['RAW_FIELD_UNVERIFIED', 'RAW_VALUE_UNVERIFIED', 'RAW_COMPONENT_DEFINITION_MISSING', 'SOURCE_FIELDS_UNRESOLVED'])
const NEW_CONTRACT = '8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9'
// Reviewed handoff policy, not trust in an arbitrary decisionEvidence string.
export const APPROVED_POLICY = 'f8e1eb46907f573d5a9908b584193c9376d074dcb130e6e85e1dc5db3497bc0f'
const APPROVED_EXCLUSIONS = 'de8f32afe6fbc966a17c9173686ea88c98e6946a8404bc280e6c862054b1f5ed'
interface Context { classificationFinal?: boolean; onTargetCheck?: (diagnostic: ImportDiagnostic) => void; selected?: ReadonlySet<string>; policy?: Policy; contractHash: string; acceptedExclusions?: unknown; classify?: (diagnostic: ImportDiagnostic) => 'OUT_OF_SCOPE' | undefined }
function disposition(d: ImportDiagnostic, ctx: Context): Disposition {
  const classified = isClassifiedMappingHash(ctx.contractHash) ? ctx.classify?.(d) : undefined
  if (classified) return classified
  if (d.storeId && ctx.selected && !ctx.selected.has(d.storeId)) return 'OUT_OF_SCOPE'
  if (d.table && pageTables.has(d.table) && pageCodes.has(d.code)) return 'OUT_OF_SCOPE'
  if ([OUTCOME_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH].includes(ctx.contractHash) && reviewCategory(d) === 'delegated_content') return 'APPROVED_POLICY'
  if (d.code === 'RAW_SECRET_EXCLUDED' && d.severity === 'warning') return 'INFORMATIONAL'
  if (![NEW_CONTRACT, CLASSIFIED_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH].includes(ctx.contractHash)) return 'BLOCKED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.storeId && d.sourceId && d.code === 'ORDER_PAYMENT_METHOD_UNVERIFIED' && d.severity === 'warning' && d.table === 'orders' && d.field === 'payment_method_id' && !d.reason) return 'TARGET_CHECK_REQUIRED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.storeId && d.sourceId && d.code === 'RAW_VALUE_UNVERIFIED' && d.severity === 'blocker' && d.reason === 'UNSAFE_URL' && d.table === 'products' && ['description','description_ms'].includes(d.field ?? '')) return 'TARGET_CHECK_REQUIRED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.code === 'SUBSCRIPTION_CANCEL_FLAG_ABSENT' && d.severity === 'warning' && d.storeId && d.sourceId && d.table === 'plan_subscriptions' && d.field === 'canceled_immediately' && d.reason === 'NO_CANCELLATION_DATE') return 'TARGET_CHECK_REQUIRED'
  if (d.code === 'TARGET_USER_CREATOR_BINDING_REQUIRED' && d.severity === 'blocker' && d.storeId && d.table === 'users' && d.field === 'created_by' && !d.reason) return 'TARGET_CHECK_REQUIRED'
  if (d.severity === 'blocker' && !d.reason && d.storeId && (
    (d.code === 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP' && d.table === 'products' && d.field === 'slug') ||
    (d.code === 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED' && ['blogs', 'blog_posts', 'blog_categories'].includes(d.table ?? '') && d.field === 'slug')
  )) return 'TARGET_CHECK_REQUIRED'
  if (d.code === 'ACCEPTED_SCOPE_EXCLUSION' && d.severity === 'warning' && !d.storeId && !d.field && !d.reason && ['notifications','subscribers','contact-submissions','analytics'].includes(d.table ?? '') && checksum(ctx.acceptedExclusions) === APPROVED_EXCLUSIONS) return 'APPROVED_POLICY'
  if (!ctx.policy || checksum(ctx.policy) !== APPROVED_POLICY || d.severity !== 'warning' || !d.storeId) return 'BLOCKED'
  if (d.sourceId && ctx.policy.activeCatalogOnly && d.code === 'PRODUCT_INACTIVE_SKUS_EXCLUDED' && d.table === 'products' && !d.field && !d.reason) return 'APPROVED_POLICY'
  if (d.sourceId && ctx.policy.preserveHistoricalOrders && d.code === 'ORDER_ITEM_CATALOG_REFERENCE_OMITTED' && (
    (d.table === 'order_details' && d.field === 'product_sku_id' && !d.reason) ||
    (d.table === 'orders' && d.field === 'items.product' && d.reason === 'PRODUCT_SLUG_COLLISION')
  )) return 'APPROVED_POLICY'
  if (d.code === 'SITE_TYPE_POLICY_APPLIED' && d.table === 'stores' && d.field === 'siteType' && d.reason === 'APPROVED_ECOMMERCE_DEFAULT') return 'APPROVED_POLICY'
  if (d.code === 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT' && d.table === 'store_deliveries' && d.field === 'shipping_fee_config' && ['MISSING_OR_UNCONFIGURED_SOURCE','PROVIDER_OR_UNKNOWN_SOURCE_MODE','AMBIGUOUS_SELF_DELIVERY','FIXED_FEE_EXCEEDS_PW2_LIMIT','FIXED_FEE_PRECISION_OR_VALUE_INVALID','LEGACY_TIER_NOT_MAPPED','LEGACY_DYNAMIC_NOT_MAPPED','INVALID_SOURCE_CONFIGURATION'].includes(d.reason ?? '')) return 'APPROVED_POLICY'
  if (d.code === 'SHIPPING_FIXED_FEE_MAPPED' && d.table === 'store_deliveries' && d.field === 'shipping_fee_config' && !d.reason) return 'APPROVED_POLICY'
  if (d.code === 'CATEGORY_INACTIVE_PARENT_PROMOTED' && d.table === 'categories' && d.field === 'parent_id' && !d.reason) return 'APPROVED_POLICY'
  return 'BLOCKED'
}

/** Counters + at most five redacted metadata examples per bucket, never one object per report row. */
export function createDiagnosticCollector(ctx: Context) {
  const buckets = new Map<string, DiagnosticBucket>()
  let total = 0, rawBlockers = 0, rawWarnings = 0, blockingCount = 0, retainedBytes = 0
  return {
    add(d: ImportDiagnostic) {
      if(d.code.length>128||[d.storeId,d.sourceId,d.table,d.field,d.reason].some(value=>value!==undefined&&value.length>512))throw new MigrationError('DIAGNOSTIC_METADATA_LIMIT')
      total++
      // Derived row-coverage blockers do not alter raw exporter diagnostic counts.
      if (!['REPORT_ROW_UNRESOLVED', 'EXPORT_STORE_BLOCKED', 'SOURCE_CLASSIFICATION_INVALID'].includes(d.code)) {
        if (d.severity === 'blocker') rawBlockers++; else rawWarnings++
      }
      const status = disposition(d, ctx)
      if (status === 'BLOCKED' || status === 'TARGET_CHECK_REQUIRED') blockingCount++
      // Export collision diagnostics use the target collection name; runner resolves source identities.
      if (status === 'TARGET_CHECK_REQUIRED' && d.code === 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED' && d.table === 'blogs') d = { ...d, table: 'blog_posts' }
      const { sourceId: _sourceId, count: _count, ...base } = d
      const classifiedIdentity = !ctx.classificationFinal && ctx.classify && (!d.storeId || !ctx.selected || ctx.selected.has(d.storeId)) && (d.table === 'model_settings' ||
        (d.table === 'blog_posts' && d.code === 'RAW_VALUE_UNVERIFIED') ||
        ['SOURCE_FIELDS_UNRESOLVED','REPORT_ROW_UNRESOLVED','PAYMENT_PROVIDER_NOT_ACTIVATED'].includes(d.code) ||
        (!d.storeId && ['SOURCE_OWNERSHIP_UNRESOLVED','SOURCE_FIELDS_UNRESOLVED','REPORT_ROW_UNRESOLVED'].includes(d.code)) ||
        (d.code === 'SOURCE_OWNERSHIP_UNRESOLVED' && pageTables.has(d.table ?? '')) ||
        (d.code === 'RAW_VALUE_UNVERIFIED' && d.reason === 'UNKNOWN_STRUCTURE_KEY' && ['frontend_components','frontend_templates','menu_line_types'].includes(d.table ?? '')))
      if (status === 'TARGET_CHECK_REQUIRED') ctx.onTargetCheck?.(d)
      const group: ImportDiagnostic = (status === 'TARGET_CHECK_REQUIRED' && !ctx.onTargetCheck) || classifiedIdentity ? { ...base, sourceId: d.sourceId } : base
      const key = JSON.stringify([group.code, group.severity, group.storeId, group.table, group.field, group.reason, status, group.sourceId])
      let bucket = buckets.get(key)
      if (!bucket) {
        if (buckets.size >= 100_000) throw new MigrationError('DIAGNOSTIC_BUCKET_LIMIT')
        retainedBytes += 256 + 2 * (key.length + JSON.stringify(group).length)
        bucket = { diagnostic: group, count: 0, disposition: status, samples: [] }
        buckets.set(key, bucket)
      }
      bucket.count++
      if (bucket.samples.length < 5) { retainedBytes += 64 + 2 * JSON.stringify(d).length; bucket.samples.push(d) }
      if(retainedBytes>128*1024*1024)throw new MigrationError('DIAGNOSTIC_MEMORY_LIMIT')
    },
    result() {
      const all = [...buckets.values()].map(bucket => ({ ...bucket,
        diagnostic: ctx.classificationFinal && bucket.count === 1 ? { ...bucket.diagnostic, ...(bucket.samples[0]?.sourceId ? { sourceId: bucket.samples[0].sourceId } : {}) } : bucket.diagnostic,
        disposition: ctx.classificationFinal ? bucket.disposition : disposition(bucket.diagnostic, ctx) }))
      blockingCount = all.filter(bucket => bucket.disposition === 'BLOCKED' || bucket.disposition === 'TARGET_CHECK_REQUIRED').reduce((sum, bucket) => sum + bucket.count, 0)
      return {
        diagnostics: all.map(b => ({ ...b.diagnostic, count: b.count })),
        blockers: all.filter(b => b.disposition === 'BLOCKED' || b.disposition === 'TARGET_CHECK_REQUIRED').map(b => ({ ...b.diagnostic, count: b.count })),
        summary: { total, rawBlockers, rawWarnings, blockingCount, buckets: all } satisfies DiagnosticSummary,
      }
    },
  }
}
