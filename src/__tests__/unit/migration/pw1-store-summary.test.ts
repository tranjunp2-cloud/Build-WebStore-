import { describe, expect, it } from 'vitest'
import { emptyStore, type Diagnostic } from '@/lib/migration/pw1-export/contracts'
import { storeSummaries } from '@/lib/migration/pw1-export/store-summary'

describe('[TC-F42-EXP-016] Per-store mapping summary', () => {
  it('distinguishes blocked stores, retained data review, target constraints and excludes global claims', () => {
    const store = emptyStore()
    store.tenants.push({ metaData: { pw1StoreId: '2' } })
    store.products.push({ _ref: '@products:products:20' })
    const diagnostics: Diagnostic[] = [
      { storeId: '2', code: 'SITE_SHIPPING_MAPPING_UNRESOLVED', severity: 'blocker' },
      { storeId: '2', code: 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP', severity: 'blocker' },
      { storeId: '2', code: 'SHORT_DESCRIPTION_TOO_LONG', severity: 'blocker' },
      { storeId: '2', code: 'STAFF_REVIEW', severity: 'warning' },
      { storeId: '10', code: 'TENANT_LIFECYCLE_CONFLICT', severity: 'blocker' },
      { code: 'GLOBAL_SOURCE_GAP', severity: 'blocker' },
    ]
    const before = structuredClone(diagnostics)

    const summaries = storeSummaries([store], diagnostics, ['10'], ['20'])

    expect(summaries.map(s => s.storeId)).toEqual(['2', '10', '20'])
    expect(summaries[0]).toMatchObject({
      exportStatus: 'emitted', mappingStatus: 'needs_review', blockerDiagnosticCount: 3,
      warningDiagnosticCount: 1, collectionCounts: { products: 1 },
      mappingReviewCodes: ['SITE_SHIPPING_MAPPING_UNRESOLVED'],
      targetConstraintCodes: ['TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP'],
      otherBlockerCodes: ['SHORT_DESCRIPTION_TOO_LONG'],
    })
    expect(summaries[1]).toMatchObject({ exportStatus: 'blocked', collectionCounts: { products: 0 } })
    expect(summaries[2]).toMatchObject({ exportStatus: 'excluded', mappingStatus: 'excluded' })
    expect(diagnostics).toEqual(before)
  })
  it('no store-specific blocker does not claim complete mapping or import readiness', () => {
    const store = emptyStore()
    store.tenants.push({ metaData: { pw1StoreId: '1' } })
    const [summary] = storeSummaries([store], [{ code: 'GLOBAL_GAP', severity: 'blocker' }], [], [])
    expect(summary.mappingStatus).toBe('no_store_blockers')
    expect(summary).not.toHaveProperty('importReady')
  })
})

describe('[TC-F42-EXP-089] Per-Store publication semantics', () => {
  it('does not report successful publication for blocked or excluded Stores', () => {
    // Arrange
    const store = emptyStore(); store.tenants.push({ metaData: { pw1StoreId: '1' } })
    const diagnostics: Diagnostic[] = [{ storeId: '323', code: 'TENANT_LIFECYCLE_CONFLICT', severity: 'blocker' }]
    // Act
    const summaries = storeSummaries([store], diagnostics, ['28'], ['323'], true)
    // Assert
    expect(summaries[0]).toMatchObject({ exportStatus: 'emitted', outcome: { exportStatus: 'emitted', dataStatus: 'complete', importStatus: 'not_verified' } })
    expect(summaries[1]).toMatchObject({ exportStatus: 'blocked', outcome: { exportStatus: 'blocked', dataStatus: 'partial' } })
    expect(summaries[2]).toMatchObject({ exportStatus: 'excluded', outcome: { exportStatus: 'excluded', dataStatus: 'excluded', importStatus: 'not_applicable', dataIssueCount: 0, policyExcludedDiagnosticCount: 1 } })
  })
})
