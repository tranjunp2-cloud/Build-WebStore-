import { createReconciliationIndex } from '@/lib/migration/pw1-json/reconciliation'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createApprovedSourceScopeProof } from '@/lib/migration/pw1-json/approved-source-scope'
import type { ClassificationRow } from '@/lib/migration/pw1-json/classification'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
const technical = 'MASTER-2.2-TECHNICAL-OUTSIDE-SCOPE'
const metadata = 'MASTER-2.2-APPROVED-SOURCE-METADATA'
const orderRule = 'MASTER-7-MAPPED-ORDER-SOURCE-METADATA'
function row(table: string, field: string, rule: string): ClassificationRow {
  return { table, sourceId: '1', storeId: '10', record: 1, disposition: 'retained-source', fields: { [field]: 'retained-source' }, fieldRetentionRules: { [field]: rule }, contributions: [], ownership: { storeId: '10', rule: 'SOURCE_STORE_ID' } }
}
function store(): ImportStore {
  const collections = Object.fromEntries(COLLECTIONS.map(c => [c, []])) as ImportStore['collections']
  collections.orders = [{ _ref: '@orders:orders:1' }]
  return { storeId: '10', collections }
}
describe('[TC-F42-IMP-SCOPE-001] Approved source scope evidence boundaries', () => {
  it('does not authorize new metadata rules under historical contracts', () => {
    // Arrange
    const proof = createApprovedSourceScopeProof(false)
    const source = row('addresses', 'phone', metadata)
    // Act / Assert
    expect(proof.allows(source, 'phone', metadata)).toBe(false)
  })
  it('limits metadata approval to known unsupported fields', () => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true)
    // Act / Assert
    expect(proof.allows(row('addresses', 'phone', metadata), 'phone', metadata)).toBe(true)
    expect(proof.allows(row('addresses', 'address', metadata), 'address', metadata)).toBe(false)
    expect(proof.allows(row('users', 'created_by', metadata), 'created_by', metadata)).toBe(false)
    expect(proof.allows(row('medias', 'signature', metadata), 'signature', metadata)).toBe(false)
  })
  it.each(['missing-marker', 'operational-contribution'])('rejects technical scope with %s', mutation => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true)
    const source = row('queue_sync', 'payload', technical)
    if (mutation === 'operational-contribution') {
      proof.addDiagnostic({ code: 'SOURCE_TABLE_OUTSIDE_SCOPE', table: 'queue_sync', severity: 'warning' })
      source.contributions.push({ table: 'queue_sync', sourceId: '1', storeId: '10', fields: ['payload'], targetPath: '@orders:orders:1', rule: 'master-7.2' })
    }
    // Act / Assert
    expect(() => { proof.addRow(source); proof.finish() }).toThrow('APPROVED_SOURCE_SCOPE_EVIDENCE_INVALID')
  })
  it('accepts technical source-only evidence with its exact marker', () => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true)
    const source = row('queue_sync', 'payload', technical)
    proof.addDiagnostic({ code: 'SOURCE_TABLE_OUTSIDE_SCOPE', table: 'queue_sync', severity: 'warning' })
    // Act
    proof.addRow(source)
    // Assert
    expect(() => proof.finish()).not.toThrow()
    expect(proof.allows(source, 'payload', technical)).toBe(true)
  })
  it.each(['valid', 'absent-order', 'foreign-store', 'missing-contribution'])('checks emitted Order closure: %s', mutation => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true)
    const target = store()
    if (mutation === 'absent-order') target.collections.orders = []
    if (mutation === 'foreign-store') target.storeId = '20'
    proof.addStore(target)
    const source = row('orders', 'tracking_code', orderRule)
    source.contributions = mutation === 'missing-contribution' ? [] : [{ table: 'orders', sourceId: '1', storeId: '10', fields: [], targetPath: '@orders:orders:1', rule: 'master-7.2' }]
    // Act / Assert
    if (mutation === 'valid') {
      proof.addRow(source)
      expect(() => proof.finish()).not.toThrow()
      expect(proof.allows(source, 'tracking_code', orderRule)).toBe(true)
    } else expect(() => { proof.addRow(source); proof.finish() }).toThrow('APPROVED_SOURCE_SCOPE_EVIDENCE_INVALID')
  })
  it.each(['valid', 'wrong-policy', 'missing-defaults'])('verifies actual PW2 shipping defaults: %s', mutation => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true, { shippingPolicy: mutation === 'wrong-policy' ? 'source-verified' : 'pw2-defaults' })
    const target = store()
    target.collections.sites = [{ shippingConfig: { enabled: true, westRate: 800, eastRate: 1500, freeAbove: null, shippingSetupConfirmed: false } }]
    if (mutation === 'missing-defaults') target.collections.sites = []
    const diagnostic = { code: 'SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT', table: 'stores', severity: 'warning' as const, storeId: '10', sourceId: '10', field: 'shipping_fee_config', reason: 'APPROVED_PW2_DEFAULTS' }
    // Act
    proof.addStore(target); proof.addDiagnostic(diagnostic)
    // Assert
    if (mutation === 'valid') { expect(() => proof.finish()).not.toThrow(); expect(proof.disposition(diagnostic)).toBe('OUT_OF_SCOPE') }
    else expect(() => proof.finish()).toThrow('APPROVED_SOURCE_SCOPE_EVIDENCE_INVALID')
  })
  it.each(['valid', 'emitted', 'missing-warning', 'disabled-policy'])('accepts excluded discount only with nonemission evidence: %s', mutation => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true, { skipInvalidDiscountCodes: mutation !== 'disabled-policy' })
    const target = store()
    if (mutation === 'emitted') target.collections.discounts = [{ _ref: '@discounts:promotion_codes:1' }]
    proof.addStore(target)
    if (mutation !== 'missing-warning') proof.addDiagnostic({ code: 'DISCOUNT_MAPPING_INVALID', table: 'promotion_codes', storeId: '10', sourceId: '1', severity: 'warning' })
    const source = row('promotion_codes', 'code', 'MASTER-7-EXCLUDED-DISCOUNT-SOURCE')
    source.ownership = { storeId: '10', rule: 'SOURCE_PARENT_RELATION', parentTable: 'promotions', parentId: '2' }
    // Act / Assert
    if (mutation === 'valid') { proof.addRow(source); expect(() => proof.finish()).not.toThrow() }
    else expect(() => { proof.addRow(source); proof.finish() }).toThrow('APPROVED_SOURCE_SCOPE_EVIDENCE_INVALID')
  })
})


describe('[TC-F42-IMP-SCOPE-001] Overflow receipt binding', () => {
  it.each(['valid', 'missing-receipt', 'disabled-policy'])('checks overflow proof: %s', mode => {
    // Arrange
    const index = createReconciliationIndex({ allowCustomerAddressOverflow: mode !== 'disabled-policy' })
    const target = store(); target.collections.orders = []
    index.addStore(target)
    const source = { table: 'addresses', sourceId: '1', storeId: '10', fieldRetentionRules: { address: 'MASTER-6-ADDRESS-OVERFLOW-SOURCE-ONLY' } }
    // Act / Assert
    if (mode === 'disabled-policy') { expect(() => index.addSourceRow(source)).toThrow('RECONCILIATION_REFERENCES_INVALID'); return }
    index.addSourceRow(source); index.addSourceRow({ table: 'orders', sourceId: '2', storeId: '10' })
    index.validateCustomerStore({ storeId: '10', status: 'reconciled', retainedSourceRows: [{ table: 'addresses', sourceId: '1' }, { table: 'orders', sourceId: '2' }], quarantinedCustomerRefs: [], diagnostics: { customerCrosswalk: [], rankDispositions: [], rankConflicts: [], profileConflicts: [], addressDispositions: mode === 'missing-receipt' ? [] : [{ sourceOrderId: '2', sourceAddressId: '1', targetRef: null, targetIndex: null, usage: 'Shipping', legacyGeographyTypes: [], disposition: 'overflow' }] } })
    const sourceSnapshot = { sourceInstance: 'test', sourceDatabase: 'test', sourceInstanceToken: 'test', snapshotId: 'test', asOf: '2026-09-23T00:00:00Z' }
    const finish = () => index.finish({ version: 1, sourceSnapshot, archiveStorage: 'external-source-csv', stores: [] }, { version: 1, sourceSnapshot, products: [] }, sourceSnapshot)
    if (mode === 'missing-receipt') expect(finish).toThrow('RECONCILIATION_REFERENCES_INVALID')
    else expect(finish).not.toThrow()
  })
  it('rejects unknown discount fields', () => {
    const proof = createApprovedSourceScopeProof(true, { skipInvalidDiscountCodes: true })
    const rule = 'MASTER-7-EXCLUDED-DISCOUNT-SOURCE'
    expect(proof.allows(row('promotion_codes', 'unknown_field', rule), 'unknown_field', rule)).toBe(false)
  })
})


describe('[TC-F42-IMP-SCOPE-001] Raw template warning evidence', () => {
  it.each([true, false])('requires Store source evidence=%s', evidence => {
    // Arrange
    const proof = createApprovedSourceScopeProof(true)
    const diagnostic = { code: 'RAW_TEMPLATE_MISSING', table: 'stores', severity: 'warning' as const, storeId: '10', sourceId: '10', field: 'frontend_template_id' }
    proof.addDiagnostic({ code: 'PAGE_MENU_RAW_SOURCE_ONLY', table: 'frontend_templates', severity: 'warning' })
    proof.addDiagnostic(diagnostic)
    if (evidence) proof.addRow({ table: 'stores', sourceId: '10', storeId: '10', record: 1, disposition: 'mapped', fields: { frontend_template_id: 'mapped' }, contributions: [], ownership: { storeId: '10', rule: 'SOURCE_STORE_ID' } })
    // Act
    proof.finish()
    // Assert
    expect(proof.disposition(diagnostic)).toBe(evidence ? 'OUT_OF_SCOPE' : undefined)
  })
})


describe('[TC-F42-IMP-SCOPE-001] Approved editor and historical Order warnings', () => {
  it.each(['valid','foreign-tenant','custom-permission','owner-role','missing-source','disabled-policy','historical'])('checks editor evidence: %s', mode => {
    // Arrange
    const proof=createApprovedSourceScopeProof(mode!=='historical',{selectOldestOwner:mode!=='disabled-policy'})
    const target=store()
    target.collections.users=[{_ref:'@users:users:1',roles:[mode==='owner-role'?'tenant-owner':'editor'],tenants:[{tenant:mode==='foreign-tenant'?'@tenants:stores:20':'@tenants:stores:10',role:'editor',permissions:mode==='custom-permission'?['manage_users']:[],status:'suspended'}]}]
    proof.addStore(target)
    const source=row('users','signature',metadata)
    source.contributions=[{table:'users',sourceId:'1',storeId:'10',fields:[],targetPath:'@users:users:1',rule:'MASTER-3.2-3.4'}]
    if(mode!=='missing-source'&&mode!=='historical')proof.addRow(source)
    // Act
    proof.finish()
    // Assert
    expect(proof.disposition({code:'USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED',table:'users',storeId:'10',sourceId:'1',severity:'warning'})).toBe(mode==='valid'?'APPROVED_POLICY':undefined)
  })
  it.each(['valid','missing-source','missing-code','operational-discount','disabled-policy'])('checks historical discount warning: %s', mode => {
    // Arrange
    const proof=createApprovedSourceScopeProof(true,{preserveHistoricalOrders:true,allowHistoricalDiscountEligibilityGap:mode!=='disabled-policy'})
    const target=store()
    if(mode!=='missing-code')target.collections.orders[0].discountCode='NEW2AWG'
    if(mode==='operational-discount')target.collections.orders[0].discount='@discounts:promotion_codes:99'
    proof.addStore(target)
    const source=row('orders','promotion_code',orderRule)
    source.contributions=[{table:'orders',sourceId:'1',storeId:'10',fields:[],targetPath:'@orders:orders:1',rule:'master-7.2'}]
    if(mode!=='missing-source')proof.addRow(source)
    // Act
    proof.finish()
    // Assert
    expect(proof.disposition({code:'ORDER_DISCOUNT_REFERENCE_UNVERIFIED',table:'orders',storeId:'10',sourceId:'1',field:'promotion_code',severity:'warning'})).toBe(mode==='valid'?'APPROVED_POLICY':undefined)
  })
  it.each([['promotions','discount_value'],['promotion_codes','code']])('accepts known excluded-discount source field %s.%s', (table,field) => {
    const proof=createApprovedSourceScopeProof(true,{skipInvalidDiscountCodes:true}),rule='MASTER-7-EXCLUDED-DISCOUNT-SOURCE'
    expect(proof.allows(row(table,field,rule),field,rule)).toBe(true)
  })
})
