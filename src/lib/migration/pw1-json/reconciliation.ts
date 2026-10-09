import { ADDRESS_OVERFLOW_RULE } from './approved-source-scope'
import { createHash } from 'node:crypto'
import { MigrationError } from './errors'
import type { ImportStore } from './types'
import { canonical } from './projection'
import { customerRootSchema, customerStoreReceiptSchema, productEntryReceiptSchema, productRootSchema, snapshotSchema } from './receipt-schemas'

const CUSTOMER_TABLES = new Set(['customers', 'addresses', 'ranks', 'orders'])
const SOURCE_TABLES = new Set([...CUSTOMER_TABLES, 'products', 'product_skus', 'attributes', 'attribute_values'])
const fail = (): never => { throw new MigrationError('RECONCILIATION_REFERENCES_INVALID') }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const rows = (value: unknown): Record<string, unknown>[] => {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(object)) return fail()
  return value
}
const text = (value: unknown): string => typeof value === 'string' ? value : fail()
const key = (table: string, sourceId: string) => JSON.stringify([table, sourceId])
interface ProductTarget { ref: string; hasVariants: boolean; options: string[][]; variants: { id: string; name: string }[] }
interface StoreTarget { customers: Map<string, number>; products: Map<string, ProductTarget> }
export interface SourceReconciliationRow { table: string; sourceId: string; storeId: string | null; parentId?: string; parentTable?: string; ownershipRule?: string; fieldRetentionRules?: Record<string, string> }

/** Mirrors exporter receipt validation using only target identity/path indexes, never whole documents. */
export function createReconciliationIndex(policy?: { resolveDuplicateVariantTuples?: boolean; pruneInvalidVariantSkus?: boolean; allowCustomerAddressOverflow?: boolean }, sourceInstanceToken?: string) {
  const overflowClaims = new Set<string>(), overflowReceipts = new Set<string>()
  const parents = new Map<string, string>()
  const stores = new Map<string, StoreTarget>()
  const sources = new Map<string, string | null>()
  const retainedCounts = new Map<string, number>()
  const seenStores = new Set<string>(), seenProducts = new Set<string>(), seenSkus = new Set<string>()
  let keys = 0, bytes = 0, sourceStarted = false, receiptStarted = false, finished = false
  const charge = (...values: string[]) => {
    keys++; bytes += 64 + values.reduce((sum, value) => sum + Buffer.byteLength(value), 0)
    if (keys > 1_000_000 || bytes > 128 * 1024 * 1024) throw new MigrationError('RECONCILIATION_RESOURCE_LIMIT')
  }
  const owned = (table: string, sourceId: string, storeId: string) => {
    if (sources.get(key(table, sourceId)) !== storeId) fail()
  }
  const active = () => { if (finished) throw new MigrationError('RECONCILIATION_ALREADY_FINISHED') }
  return {
    addStore(store: ImportStore): void {
      active()
      if (sourceStarted || receiptStarted || stores.has(store.storeId)) fail()
      charge(store.storeId)
      const target: StoreTarget = { customers: new Map(), products: new Map() }
      for (const customer of store.collections.customers) {
        const ref = text(customer._ref)
        if (!/^@customers:customers:[^:]+$/.test(ref) || target.customers.has(ref)) fail()
        charge(ref)
        target.customers.set(ref, rows(customer.addresses).length)
      }
      for (const product of store.collections.products) {
        const ref = text(product._ref), sourceId = ref.split(':').at(-1)!
        if (!/^@products:products:[^:]+$/.test(ref) || target.products.has(sourceId)) fail()
        charge(ref)
        const options = rows(product.variantConfigs).map(config => rows(config.options).map(option => {
          const label = text(option.value); charge(label); return label
        }))
        const variants = rows(product.variants).map(variant => {
          const id = text(variant.id), name = text(variant.name); charge(id, name); return { id, name }
        })
        if (new Set(variants.map(variant => variant.id)).size !== variants.length) fail()
        target.products.set(sourceId, { ref, hasVariants: Boolean(product.hasVariants), options, variants })
      }
      stores.set(store.storeId, target)
    },
    addSourceRow(row: SourceReconciliationRow): void {
      active(); sourceStarted = true
      if (Object.values(row.fieldRetentionRules ?? {}).includes(ADDRESS_OVERFLOW_RULE)) {
        if (row.table !== 'addresses' || !row.storeId || !policy?.allowCustomerAddressOverflow) fail()
        overflowClaims.add(key(row.storeId!, row.sourceId)); charge(row.sourceId)
      }
      if (receiptStarted) fail()
      if (!SOURCE_TABLES.has(row.table)) return
      if (!row.sourceId || (row.storeId !== null && !row.storeId)) fail()
      const identity = key(row.table, row.sourceId)
      if (sources.has(identity)) fail()
      charge(identity, row.storeId ?? '')
      sources.set(identity, row.storeId)
      if (row.parentId && row.parentTable === 'products' && row.ownershipRule === 'SOURCE_PARENT_RELATION') parents.set(identity, row.parentId)
      if (row.storeId && CUSTOMER_TABLES.has(row.table)) retainedCounts.set(row.storeId, (retainedCounts.get(row.storeId) ?? 0) + 1)
    },
    validateCustomerStore(value: unknown): void {
      active(); receiptStarted = true
      const parsed = customerStoreReceiptSchema.safeParse(value)
      if (!parsed.success) throw new MigrationError('RECONCILIATION_SCHEMA_INVALID')
      const receipt = parsed.data, store = stores.get(receipt.storeId)
      if (!store || seenStores.has(receipt.storeId)) return fail()
      charge(receipt.storeId); seenStores.add(receipt.storeId)
      const retained = new Set<string>()
      for (const row of receipt.retainedSourceRows) {
        owned(row.table, row.sourceId, receipt.storeId)
        const identity = key(row.table, row.sourceId)
        if (retained.has(identity)) fail()
        retained.add(identity)
      }
      if (retained.size !== (retainedCounts.get(receipt.storeId) ?? 0)) fail()
      const crosswalk = new Map<string, string | null>(), canonicals = new Set<string>(), addresses = new Map<string, Set<number>>()
      for (const entry of receipt.diagnostics.customerCrosswalk) {
        owned('customers', entry.sourceCustomerId, receipt.storeId)
        if (crosswalk.has(entry.sourceCustomerId)) fail()
        crosswalk.set(entry.sourceCustomerId, entry.targetRef)
        if (entry.disposition === 'canonical' && entry.targetRef !== null) canonicals.add(entry.targetRef)
      }
      const sourceCustomer = (sourceId: string, ref: string | null) => {
        if (!sourceId) return
        owned('customers', sourceId, receipt.storeId)
        if (!crosswalk.has(sourceId) || crosswalk.get(sourceId) !== ref) fail()
      }
      for (const entries of Object.values(receipt.diagnostics)) for (const entry of entries) {
        if (entry.targetRef !== null && !store.customers.has(entry.targetRef)) fail()
      }
      const quarantined = new Set<string>()
      for (const ref of receipt.quarantinedCustomerRefs) {
        owned('customers', ref.split(':').at(-1)!, receipt.storeId)
        if (store.customers.has(ref) || quarantined.has(ref)) fail()
        quarantined.add(ref)
      }
      for (const entry of receipt.diagnostics.addressDispositions) {
        owned('orders', entry.sourceOrderId, receipt.storeId)
        if (entry.disposition === 'overflow') overflowReceipts.add(key(receipt.storeId, entry.sourceAddressId))
        if (entry.disposition !== 'invalid-source-address') owned('addresses', entry.sourceAddressId, receipt.storeId)
        if (entry.targetRef && ['emitted', 'deduplicated'].includes(entry.disposition)) {
          const count = store.customers.get(entry.targetRef)!
          if (entry.targetIndex == null || entry.targetIndex >= count) fail()
          const indices = addresses.get(entry.targetRef) ?? new Set<number>()
          indices.add(entry.targetIndex!); addresses.set(entry.targetRef, indices)
        } else if (entry.targetIndex != null) fail()
      }
      for (const entry of receipt.diagnostics.rankDispositions) {
        sourceCustomer(entry.sourceCustomerId, entry.targetRef)
        if (entry.disposition === 'selected-canonical' && entry.sourceRankId) owned('ranks', entry.sourceRankId, receipt.storeId)
      }
      for (const entry of receipt.diagnostics.rankConflicts) entry.sourceCustomerIds.forEach(id => sourceCustomer(id, entry.targetRef))
      for (const entry of receipt.diagnostics.profileConflicts) [entry.nameSourceId, entry.emailSourceId, ...entry.notesSourceIds].forEach(id => sourceCustomer(id, entry.targetRef))
      if (receipt.status === 'reconciled') for (const row of receipt.retainedSourceRows) {
        if (row.table === 'customers' && !crosswalk.has(row.sourceId)) fail()
      }
      for (const [ref, count] of store.customers) if (!canonicals.has(ref) || (addresses.get(ref)?.size ?? 0) !== count) fail()
      if (receipt.status === 'cohort-failed' && (store.customers.size || Object.values(receipt.diagnostics).some(entries => entries.length))) fail()
    },
    validateProduct(value: unknown): void {
      active(); receiptStarted = true
      const parsed = productEntryReceiptSchema.safeParse(value)
      if (!parsed.success) throw new MigrationError('RECONCILIATION_SCHEMA_INVALID')
      const entry = parsed.data, store = stores.get(entry.storeId)
      if (!store || seenProducts.has(entry.sourceProductId)) return fail()
      charge(entry.sourceProductId); seenProducts.add(entry.sourceProductId)
      owned('products', entry.sourceProductId, entry.storeId)
      const doc = store.products.get(entry.sourceProductId)
      if (entry.emitted !== Boolean(doc) || entry.targetRef !== (doc?.ref ?? null) || entry.skus.length + (entry.excludedSkus?.length ?? 0) !== entry.eligibleSkuCount) fail()
      if (!doc && (entry.tiers.length || !entry.errors.includes('PRODUCT_NOT_EMITTED'))) fail()
      if (doc && doc.options.length !== entry.tiers.length) fail()
      entry.tiers.forEach((tier, i) => {
        owned('attributes', tier.attributeId, entry.storeId)
        if (tier.targetPath !== `variantConfigs.${i}` || tier.options.length !== doc?.options[i]?.length) fail()
        tier.options.forEach((option, j) => {
          owned('attribute_values', option.attributeValueId, entry.storeId)
          if (option.targetPath !== `variantConfigs.${i}.options.${j}.value`) fail()
        })
      })
      if (entry.excludedSkus !== undefined && !policy?.pruneInvalidVariantSkus) fail()
      for (const excluded of entry.excludedSkus ?? []) {
        owned('product_skus', excluded.sourceSkuId, entry.storeId)
        if (parents.get(key('product_skus', excluded.sourceSkuId)) !== entry.sourceProductId || seenSkus.has(excluded.sourceSkuId) || excluded.reasons.some(reason => !['MISSING_SELECTION','DUPLICATE_SELECTION','OUT_OF_DOMAIN','SOURCE_SELECTED_TIER_COUNT'].includes(reason))) fail()
        seenSkus.add(excluded.sourceSkuId)
      }
      if (doc && (!doc.hasVariants || !policy?.resolveDuplicateVariantTuples) && entry.skus.length !== (doc.hasVariants ? doc.variants.length : 1)) fail()
      const targetTuples = new Map<string, string>()
      const variantIds = new Set<string>()
      for (const sku of entry.skus) {
        owned('product_skus', sku.sourceSkuId, entry.storeId)
        if (seenSkus.has(sku.sourceSkuId)) fail()
        charge(sku.sourceSkuId); seenSkus.add(sku.sourceSkuId)
        if (!doc) { if (sku.targetId !== null || sku.targetPath !== null) fail(); continue }
        if (!doc.hasVariants) {
          if (sku.targetPath !== '' || sku.targetId !== null || sku.selectedTuple.length) fail()
          continue
        }
        const index = doc.variants.findIndex(variant => variant.id === sku.targetId)
        if (index < 0 || sku.targetPath !== `variants.${index}` ) fail()
        const tuple = JSON.stringify(sku.selectedTuple)
        if (variantIds.has(sku.targetId!) && (!policy?.resolveDuplicateVariantTuples || targetTuples.get(sku.targetId!) !== tuple)) fail()
        targetTuples.set(sku.targetId!, tuple)
        variantIds.add(sku.targetId!)
        if (sku.selectedTuple.length !== entry.tiers.length) fail()
        const labels = sku.selectedTuple.map(([attributeId, valueId], i) => {
          const tier = entry.tiers[i], optionIndex = tier.options.findIndex(option => option.attributeValueId === valueId)
          if (attributeId !== tier.attributeId || optionIndex < 0) fail()
          return doc.options[i][optionIndex]
        })
        if (labels.join(' - ') !== doc.variants[index].name) fail()
      }
      if (doc?.hasVariants && variantIds.size !== doc.variants.length) fail()
      if (doc?.hasVariants && policy?.resolveDuplicateVariantTuples) {
        if (!sourceInstanceToken || new Set(targetTuples.values()).size !== targetTuples.size) fail()
        for (const targetId of variantIds) {
          const aliases = entry.skus.filter(sku => sku.targetId === targetId).sort((a,b) => BigInt(a.sourceSkuId) < BigInt(b.sourceSkuId) ? -1 : 1)
          if (aliases.length > 1 && aliases.some(sku => parents.get(key('product_skus', sku.sourceSkuId)) !== entry.sourceProductId)) fail()
          const hex = createHash('sha256').update(JSON.stringify([sourceInstanceToken, 'product_skus', aliases[0].sourceSkuId])).digest('hex')
          if (targetId !== `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`) fail()
        }
      }
    },
    finish(customerRoot: unknown, productRoot: unknown, snapshot: unknown): void {
      active()
      const customer = customerRootSchema.safeParse(customerRoot), product = productRootSchema.safeParse(productRoot), expected = snapshotSchema.safeParse(snapshot)
      if (!customer.success || !product.success || !expected.success) throw new MigrationError('RECONCILIATION_SCHEMA_INVALID')
      if (canonical(customer.data.sourceSnapshot) !== canonical(expected.data) || canonical(product.data.sourceSnapshot) !== canonical(expected.data)) throw new MigrationError('RECONCILIATION_PROVENANCE_INVALID')
      if (seenStores.size !== stores.size) fail()
      for (const claim of overflowClaims) if (!overflowReceipts.has(claim)) fail()
      for (const store of stores.values()) for (const sourceId of store.products.keys()) if (!seenProducts.has(sourceId)) fail()
      finished = true
    },
  }
}
export type ReconciliationIndex = ReturnType<typeof createReconciliationIndex>
