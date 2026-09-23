import { z } from 'zod'
// Exact exporter 1.2 receipt shapes; semantics are checked incrementally in reconciliation.ts.
const id = z.string().min(1)
const customerRef = z.string().regex(/^@customers:customers:[^:]+$/)
const target = { targetRef: customerRef.nullable() }
const address = z.object({
  ...target, sourceOrderId: id, sourceAddressId: id,
  usage: z.enum(['Shipping', 'Billing']),
  legacyGeographyTypes: z.array(z.enum(['country', 'province', 'district', 'ward'])),
  disposition: z.enum(['invalid-source-address', 'emitted', 'deduplicated', 'overflow']),
  reason: z.string().regex(/^[A-Z_]+$/).optional(),
  targetIndex: z.number().int().nonnegative().nullable().optional(),
}).strict()
/** Only IDs and fixed decisions from the helper; raw archive remains in hashed CSVs. */
export const customerDiagnosticsSchema = z.object({
  customerCrosswalk: z.array(z.object({
    ...target, sourceCustomerId: id, disposition: z.enum(['deleted', 'canonical', 'merged']),
  }).strict()),
  addressDispositions: z.array(address),
  rankDispositions: z.array(z.object({
    ...target, sourceCustomerId: id, sourceRankId: id.nullable(),
    disposition: z.enum(['not-configured', 'unmapped-rank', 'selected-canonical', 'retained-source-only']),
  }).strict()),
  rankConflicts: z.array(z.object({
    ...target, sourceCustomerIds: z.array(id), sourceRankIds: z.array(z.string()),
    selectedSourceRankId: id.nullable(), policy: z.literal('canonical-oldest-created-at'),
  }).strict()),
  profileConflicts: z.array(z.object({
    ...target, nameSourceId: z.string(), emailSourceId: z.string(), notesSourceIds: z.array(id),
  }).strict()),
}).strict()
export type CustomerDiagnostics = z.infer<typeof customerDiagnosticsSchema>
export const snapshotSchema = z.object({
  sourceInstance: id, sourceDatabase: id, sourceInstanceToken: id,
  snapshotId: id, asOf: z.string().datetime({ offset: true }),
}).strict()
const sourceRow = z.object({ table: z.enum(['customers', 'addresses', 'ranks', 'orders']), sourceId: id }).strict()
export const customerReceiptSchema = z.object({
  version: z.literal(1), sourceSnapshot: snapshotSchema,
  archiveStorage: z.literal('external-source-csv'),
  stores: z.array(z.object({
    storeId: id, status: z.enum(['reconciled', 'cohort-failed']),
    retainedSourceRows: z.array(sourceRow),
    // These refs lost their operational target after schema/relationship closure.
    quarantinedCustomerRefs: z.array(customerRef),
    diagnostics: customerDiagnosticsSchema,
  }).strict()),
}).strict()
const tier = z.object({
  attributeId: id, attributeCode: z.string().nullable(), targetPath: id,
  options: z.array(z.object({ attributeValueId: id, targetPath: id }).strict()),
}).strict()
export const productReceiptSchema = z.object({
  version: z.literal(1), sourceSnapshot: snapshotSchema,
  products: z.array(z.object({
    storeId: id, sourceProductId: id, emitted: z.boolean(),
    targetRef: z.string().regex(/^@products:products:[^:]+$/).nullable(),
    eligibleSkuCount: z.number().int().nonnegative(),
    excludedSkus: z.array(z.object({ sourceSkuId: id, reasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).min(1) }).strict()).optional(),
    tiers: z.array(tier),
    skus: z.array(z.object({
      sourceSkuId: id, targetPath: z.string().nullable(), targetId: z.string().uuid().nullable(),
      selectedTuple: z.array(z.tuple([id, id])),
    }).strict()),
    errors: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)),
  }).strict()),
}).strict()
export type CustomerReceipt = z.infer<typeof customerReceiptSchema>
export type ProductReceipt = z.infer<typeof productReceiptSchema>

export const customerStoreReceiptSchema = customerReceiptSchema.shape.stores.element
export const productEntryReceiptSchema = productReceiptSchema.shape.products.element
export const customerRootSchema = customerReceiptSchema.extend({ stores: z.array(z.never()).default([]) })
export const productRootSchema = productReceiptSchema.extend({ products: z.array(z.never()).default([]) })
