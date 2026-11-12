// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDiagnosticCollector } from '@/lib/migration/pw1-json/diagnostics'
import { createSelectedSourceScope } from '@/lib/migration/pw1-json/source-scope'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
import { CLASSIFIED_MAPPING_HASH } from '@/lib/migration/pw1-json/artifact'

describe('[TC-F42-IMP-DIAGNOSTIC-SPOOL] bounded final aggregation', () => {
  it('aggregates 120001 distinct classified identities without reclassifying a lossy group', () => {
    // Arrange
    const collector = createDiagnosticCollector({ contractHash: CLASSIFIED_MAPPING_HASH, classificationFinal: true,
      classify: diagnostic => diagnostic.sourceId !== undefined && diagnostic.sourceId !== '120000' ? 'OUT_OF_SCOPE' : undefined })
    // Act
    for (let i = 0; i < 120001; i++) collector.add({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', table: 'model_settings', storeId: '205', sourceId: String(i) })
    const result = collector.result()
    // Assert
    expect(result.summary.total).toBe(120001)
    expect(result.summary.buckets).toHaveLength(2)
    expect(result.summary.blockingCount).toBe(1)
    expect(result.blockers[0]).toMatchObject({ sourceId: '120000', count: 1 })
    expect(result.summary.buckets.every(bucket => bucket.samples.length <= 5)).toBe(true)
  })
  it('streams every exact target identity while retaining only grouped counters', () => {
    // Arrange
    let emitted = 0
    let lastId: string | undefined
    const collector = createDiagnosticCollector({ contractHash: CLASSIFIED_MAPPING_HASH, classificationFinal: true,
      onTargetCheck: diagnostic => { emitted++; lastId = diagnostic.sourceId } })
    // Act
    for (let i = 0; i < 120001; i++) collector.add({ code: 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP', severity: 'blocker', table: 'products', field: 'slug', storeId: '205', sourceId: String(i) })
    const result = collector.result()
    // Assert
    expect(emitted).toBe(120001)
    expect(lastId).toBe('120000')
    expect(result.summary.buckets).toHaveLength(1)
    expect(result.summary.blockingCount).toBe(120001)
    expect(result.summary.buckets[0].diagnostic.sourceId).toBeUndefined()
  })
})

describe('[TC-F42-IMP-DIAGNOSTIC-SPOOL] bounded contribution scope', () => {
  it('handles 500001 contributing rows without retaining a second full source index', () => {
    // Arrange
    const scope = createSelectedSourceScope()
    const store = { storeId: '205', collections: Object.fromEntries(COLLECTIONS.map(name => [name, []])) as ImportStore['collections'] }
    scope.addStore(store)
    // Act
    for (let i = 0; i < 500001; i++) scope.addRow({ table: 'product_images', sourceId: String(i), storeId: '205', record: i + 1,
      disposition: 'mapped', fields: { id: 'mapped' }, ownership: { storeId: '205', rule: 'SOURCE_PARENT_RELATION', parentTable: 'products', parentId: '1' },
      contributions: [{ storeId: '205', table: 'product_images', sourceId: String(i), fields: ['id'], targetPath: 'products.images', rule: 'MASTER-5.2' }] })
    scope.addRow({ table: 'model_has_roles', sourceId: 'orphan', storeId: null, record: 1, disposition: 'unresolved', fields: { id: 'unresolved' },
      ownership: { storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED', parentTable: 'users', parentId: '999' },
      contributions: [{ storeId: '205', table: 'model_has_roles', sourceId: 'orphan', fields: ['id'], targetPath: 'users.roles', rule: 'MASTER-3.4' }] })
    scope.finish(() => false)
    // Assert: an orphan contributing to the selected store is still blocking.
    expect(scope.disposition({ code: 'REPORT_ROW_UNRESOLVED', severity: 'blocker', table: 'model_has_roles', sourceId: 'orphan' })).toBeUndefined()
  })
})
