import { isProductExclusionDiagnostic, PRODUCT_CATALOG_EXCLUSION_CODE, catalogExclusionAllowed } from './product-exclusions'
import { reviewCategory } from './export-outcome'
import { z } from 'zod'
import { SITES_VALID_SITE_TYPES } from '../../ai/site-type'
import { checksum } from './projection'
import { MigrationError } from './errors'
import type { ImportDiagnostic } from './types'
import { CLASSIFIED_MAPPING_HASH, SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH, isClassifiedMappingHash } from './classification'

// Reserved draft policies: artifact parsing accepts disabled values only.
export const PENDING_POLICY_KEYS = [
  'gracefulTenantResolution',
  'resolveDuplicateSkus',
  'resolveDuplicateVariantTuples',
  'treatSingleSkuWithoutSelectionsAsSimple',
  'pruneUnreferencedTiers',
  'allowInactiveSkusForInactiveProduct',
  'resolveDuplicateCategorySlugs',
  'resolveDuplicateCategoryNames',
  'flattenBlogCategoriesToRoot',
  'resolveDuplicateBlogCategorySlugs',
  'resolveDuplicateBlogSlugs',
  'allowCustomerAddressOverflow',
  'allowInvalidCustomerAddresses',
  'allowHistoricalDiscountEligibilityGap',
  'preserveRefundedOrdersWithoutEvidence',
  'skipInvalidDiscountCodes',
  'skipUnverifiedOrders',
  'allowUnresolvedBlogMedia',
  'fallbackBlogAuthorToOwner',
  'allowContactStructureGap',
  'allowBracketedProductNames',
] as const

export const migrationPolicySchema = z.object({
  gracefulTenantResolution: z.literal(false).optional(),
  resolveDuplicateSkus: z.literal(false).optional(),
  resolveDuplicateVariantTuples: z.literal(false).optional(),
  treatSingleSkuWithoutSelectionsAsSimple: z.literal(false).optional(),
  pruneUnreferencedTiers: z.literal(false).optional(),
  allowInactiveSkusForInactiveProduct: z.literal(false).optional(),
  resolveDuplicateCategorySlugs: z.literal(false).optional(),
  resolveDuplicateCategoryNames: z.literal(false).optional(),
  flattenBlogCategoriesToRoot: z.literal(false).optional(),
  resolveDuplicateBlogCategorySlugs: z.literal(false).optional(),
  resolveDuplicateBlogSlugs: z.literal(false).optional(),
  allowCustomerAddressOverflow: z.literal(false).optional(),
  allowInvalidCustomerAddresses: z.literal(false).optional(),
  allowHistoricalDiscountEligibilityGap: z.literal(false).optional(),
  preserveRefundedOrdersWithoutEvidence: z.literal(false).optional(),
  skipInvalidDiscountCodes: z.literal(false).optional(),
  skipUnverifiedOrders: z.literal(false).optional(),
  allowUnresolvedBlogMedia: z.literal(false).optional(),
  fallbackBlogAuthorToOwner: z.literal(false).optional(),
  allowContactStructureGap: z.literal(false).optional(),
  allowBracketedProductNames: z.literal(false).optional(),
  decisionEvidence: z.string().trim().min(1).max(4096),
  preserveHistoricalOrders: z.boolean(), promoteActiveCategoriesToRoot: z.boolean(),
  deferredStoreIds: z.array(z.string().regex(/^[1-9]\d*$/)).refine(ids => new Set(ids).size === ids.length),
  activeCatalogOnly: z.boolean(), deferEmailTemplates: z.boolean(), allowSparseVariants: z.boolean(),
  preserveUserCreators: z.boolean(), siteTypeDefault: z.literal('ecommerce'),
  siteTypeOverrides: z.record(z.string().regex(/^[0-9]+$/), z.enum(SITES_VALID_SITE_TYPES)),
  shippingPolicy: z.enum(['pw2-defaults', 'review']),
}).strict()
export const conflictMigrationPolicySchema = migrationPolicySchema.extend({
  ...Object.fromEntries(PENDING_POLICY_KEYS.filter(key => key !== 'skipUnverifiedOrders').map(key => [key, z.boolean().optional()])) as Record<Exclude<typeof PENDING_POLICY_KEYS[number], 'skipUnverifiedOrders'>, z.ZodOptional<z.ZodBoolean>>,
  pruneInvalidVariantSkus: z.boolean().optional(),
}).strict()
export const ownerEmailMigrationPolicySchema = conflictMigrationPolicySchema.extend({ selectOldestOwner: z.boolean().optional(), preserveInvalidUserEmails: z.boolean().optional() }).strict()
export const productCatalogMigrationPolicySchema = ownerEmailMigrationPolicySchema.extend({ excludeDuplicateProductSlugs: z.boolean().optional(), excludeProductsWithoutValidVariants: z.boolean().optional() }).strict()
export const sourceOmissionMigrationPolicySchema = productCatalogMigrationPolicySchema.extend({ excludeInvalidProducts: z.boolean().optional(), excludeInvalidBlogs: z.boolean().optional(), skipUnverifiedOrders: z.boolean().optional(), omitUnmappablePayments: z.boolean().optional() }).strict()
export const negativeOrderMigrationPolicySchema = sourceOmissionMigrationPolicySchema.extend({ approvedNegativeTotalOrders: z.array(z.object({ storeId: z.literal('43'), orderId: z.enum(['112','132']) }).strict()).max(2).refine(rows => new Set(rows.map(row => row.orderId)).size === rows.length).optional() }).strict()
export const approvedCatalogMigrationPolicySchema = negativeOrderMigrationPolicySchema.extend({ excludeProductsInInactiveCategories:z.boolean().optional() }).strict()
type Policy = z.infer<typeof approvedCatalogMigrationPolicySchema>
type Disposition = 'BLOCKED' | 'OUT_OF_SCOPE' | 'APPROVED_POLICY' | 'INFORMATIONAL' | 'TARGET_CHECK_REQUIRED'
export interface DiagnosticBucket { diagnostic: ImportDiagnostic; count: number; disposition: Disposition; samples: ImportDiagnostic[] }
export interface DiagnosticSummary { total: number; rawBlockers: number; rawWarnings: number; blockingCount: number; buckets: DiagnosticBucket[] }
const pageTables = new Set(['pages', 'page_components', 'banners', 'shortlist_items', 'frontend_components'])
const pageCodes = new Set(['RAW_FIELD_UNVERIFIED', 'RAW_VALUE_UNVERIFIED', 'RAW_COMPONENT_DEFINITION_MISSING', 'SOURCE_FIELDS_UNRESOLVED'])
const NEW_CONTRACT = '8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9'
// Reviewed handoff policy, not trust in an arbitrary decisionEvidence string.
export const APPROVED_POLICY = 'f8e1eb46907f573d5a9908b584193c9376d074dcb130e6e85e1dc5db3497bc0f'
const APPROVED_EXCLUSIONS = 'de8f32afe6fbc966a17c9173686ea88c98e6946a8404bc280e6c862054b1f5ed'
interface Context { approvedSecondaryEditor?: (diagnostic:ImportDiagnostic)=>boolean; classificationFinal?: boolean; onTargetCheck?: (diagnostic: ImportDiagnostic) => void; selected?: ReadonlySet<string>; policy?: Policy; contractHash: string; acceptedExclusions?: unknown; classify?: (diagnostic: ImportDiagnostic) => 'OUT_OF_SCOPE' | 'APPROVED_POLICY' | undefined }
/** Preserve original manifest hashes; normalize only disabled draft flags for business approval. */
export function approvedPolicyHash(policy: Policy, contractHash: string): string {
  if (contractHash !== POLICY_BOUNDARY_MAPPING_HASH && contractHash !== CONFLICT_RESOLUTION_MAPPING_HASH && contractHash !== OWNER_EMAIL_MAPPING_HASH && contractHash !== PRODUCT_CATALOG_MAPPING_HASH && contractHash !== SOURCE_OMISSION_MAPPING_HASH && contractHash !== NEGATIVE_ORDER_MAPPING_HASH && contractHash !== CHUNKED_MASTER_MAPPING_HASH && contractHash !== MODEL_SETTINGS_MAPPING_HASH && contractHash !== APPROVED_CATALOG_MAPPING_HASH && contractHash !== APPROVED_SOURCE_SCOPE_MAPPING_HASH && contractHash !== RESTORED_MODEL_SETTINGS_MAPPING_HASH && contractHash !== SOURCE_DOMAIN_MAPPING_HASH) return checksum(policy)
  const normalized = { ...policy }
  if([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH,APPROVED_CATALOG_MAPPING_HASH].includes(contractHash))delete normalized.excludeProductsInInactiveCategories
  for (const key of PENDING_POLICY_KEYS) if (normalized[key] === false || ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH].includes(contractHash) && key !== 'skipUnverifiedOrders')) delete normalized[key]
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH].includes(contractHash)) delete normalized.pruneInvalidVariantSkus
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH].includes(contractHash)) { delete normalized.selectOldestOwner; delete normalized.preserveInvalidUserEmails }
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH].includes(contractHash)) { delete normalized.excludeDuplicateProductSlugs; delete normalized.excludeProductsWithoutValidVariants }
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH].includes(contractHash)) { delete normalized.excludeInvalidProducts; delete normalized.excludeInvalidBlogs; delete normalized.skipUnverifiedOrders; delete normalized.omitUnmappablePayments }
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH].includes(contractHash)) delete normalized.approvedNegativeTotalOrders
  const hash = checksum(normalized)
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH].includes(contractHash) && hash === '64564244b062c2a05cc09c791b9ac7303a7018beb10f662fbae9fafb40de4340') return APPROVED_POLICY
  // Exact reviewed DEV base policy; do not generalize arbitrary evidence or Store overrides.
  if (contractHash === CONFLICT_RESOLUTION_MAPPING_HASH && hash === 'ce6bfaf857c9e4464e218744906f0cfcc8ca682936aaf4074e2e86caffa9369f') return APPROVED_POLICY
  return hash
}
/** Each waiver is bound to the reviewed contract, enabled policy and diagnostic shape. */
function approvedConflictWarning(d: ImportDiagnostic, policy: Policy): boolean {
  const matches = (flag: keyof Policy, code: string, table: string, field?: string, reason?: string) =>
    policy[flag] === true && d.code === code && d.table === table && d.field === field && d.reason === reason
  if (matches('allowHistoricalDiscountEligibilityGap', 'DISCOUNT_HISTORY_ELIGIBILITY_UNVERIFIED', 'orders')) return true
  if (!d.sourceId) return false
  return matches('resolveDuplicateCategoryNames', 'CATEGORY_SIBLING_NAME_COLLISION_RESOLVED', 'categories', 'name', 'CATEGORY_SIBLING_NAME_COLLISION_RESOLVED') ||
    matches('resolveDuplicateCategorySlugs', 'CATEGORY_SLUG_COLLISION_RESOLVED', 'categories', 'slug', 'CATEGORY_SLUG_COLLISION_RESOLVED') ||
    matches('resolveDuplicateBlogCategorySlugs', 'BLOG_CATEGORY_SLUG_COLLISION_RESOLVED', 'blog_categories', 'slug', 'BLOG_CATEGORY_SLUG_COLLISION_RESOLVED') ||
    matches('resolveDuplicateBlogSlugs', 'BLOG_SLUG_COLLISION_RESOLVED', 'blog_posts', 'slug', 'BLOG_SLUG_COLLISION_RESOLVED') ||
    (policy.resolveDuplicateSkus === true && d.code === 'SKU_COLLISION_RESOLVED' && d.table === 'products' && /^(sku|variants\.\d+\.sku)$/.test(d.field ?? '') && d.reason === 'SKU_COLLISION_RESOLVED') ||
    matches('resolveDuplicateVariantTuples', 'DUPLICATE_VARIANT_TUPLE_RESOLVED', 'product_skus', undefined, 'CANONICAL_SKU_ALIAS') ||
    (policy.pruneInvalidVariantSkus === true && d.code === 'PRODUCT_VARIANT_SKU_EXCLUDED' && d.table === 'product_skus' && !d.field && ['MISSING_SELECTION','DUPLICATE_SELECTION','OUT_OF_DOMAIN','SOURCE_SELECTED_TIER_COUNT'].includes(d.reason ?? '')) ||
    matches('pruneUnreferencedTiers', 'PRODUCT_VARIANT_DEFINITION_RETAINED', 'product_attributes', undefined, 'UNREFERENCED_TIER') ||
    matches('treatSingleSkuWithoutSelectionsAsSimple', 'PRODUCT_VARIANT_DEFINITION_RETAINED', 'product_attributes', undefined, 'SIMPLE_PRODUCT_ATTRIBUTES') ||
    matches('flattenBlogCategoriesToRoot', 'BLOG_CHILD_CATEGORY_EXCLUDED', 'blog_categories', 'parent_id', 'CHILD_CATEGORY_OUTSIDE_FLAT_TAXONOMY') ||
    matches('flattenBlogCategoriesToRoot', 'BLOG_CATEGORY_REMAPPED_TO_ROOT', 'blog_posts', 'blog_category_id', 'CHILD_CATEGORY_REMAPPED_TO_ROOT') ||
    matches('fallbackBlogAuthorToOwner', 'BLOG_AUTHOR_FALLBACK_OWNER', 'blog_posts', 'created_by', 'AUTHOR_FALLBACK_APPLIED') ||
    matches('allowCustomerAddressOverflow', 'CUSTOMER_ADDRESS_OVERFLOW', 'addresses') ||
    matches('allowInvalidCustomerAddresses', 'CUSTOMER_ADDRESS_INVALID_SOURCE_ADDRESS', 'addresses') ||
    matches('allowInvalidCustomerAddresses', 'ORDER_ADDRESS_GEOGRAPHY_FALLBACK', 'orders', 'shipping_address_id', 'ORDER_ADDRESS_GEOGRAPHY_MISMATCH_FALLBACK') ||
    matches('preserveRefundedOrdersWithoutEvidence', 'ORDER_REFUND_EVIDENCE_ABSENT', 'orders', 'refund_status') ||
    matches('skipInvalidDiscountCodes', 'ORDER_DISCOUNT_REFERENCE_OMITTED', 'orders', 'promotion_code', 'COUPON_EXCLUDED_BY_POLICY') ||
    matches('skipInvalidDiscountCodes', 'DISCOUNT_CODE_COLLISION', 'promotion_codes') ||
    matches('skipInvalidDiscountCodes', 'DISCOUNT_MAPPING_INVALID', 'promotion_codes') ||
    matches('skipInvalidDiscountCodes', 'DISCOUNT_STATUS_UNVERIFIED', 'promotions', 'status') ||
    matches('skipInvalidDiscountCodes', 'DISCOUNT_EXPIRY_UNVERIFIED', 'promotions', 'status') ||
    matches('gracefulTenantResolution', 'TENANT_LIFECYCLE_CONFLICT', 'stores', 'status', 'SAFE_HOLD_APPLIED') ||
    matches('gracefulTenantResolution', 'USER_LIFECYCLE_CONFLICT', 'users', 'status', 'SAFE_HOLD_APPLIED') ||
    matches('gracefulTenantResolution', 'SOURCE_MAIN_DOMAIN_AMBIGUOUS', 'store_domains', undefined, 'CUSTOM_DOMAINS_PENDING') ||
    matches('gracefulTenantResolution', 'DEFAULT_DOMAIN_AMBIGUOUS', 'store_domains', undefined, 'PLATFORM_DOMAIN_FALLBACK') ||
    matches('gracefulTenantResolution', 'TENANT_SLUG_INVALID', 'store_domains', 'domain', 'TENANT_SLUG_FALLBACK_APPLIED') ||
    matches('gracefulTenantResolution', 'DOMAIN_INVALID', 'store_domains', 'domain', 'INVALID_CUSTOM_DOMAIN_EXCLUDED') ||
    matches('gracefulTenantResolution', 'SUBSCRIPTION_FUTURE_START', 'plan_subscriptions', 'starts_at', 'PW2_START_DATE_NOT_ENFORCED') ||
    (policy.allowContactStructureGap === true && d.code === 'CONTACT_STRUCTURE_UNRESOLVED' && d.table === 'stores' && ['hotline','hotline_ms'].includes(d.field ?? '') && !d.reason) ||
    (policy.allowUnresolvedBlogMedia === true && d.code === 'BLOG_MEDIA_UNRESOLVED' && d.table === 'blog_posts' && d.field === 'thumbnail' && !d.reason)
}
function disposition(d: ImportDiagnostic, ctx: Context): Disposition {
  if(ctx.approvedSecondaryEditor?.(d))return 'APPROVED_POLICY'
  const classified = isClassifiedMappingHash(ctx.contractHash) ? ctx.classify?.(d) : undefined
  if (classified) return classified
  if (ctx.classificationFinal && [PRODUCT_EXCLUSION_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH, SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH].includes(ctx.contractHash) && isProductExclusionDiagnostic(d) && (d.code !== PRODUCT_CATALOG_EXCLUSION_CODE || ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH].includes(ctx.contractHash) && ctx.policy && approvedPolicyHash(ctx.policy, ctx.contractHash) === APPROVED_POLICY && catalogExclusionAllowed(d.reason, ctx.policy)))) return 'APPROVED_POLICY'
  if (d.storeId && ctx.selected && !ctx.selected.has(d.storeId)) return 'OUT_OF_SCOPE'
  if (d.table && pageTables.has(d.table) && pageCodes.has(d.code)) return 'OUT_OF_SCOPE'
  if ([OUTCOME_MAPPING_HASH, SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH].includes(ctx.contractHash) && reviewCategory(d) === 'delegated_content') return 'APPROVED_POLICY'
  if (d.code === 'RAW_SECRET_EXCLUDED' && d.severity === 'warning') return 'INFORMATIONAL'
  if (![NEW_CONTRACT, CLASSIFIED_MAPPING_HASH, SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH, POLICY_BOUNDARY_MAPPING_HASH, BLOG_CATEGORY_MAPPING_HASH, PRODUCT_EXCLUSION_MAPPING_HASH, VARIANT_MAPPING_HASH, BLOG_CONTENT_MAPPING_HASH, BLOG_OWNER_MAPPING_HASH, DESCRIPTION_MAPPING_HASH, CORRECTED_OUTCOME_MAPPING_HASH, OUTCOME_MAPPING_HASH, ARCHIVE_MAPPING_HASH, STATUS_MAPPING_HASH].includes(ctx.contractHash)) return 'BLOCKED'
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH].includes(ctx.contractHash) && ctx.policy?.omitUnmappablePayments === true && approvedPolicyHash(ctx.policy, ctx.contractHash) === APPROVED_POLICY && d.storeId && d.sourceId && d.code === 'ORDER_PAYMENT_METHOD_OMITTED' && d.severity === 'warning' && d.table === 'orders' && d.field === 'payment_method_id' && !d.reason) return 'TARGET_CHECK_REQUIRED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.storeId && d.sourceId && d.code === 'ORDER_PAYMENT_METHOD_UNVERIFIED' && d.severity === 'warning' && d.table === 'orders' && d.field === 'payment_method_id' && !d.reason) return 'TARGET_CHECK_REQUIRED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.storeId && d.sourceId && d.code === 'RAW_VALUE_UNVERIFIED' && d.severity === 'blocker' && d.reason === 'UNSAFE_URL' && d.table === 'products' && ['description','description_ms'].includes(d.field ?? '')) return 'TARGET_CHECK_REQUIRED'
  if (isClassifiedMappingHash(ctx.contractHash) && d.code === 'SUBSCRIPTION_CANCEL_FLAG_ABSENT' && d.severity === 'warning' && d.storeId && d.sourceId && d.table === 'plan_subscriptions' && d.field === 'canceled_immediately' && d.reason === 'NO_CANCELLATION_DATE') return 'TARGET_CHECK_REQUIRED'
  if (d.code === 'TARGET_USER_CREATOR_BINDING_REQUIRED' && d.severity === 'blocker' && d.storeId && d.table === 'users' && d.field === 'created_by' && !d.reason) return 'TARGET_CHECK_REQUIRED'
  if (d.severity === 'blocker' && !d.reason && d.storeId && (
    (d.code === 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP' && d.table === 'products' && d.field === 'slug') ||
    (d.code === 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED' && ['blogs', 'blog_posts', 'blog_categories'].includes(d.table ?? '') && d.field === 'slug')
  )) return 'TARGET_CHECK_REQUIRED'
  if (d.code === 'ACCEPTED_SCOPE_EXCLUSION' && d.severity === 'warning' && !d.storeId && !d.field && !d.reason && ['notifications','subscribers','contact-submissions','analytics'].includes(d.table ?? '') && checksum(ctx.acceptedExclusions) === APPROVED_EXCLUSIONS) return 'APPROVED_POLICY'
  if (!ctx.policy || approvedPolicyHash(ctx.policy, ctx.contractHash) !== APPROVED_POLICY || d.severity !== 'warning' || !d.storeId) return 'BLOCKED'
  if([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH,MODEL_SETTINGS_MAPPING_HASH].includes(ctx.contractHash)&&d.table==='stores'&&d.sourceId===d.storeId&&!d.field&&ctx.policy.gracefulTenantResolution===true&&((d.code==='DEFAULT_DOMAIN_AMBIGUOUS'&&d.reason==='PLATFORM_DOMAIN_FALLBACK')||(d.code==='SOURCE_MAIN_DOMAIN_AMBIGUOUS'&&d.reason==='CUSTOM_DOMAINS_PENDING')))return 'APPROVED_POLICY'
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH, CONFLICT_RESOLUTION_MAPPING_HASH].includes(ctx.contractHash) && approvedConflictWarning(d, ctx.policy)) return 'APPROVED_POLICY'
  if ([SOURCE_DOMAIN_MAPPING_HASH, RESTORED_MODEL_SETTINGS_MAPPING_HASH, APPROVED_SOURCE_SCOPE_MAPPING_HASH, APPROVED_CATALOG_MAPPING_HASH, MODEL_SETTINGS_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH, NEGATIVE_ORDER_MAPPING_HASH, SOURCE_OMISSION_MAPPING_HASH, PRODUCT_CATALOG_MAPPING_HASH, OWNER_EMAIL_MAPPING_HASH].includes(ctx.contractHash) && d.sourceId && d.table === 'users' && (
    (ctx.policy.preserveInvalidUserEmails === true && d.code === 'USER_EMAIL_INVALID' && d.field === 'email' && d.reason === 'SOURCE_EMAIL_PRESERVED') ||
    (ctx.policy.selectOldestOwner === true && d.code === 'OWNER_SECONDARY_MAPPED_EDITOR' && d.field === 'is_store_owner' && d.reason === 'PRIMARY_OWNER_SELECTED') ||
    (ctx.policy.selectOldestOwner === true && d.code === 'OWNER_IDENTITY_RESOLVED' && d.field === 'is_store_owner' && ['OLDEST_OWNER_SELECTED', 'OLDEST_USER_PROMOTED'].includes(d.reason ?? ''))
  )) return 'APPROVED_POLICY'
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
