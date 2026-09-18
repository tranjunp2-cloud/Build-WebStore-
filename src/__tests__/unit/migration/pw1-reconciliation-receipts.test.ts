// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { emptyStore, type Row, type StoreOutput } from '@/lib/migration/pw1-export/contracts'
import { mapCatalog } from '@/lib/migration/pw1-export/mappers/catalog'
import { mapCommerce } from '@/lib/migration/pw1-export/mappers/commerce'
import { productDocumentSchema } from '@/lib/migration/pw1-export/mappers/catalog-schemas'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'
import {
  buildCustomerReceiptStore, buildProductReceiptEntries, customerDiagnosticsSchema,
  receiptSnapshot, validateReconciliationReceipts, type CustomerDiagnostics,
} from '@/lib/migration/pw1-export/reconciliation-receipts'

const dates = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
const config = sourceConfigSchema.parse({
  version: 1, sourceInstance: 'fixture', sourceDatabase: 'test', sourceInstanceToken: 'fixture',
  snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00',
  sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' },
  deletedStores: 'review', migrationPolicy: { decisionEvidence: 'approved test', activeCatalogOnly: true,
    allowSparseVariants: true, siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults' },
})
function fixture(code: string | null = null, variants = false) {
  const tables: Record<string, Row[]> = {
    stores: [{ id: '1', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }],
    categories: [{ id: '10', store_id: '1', name: 'Books', slug: 'books', status: '1', ...dates }],
    products: [{ status: '1', id: '20', store_id: '1', category_id: '10', name: 'Book one', slug: 'book-one', ...dates }],
    product_skus: [{ id: '30', store_id: '1', product_id: '20', status: '1', sku: code, price: '12.50', stock: '5', ...dates }],
    customers: [
      { id: '40', store_id: '1', name: 'Original', phone: '0123456789', rank_id: '70', ...dates },
      { id: '41', store_id: '1', name: 'Latest', phone: '0123456789', rank_id: '71', ...dates, created_at: '2025-01-02 00:00:00', updated_at: '2025-01-03 00:00:00' },
    ],
    ranks: [{ id: '70', store_id: '1', level: '1' }, { id: '71', store_id: '1', level: '2' }],
    orders: [{ id: '50', store_id: '1', customer_id: '41', shipping_address_id: '60', billing_address_id: '60', ...dates }],
    addresses: [{ id: '60', store_id: '1', address: 'Street', country_id: '1' }],
    countries: [{ id: '1', name: 'Malaysia', deleted_at: '2024-01-01' }],
  }
  if (variants) {
    tables.attributes = [{ id: '80', store_id: '1', name: 'Size', code: 'size' }]
    tables.attribute_values = [{ id: '81', store_id: '1', attribute_id: '80', name: 'Small' }]
    tables.product_attributes = [{ id: '82', product_id: '20', attribute_id: '80', attribute_value_id: '81' }]
    tables.product_variants = [{ id: '83', product_sku_id: '30', attribute_id: '80', attribute_value_id: '81' }]
  }
  const output = emptyStore()
  output.tenants.push({ _ref: '@tenants:stores:1', metaData: { pw1StoreId: '1' } })
  output.sites.push({ _ref: '@sites:stores:1', tenant: '@tenants:stores:1' })
  const ctx = new SourceIndex(tables).context(config, '1', output, [], [])
  let captured: CustomerDiagnostics | undefined
  ctx.captureCustomerReconciliation = value => { captured = customerDiagnosticsSchema.parse(value) }
  return { ctx, tables, run() { mapCatalog(ctx); mapCommerce(ctx) }, receipts() {
    return {
      customer: { version: 1, sourceSnapshot: receiptSnapshot(config), archiveStorage: 'external-source-csv', stores: [buildCustomerReceiptStore(ctx, captured)] },
      product: { version: 1, sourceSnapshot: receiptSnapshot(config), products: buildProductReceiptEntries(ctx) },
      rows: Object.entries(tables).flatMap(([table, rows]) => rows.map(row => ({ table, sourceId: row.id!, storeId: row.store_id ?? null }))),
    }
  } }
}
function validate(f: ReturnType<typeof fixture>, receipts = f.receipts(), master: StoreOutput[] = [f.ctx.output]) {
  return validateReconciliationReceipts(receipts.customer, receipts.product, receiptSnapshot(config), master, receipts.rows)
}

describe('[TC-F42-078] Optional business SKU codes', () => {
  it.each([null, '', '   '])('retains simple product price without code %j', code => {
    // Arrange
    const f = fixture(code)
    // Act
    f.run()
    // Assert
    expect(f.ctx.output.products).toHaveLength(1)
    expect(f.ctx.output.products[0]).not.toHaveProperty('sku')
    expect(f.ctx.output.products[0].price).toBe(12.5)
    expect(productDocumentSchema.safeParse(f.ctx.output.products[0]).success).toBe(true)
  })
  it.each([50, 51, 100])('preserves variant code with %i characters', length => {
    const f = fixture('X'.repeat(length), true)
    f.run()
    expect(productDocumentSchema.safeParse(f.ctx.output.products[0]).success).toBe(true)
    expect((f.ctx.output.products[0].variants as { sku: string }[])[0].sku).toBe('X'.repeat(length))
  })
  it('rejects oversized variants and missing price rows', () => {
    const long = fixture('X'.repeat(101), true), missing = fixture()
    missing.tables.product_skus.length = 0
    long.run(); missing.run()
    expect(long.ctx.output.products).toEqual([])
    expect(missing.ctx.output.products).toEqual([])
    expect(missing.ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_MISSING_PRICE_STOCK_EXCLUDED', severity: 'warning', reason: 'NO_SKU_ROWS' }))
  })
  it('keeps the existing 50-character limit on a configured simple SKU', () => {
    // Arrange
    const valid = fixture('S'.repeat(50)), invalid = fixture('S'.repeat(51))
    // Act
    valid.run(); invalid.run()
    // Assert
    expect(productDocumentSchema.safeParse(valid.ctx.output.products[0]).success).toBe(true)
    expect(invalid.ctx.output.products).toEqual([])
  })
  it('does not treat multiple blank codes as collisions', () => {
    const f = fixture()
    f.run()
    f.ctx.output.products.push({ ...f.ctx.output.products[0], _ref: '@products:products:21', slug: 'book-two', sku: '' })
    f.ctx.output.products[0].sku = ''
    expect(operationalIssues([f.ctx.output], undefined, config.migrationPolicy)).toEqual([])
  })
})

describe('[TC-F42-079/080] Source reconciliation evidence', () => {
  it.each([false, true])('exports source identities for simple/variant=%s and customer decisions', variants => {
    const f = fixture(null, variants)
    f.run()
    const result = validate(f)
    expect(result.products.products[0].skus[0]).toMatchObject({ sourceSkuId: '30', targetPath: variants ? 'variants.0' : '', selectedTuple: variants ? [['80', '81']] : [] })
    expect(result.customers.stores[0].diagnostics.customerCrosswalk).toContainEqual({ sourceCustomerId: '41', targetRef: '@customers:customers:40', disposition: 'merged' })
    expect(result.customers.stores[0].diagnostics.addressDispositions).toEqual([
      expect.objectContaining({ usage: 'Shipping', targetIndex: 0, legacyGeographyTypes: ['country'], disposition: 'emitted' }),
      expect.objectContaining({ usage: 'Billing', targetIndex: 0, disposition: 'deduplicated' }),
    ])
    expect(result.customers.stores[0].diagnostics.rankConflicts[0].selectedSourceRankId).toBe('70')
    expect(result.customers.stores[0].diagnostics.profileConflicts[0].nameSourceId).toBe('41')
    expect(result.customers.archiveStorage).toBe('external-source-csv')
  })
  it('records address overflow and retains every source relation outside the payload', () => {
    // Arrange
    const f = fixture()
    f.tables.orders = Array.from({ length: 11 }, (_, i) => ({ id: String(500 + i), store_id: '1', customer_id: '40', shipping_address_id: String(600 + i), ...dates }))
    f.tables.addresses = Array.from({ length: 11 }, (_, i) => ({ id: String(600 + i), store_id: '1', address: `Street ${i}`, country_id: '1' }))
    // Rebuild indexes after replacing source tables.
    const ctx = new SourceIndex(f.tables).context(config, '1', f.ctx.output, [], [])
    let evidence: CustomerDiagnostics | undefined
    ctx.captureCustomerReconciliation = value => { evidence = customerDiagnosticsSchema.parse(value) }
    // Act
    mapCommerce(ctx)
    const receipt = buildCustomerReceiptStore(ctx, evidence)
    // Assert
    expect(ctx.output.customers[0].addresses).toHaveLength(10)
    expect(receipt.diagnostics.addressDispositions.filter(entry => entry.disposition === 'overflow')).toEqual([expect.objectContaining({ sourceAddressId: '610', sourceOrderId: '510', targetIndex: null })])
    expect(receipt.retainedSourceRows.filter(row => row.table === 'addresses')).toHaveLength(11)
    expect(receipt.retainedSourceRows.filter(row => row.table === 'orders')).toHaveLength(11)
  })
  it('clears targets after downstream product and customer quarantine', () => {
    const f = fixture(null, true)
    f.run(); f.ctx.output.products = []; f.ctx.output.customers = []
    const result = validate(f)
    expect(result.products.products[0]).toMatchObject({ emitted: false, targetRef: null, tiers: [], skus: [expect.objectContaining({ targetPath: null, targetId: null })] })
    expect(result.customers.stores[0].quarantinedCustomerRefs).toEqual(['@customers:customers:40'])
    expect(result.customers.stores[0].diagnostics.addressDispositions[0].targetIndex).toBeNull()
  })
  it.each(['tuple', 'duplicate-sku', 'foreign-sku', 'address-index', 'profile-customer', 'namespace', 'missing-product'])('rejects corrupted %s evidence', corruption => {
    const f = fixture('SKU', true)
    f.run()
    const r = f.receipts()
    if (corruption === 'tuple') r.product.products[0].skus[0].selectedTuple[0][1] = 'other'
    if (corruption === 'duplicate-sku') r.product.products[0].skus.push(r.product.products[0].skus[0])
    if (corruption === 'foreign-sku') r.rows.find(row => row.table === 'product_skus')!.storeId = '2'
    if (corruption === 'address-index') r.customer.stores[0].diagnostics.addressDispositions[0].targetIndex = 9
    if (corruption === 'profile-customer') r.customer.stores[0].diagnostics.profileConflicts[0].nameSourceId = '999'
    if (corruption === 'namespace') r.product.sourceSnapshot.sourceInstanceToken = 'other'
    if (corruption === 'missing-product') r.product.products.length = 0
    expect(() => validate(f, r)).toThrow(/RECONCILIATION_/)
  })
})
