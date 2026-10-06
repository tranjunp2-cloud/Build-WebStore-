import { z } from 'zod'
import { ExportError } from './primitives'
import type { Row, SourceConfig } from './contracts'
import { SITES_VALID_SITE_TYPES } from '../../ai/site-type'
const suffix = z
  .string()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)
export const exclusionSchema = z
  .object({
    ruleId: z.literal('MASTER-2.2-OPTIONAL-HISTORY'),
    collection: z.enum([
      'notifications',
      'subscribers',
      'contact-submissions',
      'analytics',
    ]),
    reason: z.string().min(1),
    decisionEvidence: z.string().min(1),
  })
  .strict()
export const migrationPolicySchema = z.object({
  decisionEvidence: z.string().trim().min(1),
  preserveHistoricalOrders: z.boolean().default(false),
  promoteActiveCategoriesToRoot: z.boolean().default(false),
  deferredStoreIds: z.array(z.string().regex(/^[1-9]\d*$/)).default([]).refine(ids => new Set(ids).size === ids.length),
  activeCatalogOnly: z.boolean().default(false),
  deferEmailTemplates: z.boolean().default(false),
  allowSparseVariants: z.boolean().default(false),
  preserveUserCreators: z.boolean().default(false),
  approvedNegativeTotalOrders: z.array(z.object({ storeId: z.string().regex(/^[1-9]\d*$/), orderId: z.string().regex(/^[1-9]\d*$/) }).strict()).max(1000).refine(entries => new Set(entries.map(e => `${e.storeId}:${e.orderId}`)).size === entries.length).optional(),
  excludeInvalidProducts: z.boolean().optional(),
  excludeInvalidBlogs: z.boolean().optional(),
  omitUnmappablePayments: z.boolean().optional(),
  excludeDuplicateProductSlugs: z.boolean().optional(),
  excludeProductsWithoutValidVariants: z.boolean().optional(),
  excludeProductsInInactiveCategories: z.boolean().optional(),
  selectOldestOwner: z.boolean().optional(),
  preserveInvalidUserEmails: z.boolean().optional(),
  gracefulTenantResolution: z.boolean().optional(),
  resolveDuplicateSkus: z.boolean().optional(),
  resolveDuplicateVariantTuples: z.boolean().optional(),
  treatSingleSkuWithoutSelectionsAsSimple: z.boolean().optional(),
  pruneInvalidVariantSkus: z.boolean().optional(),
  pruneUnreferencedTiers: z.boolean().optional(),
  allowInactiveSkusForInactiveProduct: z.boolean().optional(),
  resolveDuplicateCategorySlugs: z.boolean().optional(),
  resolveDuplicateCategoryNames: z.boolean().optional(),
  flattenBlogCategoriesToRoot: z.boolean().optional(),
  resolveDuplicateBlogCategorySlugs: z.boolean().optional(),
  resolveDuplicateBlogSlugs: z.boolean().optional(),
  allowCustomerAddressOverflow: z.boolean().optional(),
  allowInvalidCustomerAddresses: z.boolean().optional(),
  allowHistoricalDiscountEligibilityGap: z.boolean().optional(),
  preserveRefundedOrdersWithoutEvidence: z.boolean().optional(),
  skipInvalidDiscountCodes: z.boolean().optional(),
  skipUnverifiedOrders: z.boolean().optional(),
  allowUnresolvedBlogMedia: z.boolean().optional(),
  fallbackBlogAuthorToOwner: z.boolean().optional(),
  allowContactStructureGap: z.boolean().optional(),
  allowBracketedProductNames: z.boolean().optional(),
  siteTypeDefault: z.literal('ecommerce'),
  siteTypeOverrides: z.record(z.string().regex(/^[0-9]+$/), z.enum(SITES_VALID_SITE_TYPES)).default({}),
  shippingPolicy: z.enum(['pw2-defaults', 'review']),
}).strict()

/** Reject typo/deleted/out-of-scope Store overrides before mapping. */
export function validateMigrationPolicyScope(config: SourceConfig, tables: Readonly<Record<string, Row[]>>): void {
  const stores = new Set((tables.stores ?? []).filter(row => !row.deleted_at).map(row => row.id))
  for (const id of config.migrationPolicy?.deferredStoreIds ?? [])
    if (!stores.has(id)) throw new ExportError('DEFERRED_STORE_INVALID')
  for (const id of Object.keys(config.migrationPolicy?.siteTypeOverrides ?? {}))
    if (!stores.has(id)) throw new ExportError('SITE_TYPE_OVERRIDE_STORE_INVALID')
  const domains = new Map((tables.store_domains ?? []).map(row => [row.id, row]))
  for (const [storeId, domainId] of Object.entries(config.sourceDomainBindings ?? {})) {
    const domain = domains.get(domainId)
    if (!stores.has(storeId) || !domain || domain.store_id !== storeId || domain.deleted_at || domain.is_default !== '1') throw new ExportError('SOURCE_DOMAIN_BINDING_INVALID')
  }

}

export const sourceConfigSchema = z
  .object({
    sourceDomainBindings: z.record(z.string().regex(/^[1-9]\d*$/), z.string().regex(/^[1-9]\d*$/)).optional(),
    migrationPolicy: migrationPolicySchema.optional(),
    acceptedExclusions: z
      .array(exclusionSchema)
      .default([])
      .refine(
        (items) =>
          new Set(items.map((i) => i.collection)).size === items.length,
      ),
    readOnlyUserIds: z.array(z.string().min(1)).default([]),
    version: z.literal(1),
    sourceInstance: z.string().min(1),
    sourceDatabase: z.string().min(1),
    sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/),
    snapshotId: z.string().min(1),
    asOf: z.string().datetime({ offset: true }),
    utcOffset: z
      .string()
      .regex(/^[+-](?:0\d|1[0-4]):[0-5]\d$/)
      .refine(
        (s) =>
          (!s.startsWith('+14:') && !s.startsWith('-14:')) || s.endsWith(':00'),
      ),
    timezone: z
      .string()
      .optional()
      .refine((s) => {
        try {
          if (s) new Intl.DateTimeFormat('en', { timeZone: s })
          return true
        } catch {
          return false
        }
      }),
    sourcePlatformSuffix: suffix,
    targetPlatformSuffix: suffix,
    tables: z
      .record(z.string().regex(/^[a-z_][a-z0-9_]*$/), z.string().min(1))
      .refine((t) => Object.keys(t).length > 0),
    nullTokens: z.array(z.string()).default([]),
    deletedStores: z.enum(['exclude', 'review']),
    maxInputBytes: z
      .number()
      .int()
      .positive()
      .default(512 * 1024 * 1024),
    maxRecordBytes: z
      .number()
      .int()
      .positive()
      .default(16 * 1024 * 1024),
    maxRows: z.number().int().positive().default(5_000_000),
    maxResidentBytes: z
      .number()
      .int()
      .positive()
      .default(2 * 1024 * 1024 * 1024),
  })
  .strict()
export function parseConfig(bytes: Buffer): SourceConfig {
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new ExportError('INVALID_CONFIG_JSON')
  }
  const result = sourceConfigSchema.safeParse(data)
  if (!result.success) throw new ExportError('INVALID_SOURCE_CONFIG')
  if (
    new Set(Object.values(result.data.tables)).size !==
    Object.values(result.data.tables).length
  )
    throw new ExportError('DUPLICATE_SOURCE_SELECTION')
  return result.data
}
