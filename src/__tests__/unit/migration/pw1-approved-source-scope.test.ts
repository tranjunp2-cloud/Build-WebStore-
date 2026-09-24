// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dispositions } from '@/lib/migration/pw1-export/source-dispositions'
import { validateClassification } from '@/lib/migration/pw1-export/validate-classification'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { APPROVED_METADATA_RULE, MAPPED_ORDER_METADATA_RULE, TECHNICAL_SCOPE_RULE } from '@/lib/migration/pw1-export/approved-source-scope'
import type { Contribution, Diagnostic, Row } from '@/lib/migration/pw1-export/contracts'

function fixture(tables: Record<string, Row[]>, contributions: Contribution[] = [], policy?: unknown, seeds: Diagnostic[] = []) {
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: Object.fromEntries(Object.keys(tables).map(t => [t, `${t}.csv`])), deletedStores: 'review', migrationPolicy: policy })
  const diagnostics: Diagnostic[] = [...seeds]
  const rows = dispositions({ inputRoot: '/unused', config, tables, files: Object.entries(tables).map(([table, rows]) => ({ table, filename: `${table}.csv`, sha256: '0'.repeat(64), bytes: 1, selected: true, rowCount: rows.length, headers: Object.keys(rows[0]) })) }, contributions, diagnostics)
  return { rows, diagnostics, config }
}
describe('[TC-F42-EXP-111] Approved source-only scope evidence', () => {
  it.each(['queue_sync', 'model_exports'])('ignores %s business payload without faking missing Store ownership', table => {
    // Arrange / Act
    const { rows, diagnostics } = fixture({ [table]: [{ id: '1', store_id: '999', novel_payload: '{invalid', api_secret: 'private' }] })
    // Assert
    expect(rows[0]).toMatchObject({ storeId: null, disposition: 'retained-source', contributions: [], fields: { novel_payload: 'retained-source', api_secret: 'security-excluded' }, fieldRetentionRules: { novel_payload: TECHNICAL_SCOPE_RULE } })
    expect(diagnostics.some(d => d.severity === 'blocker')).toBe(false)
    expect(() => validateClassification(rows, diagnostics)).not.toThrow()
  })
  it.each(['old-contract', 'missing-marker', 'forged-owner', 'forged-contribution', 'wrong-table'])('rejects technical scope %s', mutation => {
    // Arrange
    const { rows, diagnostics } = fixture({ queue_sync: [{ id: '1', store_id: '999', data: 'opaque' }] })
    if (mutation === 'missing-marker') diagnostics.splice(diagnostics.findIndex(d => d.code === 'SOURCE_TABLE_OUTSIDE_SCOPE'), 1)
    if (mutation === 'forged-owner') rows[0].storeId = '999'
    if (mutation === 'wrong-table') rows[0].table = 'products'
    if (mutation === 'forged-contribution') rows[0].contributions.push({ table: 'queue_sync', sourceId: '1', fields: ['data'], targetPath: 'sites[].name', rule: 'FAKE' })
    // Act / Assert
    expect(() => validateClassification(rows, diagnostics, undefined, [], true, new Set(), true, true, true, mutation !== 'old-contract')).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('retains SKU cost/timestamps but leaves unmapped operational price unresolved and Users creator required', () => {
    // Arrange / Act
    const { rows } = fixture({ stores: [{ id: '1' }], products: [{ id: '2', store_id: '1' }], product_skus: [{ id: '3', store_id: '1', product_id: '2', cost: '4', price: '9', created_at: 'old', created_by: '7' }], users: [{ id: '7', store_id: '1', created_by: '8' }] })
    // Assert
    const sku = rows.find(r => r.table === 'product_skus')!
    expect(sku.fieldRetentionRules).toMatchObject({ cost: APPROVED_METADATA_RULE, created_at: APPROVED_METADATA_RULE, created_by: APPROVED_METADATA_RULE })
    expect(sku.fields.price).toBe('unresolved')
    expect(rows.find(r => r.table === 'users')!.fields.created_by).toBe('unresolved')
  })
  it.each(['valid', 'not-emitted', 'missing-root-contribution', 'old-contract'])('requires a complete emitted Order for residual metadata: %s', mutation => {
    // Arrange
    const { rows, diagnostics } = fixture({ stores: [{ id: '1' }], orders: [{ id: '2', store_id: '1', total: '10', prepaid: '3' }], order_details: [{ id: '3', order_id: '2', price_with_tax: '10' }] }, [{ table: 'orders', sourceId: '2', storeId: '1', fields: ['id', 'store_id', 'total'], targetPath: '@orders:orders:2', rule: 'master-7.2' }])
    expect(rows.find(r => r.table === 'orders')!.fieldRetentionRules?.prepaid).toBe(MAPPED_ORDER_METADATA_RULE)
    if (mutation === 'missing-root-contribution') rows.find(r => r.table === 'orders')!.contributions = []
    const refs = new Set(mutation === 'not-emitted' ? [] : ['@orders:orders:2'])
    // Act / Assert
    const validate = () => validateClassification(rows, diagnostics, undefined, [], true, refs, true, true, true, mutation !== 'old-contract')
    if (mutation === 'valid') expect(validate).not.toThrow()
    else expect(validate).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})


describe('[TC-F42-EXP-111] Intentionally omitted discount evidence', () => {
  it.each(['valid', 'flag-off', 'unexpected-error', 'emitted', 'unaccounted-code', 'forged-contribution'])('checks %s', mutation => {
    // Arrange
    const diagnostic: Diagnostic = { code: 'DISCOUNT_MAPPING_INVALID', table: 'promotion_codes', sourceId: '3', storeId: '1', severity: 'warning' }
    const policy = { decisionEvidence: 'approved', siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults', skipInvalidDiscountCodes: true }
    const { rows, diagnostics, config } = fixture({ stores: [{ id: '1' }], promotions: [{ id: '2', store_id: '1', discount_value: 'bad' }], promotion_codes: [{ id: '3', promotion_id: '2', code: 'CODE' }] }, [], policy, [diagnostic])
    if (mutation === 'flag-off') config.migrationPolicy!.skipInvalidDiscountCodes = false
    if (mutation === 'unexpected-error') diagnostics[0].reason = 'UNEXPECTED_MAPPING_ERROR'
    if (mutation === 'unaccounted-code') rows.push({ ...structuredClone(rows.find(row => row.table === 'promotion_codes')!), sourceId: '4' })
    if (mutation === 'forged-contribution') rows.find(row => row.table === 'promotion_codes')!.contributions.push({ table: 'promotion_codes', sourceId: '3', fields: ['code'], targetPath: '@discounts:promotion_codes:3', rule: 'master-7.1' })
    const emitted = new Set(mutation === 'emitted' ? ['@discounts:promotion_codes:3'] : [])
    // Act / Assert
    const validate = () => validateClassification(rows, diagnostics, config.migrationPolicy, [], true, emitted)
    if (mutation === 'valid') expect(validate).not.toThrow()
    else expect(validate).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})
