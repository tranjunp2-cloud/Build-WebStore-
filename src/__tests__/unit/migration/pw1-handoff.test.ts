// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildHandoff } from '@/lib/migration/pw1-export/handoff'

describe('[TC-F42-EXP-090] Source handoff triage', () => {
  it('separates source errors, importer gates, warnings, exclusions and clear diagnostics', () => {
    // Arrange
    const stores = ['1','2','3','4','5','6'].map(storeId => ({ storeId, exportStatus: storeId === '4' ? 'excluded' : storeId === '6' ? 'blocked' : 'emitted' }))
    // Act
    const result = buildHandoff(stores, [
      { storeId: '1', code: 'PRODUCT_SKU_COLLISION', severity: 'blocker', table: 'products', sourceId: '10' },
      { storeId: '2', code: 'TARGET_USER_CREATOR_BINDING_REQUIRED', severity: 'blocker', table: 'users', field: 'created_by' },
      { storeId: '3', code: 'UNKNOWN_WARNING', severity: 'warning' },
      { storeId: '4', code: 'UNKNOWN_ERROR', severity: 'blocker' },
    ])
    // Assert
    expect(result.stores.map(s => s.status)).toEqual(['source_blocked','importer_verification_required','importer_verification_required','excluded','source_diagnostics_clear','source_blocked'])
    expect(result.stores.every(s => s.importReady === false)).toBe(true)
    expect(result.stores[0].issues[0].sourceIds).toEqual(['10'])
    expect(Object.values(result.counts).reduce((a,b) => a+b,0)).toBe(6)
  })
  it('keeps global issues visible without asserting every Store has a source error', () => {
    // Arrange / Act
    const result = buildHandoff([{ storeId: '1', exportStatus: 'emitted' }, { storeId: '2', exportStatus: 'excluded' }], [
      { code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table: 'model_settings', sourceId: '99' },
    ])
    // Assert
    expect(result.stores[0].status).toBe('global_review_required')
    expect(result.stores[1].status).toBe('excluded')
    expect(result.globalIssues[0].sourceIds).toEqual(['99'])
  })
})
