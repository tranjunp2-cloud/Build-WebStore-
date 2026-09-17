import { z } from 'zod'
import { ROOTS, type StoreOutput } from './contracts'
import { identitySchemas } from './identity-schemas'
import {
  categoryDocumentSchema,
  productDocumentSchema,
} from './mappers/catalog-schemas'
import {
  customerDocumentSchema,
  discountDocumentSchema,
  orderDocumentSchema,
} from './mappers/commerce-schemas'
import {
  siteDocumentSchema,
  pageDocumentSchema,
  mediaDocumentSchema,
  blogCategoryDocumentSchema,
  blogDocumentSchema,
  emailDocumentSchema,
} from './mappers/content-schemas'
import { exclusionSchema, migrationPolicySchema } from './source-config'
import { ExportError } from './primitives'
export const documentSchemas = {
  ...identitySchemas,
  sites: siteDocumentSchema,
  pages: pageDocumentSchema,
  media: mediaDocumentSchema,
  categories: categoryDocumentSchema,
  products: productDocumentSchema,
  customers: customerDocumentSchema,
  discounts: discountDocumentSchema,
  orders: orderDocumentSchema,
  blog_categories: blogCategoryDocumentSchema,
  blogs: blogDocumentSchema,
  'email-template-settings': emailDocumentSchema,
  discount_usage_history: z.never(),
  notifications: z.never(),
  subscribers: z.never(),
  'contact-submissions': z.never(),
  analytics: z.never(),
}
export const storeSchema = z
  .object(
    Object.fromEntries(
      ROOTS.map((root) => [root, z.array(documentSchemas[root])]),
    ),
  )
  .strict()
export const legacyStoreSchema = storeSchema.extend({
  products: z.array(productDocumentSchema.extend({
    sku: z.string().min(1).max(50),
    variants: productDocumentSchema.shape.variants.element.extend({
      sku: z.string().min(1).max(50),
    }).array().max(900),
  })),
})
export const masterSchema = z.array(storeSchema)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const diagnostic = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    severity: z.enum(['warning', 'blocker']),
    storeId: z.string().optional(),
    table: z.string().optional(),
    sourceId: z.string().optional(),
    field: z.string().optional(),
    reason: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
  })
  .strict()
const contribution = z
  .object({
    storeId: z.string().optional(),
    table: z.string(),
    sourceId: z.string(),
    fields: z.array(z.string()),
    targetPath: z.string(),
    rule: z.string(),
  })
  .strict()
export const reportSchema = z
  .object({
    version: z.literal(1),
    diagnostics: z.array(diagnostic),
    rows: z.array(
      z
        .object({
          table: z.string(),
          sourceId: z.string(),
          storeId: z.string().nullable(),
          record: z.number().int().positive(),
          ownership: z.object({ storeId: z.string().nullable(), rule: z.string().regex(/^[A-Z_]+$/), parentTable: z.string().optional(), parentId: z.string().optional() }).strict().optional(),
          fieldRetentionRules: z.record(z.string().regex(/^MASTER-[A-Z0-9.-]+$/)).optional(),
          disposition: z.enum([
            'mapped',
            'partial',
            'retained-source',
            'excluded',
            'unresolved',
          ]),
          fields: z.record(
            z.enum([
              'security-excluded',
              'mapped',
              'retained-source',
              'deleted-retained-source',
              'technical-user-excluded',
              'source-identity',
              'unresolved',
            ]),
          ),
          contributions: z.array(contribution),
        })
        .strict(),
    ),
  })
  .strict()
export const manifestSchema = z
  .object({
    version: z.literal(1),
    exporterVersion: z.enum(['1.0.0', '1.1.0', '1.2.0']),
    classificationVersion: z.literal('source-classification-v1').optional(),
    contractSha256: digest,
    sourceConfigSha256: digest,
    sourceSnapshot: z
      .object({
        sourceInstance: z.string(),
        sourceDatabase: z.string(),
        sourceInstanceToken: z.string().regex(/^[A-Za-z0-9]+$/),
        snapshotId: z.string(),
        asOf: z.string().datetime({ offset: true }),
      })
      .strict(),
    files: z.array(
      z
        .object({
          table: z.string().optional(),
          filename: z.string(),
          sha256: digest,
          bytes: z.number().nonnegative(),
          selected: z.boolean(),
          rowCount: z.number().int().nonnegative().nullable(),
          headers: z.array(z.string()),
        })
        .strict(),
    ),
    artifacts: z
      .object({
        'master.json': digest,
        'mapping-report.json': digest,
        'mapping-report.csv': digest,
        'README.md': digest,
        'store-summary.json': digest.optional(),
        'store-summary.csv': digest.optional(),
        'user-actors.json': digest.optional(),
        'customer-reconciliation.json': digest.optional(),
        'product-reconciliation.json': digest.optional(),
      })
      .strict(),
    acceptedExclusions: z.array(exclusionSchema).optional(),
    migrationPolicy: migrationPolicySchema.optional(),
    status: z.enum(['complete', 'needs_review']),
    importReady: z.literal(false),
    coverage: z.object({ accounted: z.literal(true) }).strict(),
    mapping: z.object({ complete: z.boolean() }).strict(),
    counts: z
      .object({
        sourceStoreCount: z.number().int().nonnegative(),
        selectedStoreCount: z.number().int().nonnegative(),
        policyExcludedStoreCount: z.number().int().nonnegative(),
        emittedStoreCount: z.number().int().nonnegative(),
        blockedStoreCount: z.number().int().nonnegative(),
        blockers: z.number().int().nonnegative(),
      })
      .strict(),
    blockedStores: z.array(z.string()),
    policyExcludedStores: z.array(z.string()),
  })
  .strict()
export function validateMaster(data: unknown): StoreOutput[] {
  // Validate per Store to avoid cloning the entire production object graph.
  if (
    !Array.isArray(data) ||
    data.some((store) => !storeSchema.safeParse(store).success)
  )
    throw new ExportError('MASTER_SCHEMA_INVALID')
  return data as StoreOutput[]
}
