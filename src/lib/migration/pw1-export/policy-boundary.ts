import type { MigrationPolicy } from './contracts'
import { ExportError } from './primitives'

/** Historical contracts cannot opt into the reviewed 1.9.0 conflict rules. */
export const LEGACY_POLICY_KEYS = [
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

export const PENDING_POLICY_KEYS = [] as const
export const SOURCE_OMISSION_POLICY_KEYS = ['excludeInvalidProducts', 'excludeInvalidBlogs', 'omitUnmappablePayments', 'skipUnverifiedOrders'] as const
export const PRODUCT_CATALOG_POLICY_KEYS = ['excludeDuplicateProductSlugs', 'excludeProductsWithoutValidVariants'] as const
export const OWNER_EMAIL_POLICY_KEYS = ['selectOldestOwner', 'preserveInvalidUserEmails'] as const
export const APPROVED_CONFLICT_POLICY_KEYS = [...LEGACY_POLICY_KEYS.filter(key => key !== 'skipUnverifiedOrders'), 'pruneInvalidVariantSkus', ...OWNER_EMAIL_POLICY_KEYS, ...PRODUCT_CATALOG_POLICY_KEYS, ...SOURCE_OMISSION_POLICY_KEYS] as const

export function assertApprovedMigrationPolicy(policy?: MigrationPolicy, historical = false, ownerEmailAllowed = true, productCatalogAllowed = true, sourceOmissionAllowed = true, negativeOrdersAllowed = true, inactiveCategoryProductsAllowed = true): void {
  if ((historical || !inactiveCategoryProductsAllowed) && policy?.excludeProductsInInactiveCategories) throw new ExportError('MIGRATION_POLICY_NOT_APPROVED:excludeProductsInInactiveCategories')
  if ((historical || !negativeOrdersAllowed) && policy?.approvedNegativeTotalOrders?.length) throw new ExportError('MIGRATION_POLICY_NOT_APPROVED:approvedNegativeTotalOrders')
  const sourceOmission = !sourceOmissionAllowed && SOURCE_OMISSION_POLICY_KEYS.find(key => policy?.[key] === true)
  if (sourceOmission) throw new ExportError(`MIGRATION_POLICY_NOT_APPROVED:${sourceOmission}`)
  const productCatalog = !productCatalogAllowed && PRODUCT_CATALOG_POLICY_KEYS.find(key => policy?.[key] === true)
  if (productCatalog) throw new ExportError(`MIGRATION_POLICY_NOT_APPROVED:${productCatalog}`)
  const keys = historical ? [...LEGACY_POLICY_KEYS, 'pruneInvalidVariantSkus' as const, ...OWNER_EMAIL_POLICY_KEYS, ...PRODUCT_CATALOG_POLICY_KEYS, ...SOURCE_OMISSION_POLICY_KEYS] : PENDING_POLICY_KEYS
  const ownerEmail = !ownerEmailAllowed && OWNER_EMAIL_POLICY_KEYS.find(key => policy?.[key] === true)
  if (ownerEmail) throw new ExportError(`MIGRATION_POLICY_NOT_APPROVED:${ownerEmail}`)
  const enabled = keys.find(key => policy?.[key] === true)
  if (enabled) throw new ExportError(`MIGRATION_POLICY_NOT_APPROVED:${enabled}`)
}
