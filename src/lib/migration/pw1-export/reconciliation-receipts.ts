import { z } from 'zod'
import type { Doc, MappingContext, SourceConfig, StoreOutput } from './contracts'
import { live, ref } from './contracts'
import { sourceCatalog } from './mappers/catalog-source'
import { ExportError } from './primitives'

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
const snapshotSchema = z.object({
  sourceInstance: id, sourceDatabase: id, sourceInstanceToken: id,
  snapshotId: id, asOf: z.string().datetime({ offset: true }),
}).strict()
export function receiptSnapshot(config: Pick<SourceConfig, keyof z.infer<typeof snapshotSchema>>) {
  return snapshotSchema.parse({
    sourceInstance: config.sourceInstance, sourceDatabase: config.sourceDatabase,
    sourceInstanceToken: config.sourceInstanceToken, snapshotId: config.snapshotId, asOf: config.asOf,
  })
}
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
const emptyDiagnostics = (): CustomerDiagnostics => ({
  customerCrosswalk: [], addressDispositions: [], rankDispositions: [], rankConflicts: [], profileConflicts: [],
})

export function buildCustomerReceiptStore(ctx: MappingContext, captured?: CustomerDiagnostics): CustomerReceipt['stores'][number] {
  const diagnostics = structuredClone(captured ?? emptyDiagnostics())
  const refs = new Set(ctx.output.customers.map(doc => String(doc._ref)))
  const quarantined = new Set<string>()
  for (const entries of Object.values(diagnostics)) {
    for (const entry of entries) {
      if (entry.targetRef && !refs.has(entry.targetRef)) {
        quarantined.add(entry.targetRef)
        entry.targetRef = null
        if ('targetIndex' in entry) entry.targetIndex = null
      }
    }
  }
  return {
    storeId: ctx.storeId, status: captured ? 'reconciled' : 'cohort-failed',
    retainedSourceRows: (['customers', 'addresses', 'ranks', 'orders'] as const).flatMap(table =>
      ctx.rows(table, true).map(row => ({ table, sourceId: row.id! }))),
    quarantinedCustomerRefs: [...quarantined].sort(), diagnostics,
  }
}

export function buildProductReceiptEntries(ctx: MappingContext): ProductReceipt['products'] {
  const docs = new Map(ctx.output.products.map(doc => [String(doc._ref), doc]))
  const sourceSkus = new Map<string, import('./contracts').Row[]>()
  for (const row of ctx.rows('product_skus')) {
    if (row.status !== '1') continue
    const rows = sourceSkus.get(row.product_id ?? '') ?? []
    rows.push(row); sourceSkus.set(row.product_id ?? '', rows)
  }
  const errorsByProduct = new Map<string, string[]>()
  for (const diagnostic of ctx.diagnostics) {
    if (diagnostic.storeId !== ctx.storeId || diagnostic.table !== 'products' || diagnostic.severity !== 'blocker') continue
    const key = diagnostic.sourceId?.split(':').at(-1) ?? ''
    const errors = errorsByProduct.get(key) ?? []
    errors.push(diagnostic.code); errorsByProduct.set(key, errors)
  }
  return ctx.rows('products').filter(live).map(product => {
    const source = sourceCatalog(ctx, product)
    const productRef = ref('products', 'products', product.id!)
    const doc = docs.get(productRef)
    const rows = sourceSkus.get(product.id!) ?? []
    return {
      storeId: ctx.storeId, sourceProductId: product.id!, emitted: !!doc,
      targetRef: doc ? productRef : null, eligibleSkuCount: rows.length,
      tiers: doc ? source.identities : [],
      skus: rows.map(row => {
        const crosswalk = source.skuCrosswalk.find(item => item.sourceSkuId === row.id)
        return {
          sourceSkuId: row.id!,
          targetPath: doc ? crosswalk?.targetPath ?? '' : null,
          targetId: doc ? crosswalk?.targetId ?? null : null,
          selectedTuple: crosswalk?.selectedTuple.map(pair => [pair[0], pair[1]] as [string, string]) ?? [],
        }
      }),
      errors: [...new Set([
        ...source.errors.map(error => error.code),
        ...(errorsByProduct.get(product.id!) ?? []),
        ...(!doc ? ['PRODUCT_NOT_EMITTED'] : []),
      ])].sort(),
    }
  })
}

type SourceEvidence = { table: string; sourceId: string; storeId: string | null }
/** Validate identity, ownership, closure and target paths without claiming CSV-value parity. */
export function validateReconciliationReceipts(
  customerValue: unknown, productValue: unknown,
  snapshot: z.infer<typeof snapshotSchema>, master: StoreOutput[], sourceRows: SourceEvidence[],
) {
  const c = customerReceiptSchema.safeParse(customerValue), p = productReceiptSchema.safeParse(productValue)
  if (!c.success || !p.success) throw new ExportError('RECONCILIATION_SCHEMA_INVALID')
  const expected = receiptSnapshot(snapshot)
  for (const receipt of [c.data, p.data])
    if (JSON.stringify(receipt.sourceSnapshot) !== JSON.stringify(expected))
      throw new ExportError('RECONCILIATION_PROVENANCE_INVALID')
  const fail = () => { throw new ExportError('RECONCILIATION_REFERENCES_INVALID') }
  const sources = new Map(sourceRows.map(row => [`${row.table}:${row.sourceId}`, row.storeId]))
  const retainedByStore = new Map<string, string[]>()
  for (const row of sourceRows) {
    if (!row.storeId || !['customers', 'addresses', 'ranks', 'orders'].includes(row.table)) continue
    const list = retainedByStore.get(row.storeId) ?? []
    list.push(`${row.table}:${row.sourceId}`); retainedByStore.set(row.storeId, list)
  }
  const owned = (table: string, sourceId: string, storeId: string) => {
    if (sources.get(`${table}:${sourceId}`) !== storeId) fail()
  }
  const stores = new Map(master.map(store => [String((store.tenants[0].metaData as Doc).pw1StoreId), store]))
  const seenStores = new Set<string>()
  for (const receipt of c.data.stores) {
    const store = stores.get(receipt.storeId)
    if (!store || seenStores.has(receipt.storeId)) fail()
    seenStores.add(receipt.storeId)
    const customers = new Map(store!.customers.map(doc => [String(doc._ref), doc]))
    const retained = new Set<string>()
    for (const row of receipt.retainedSourceRows) {
      owned(row.table, row.sourceId, receipt.storeId)
      const key = `${row.table}:${row.sourceId}`
      if (retained.has(key)) fail()
      retained.add(key)
    }
    for (const key of retainedByStore.get(receipt.storeId) ?? [])
      if (!retained.has(key)) fail()
    const crosswalk = new Map<string, string | null>()
    for (const entry of receipt.diagnostics.customerCrosswalk) {
      owned('customers', entry.sourceCustomerId, receipt.storeId)
      if (crosswalk.has(entry.sourceCustomerId)) fail()
      crosswalk.set(entry.sourceCustomerId, entry.targetRef)
    }
    const sourceCustomer = (sourceId: string, targetRef: string | null) => {
      if (!sourceId) return
      owned('customers', sourceId, receipt.storeId)
      if (!crosswalk.has(sourceId) || crosswalk.get(sourceId) !== targetRef) fail()
    }
    for (const entries of Object.values(receipt.diagnostics))
      for (const entry of entries)
        if (entry.targetRef !== null && !customers.has(entry.targetRef)) fail()
    for (const ref of receipt.quarantinedCustomerRefs) {
      owned('customers', ref.split(':').at(-1)!, receipt.storeId)
      if (customers.has(ref)) fail()
    }
    for (const entry of receipt.diagnostics.addressDispositions) {
      owned('orders', entry.sourceOrderId, receipt.storeId)
      if (entry.disposition !== 'invalid-source-address') owned('addresses', entry.sourceAddressId, receipt.storeId)
      if (entry.targetRef && ['emitted', 'deduplicated'].includes(entry.disposition)) {
        const addresses = customers.get(entry.targetRef)!.addresses
        if (!Array.isArray(addresses) || entry.targetIndex == null || !addresses[entry.targetIndex]) fail()
      } else if (entry.targetIndex != null) fail()
    }
    for (const entry of receipt.diagnostics.rankDispositions) {
      sourceCustomer(entry.sourceCustomerId, entry.targetRef)
      if (entry.disposition === 'selected-canonical' && entry.sourceRankId)
        owned('ranks', entry.sourceRankId, receipt.storeId)
    }
    for (const entry of receipt.diagnostics.rankConflicts)
      entry.sourceCustomerIds.forEach(sourceId => sourceCustomer(sourceId, entry.targetRef))
    for (const entry of receipt.diagnostics.profileConflicts)
      [entry.nameSourceId, entry.emailSourceId, ...entry.notesSourceIds].forEach(sourceId => sourceCustomer(sourceId, entry.targetRef))
    if (receipt.status === 'reconciled') {
      for (const row of receipt.retainedSourceRows)
        if (row.table === 'customers' && !crosswalk.has(row.sourceId)) fail()
    }
    for (const doc of customers.values()) {
      if (!receipt.diagnostics.customerCrosswalk.some(entry => entry.disposition === 'canonical' && entry.targetRef === doc._ref)) fail()
      const addresses = (doc.addresses ?? []) as Doc[]
      addresses.forEach((_address, index) => {
        if (!receipt.diagnostics.addressDispositions.some(entry => entry.targetRef === doc._ref && entry.targetIndex === index && ['emitted', 'deduplicated'].includes(entry.disposition))) fail()
      })
    }
    if (receipt.status === 'cohort-failed' && (customers.size || Object.values(receipt.diagnostics).some(rows => rows.length))) fail()
  }
  if (seenStores.size !== stores.size) fail()
  const seenProducts = new Set<string>(), seenSkus = new Set<string>()
  for (const entry of p.data.products) {
    const store = stores.get(entry.storeId)
    if (!store || seenProducts.has(entry.sourceProductId)) fail()
    seenProducts.add(entry.sourceProductId)
    owned('products', entry.sourceProductId, entry.storeId)
    const expectedRef = ref('products', 'products', entry.sourceProductId)
    const doc = store!.products.find(doc => doc._ref === expectedRef)
    if (entry.emitted !== !!doc || entry.targetRef !== (doc ? expectedRef : null) || entry.skus.length !== entry.eligibleSkuCount) fail()
    if (!doc && (entry.tiers.length || !entry.errors.includes('PRODUCT_NOT_EMITTED'))) fail()
    const configs = (doc?.variantConfigs ?? []) as Doc[]
    if (doc && configs.length !== entry.tiers.length) fail()
    entry.tiers.forEach((tier, i) => {
      owned('attributes', tier.attributeId, entry.storeId)
      if (tier.targetPath !== `variantConfigs.${i}` || tier.options.length !== (configs[i].options as Doc[]).length) fail()
      tier.options.forEach((option, j) => {
        owned('attribute_values', option.attributeValueId, entry.storeId)
        if (option.targetPath !== `variantConfigs.${i}.options.${j}.value`) fail()
      })
    })
    const variants = (doc?.variants ?? []) as Doc[]
    if (doc && entry.skus.length !== (doc.hasVariants ? variants.length : 1)) fail()
    const variantIds = new Set<string>()
    for (const sku of entry.skus) {
      owned('product_skus', sku.sourceSkuId, entry.storeId)
      if (seenSkus.has(sku.sourceSkuId)) fail()
      seenSkus.add(sku.sourceSkuId)
      if (!doc) { if (sku.targetId !== null || sku.targetPath !== null) fail(); continue }
      if (!doc.hasVariants) {
        if (sku.targetPath !== '' || sku.targetId !== null || sku.selectedTuple.length) fail()
        continue
      }
      const index = variants.findIndex(variant => variant.id === sku.targetId)
      if (index < 0 || sku.targetPath !== `variants.${index}` || variantIds.has(sku.targetId!)) fail()
      variantIds.add(sku.targetId!)
      if (sku.selectedTuple.length !== entry.tiers.length) fail()
      const labels = sku.selectedTuple.map(([attributeId, valueId], i) => {
        const tier = entry.tiers[i]
        const optionIndex = tier.options.findIndex(option => option.attributeValueId === valueId)
        if (attributeId !== tier.attributeId || optionIndex < 0) fail()
        return ((configs[i].options as Doc[])[optionIndex]).value
      })
      if (labels.join(' - ') !== variants[index].name) fail()
    }
  }
  for (const store of master)
    for (const doc of store.products)
      if (!seenProducts.has(String(doc._ref).split(':').at(-1)!)) fail()
  return { customers: c.data, products: p.data }
}
