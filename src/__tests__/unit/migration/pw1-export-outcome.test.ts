// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { exportOutcome, exportReview, externalArchiveKeys, reviewCategory, reviewMarkdown } from '@/lib/migration/pw1-export/export-outcome'
import type { Diagnostic } from '@/lib/migration/pw1-export/contracts'
const creator: Diagnostic = { code: 'TARGET_USER_CREATOR_BINDING_REQUIRED', severity: 'blocker', storeId: '1', table: 'users', sourceId: '2', field: 'created_by' }
describe('[TC-F42-EXP-088] Export outcome versus import readiness', () => {
  it('reports completed data with pending creator binding without claiming import readiness', () => {
    // Arrange / Act
    const outcome = exportOutcome([creator], 0, [])
    // Assert
    expect(outcome).toMatchObject({ exportStatus: 'succeeded', dataStatus: 'complete', importStatus: 'not_verified', importRequirementCount: 1, dataIssueCount: 0 })
    expect(creator.severity).toBe('blocker')
    const markdown = reviewMarkdown(exportReview([creator], [], []))
    expect(markdown).toContain('\n\n- Export: succeeded\n')
    expect(markdown).not.toContain('\\n')
    expect(markdown).toContain('1/2')
  })
  it('keeps blocked Stores partial even without record diagnostics', () => {
    expect(exportOutcome([], 1, []).dataStatus).toBe('partial')
  })
  it.each(['SOURCE_NO_ELIGIBLE_SKU', 'BLOG_SLUG_COLLISION', 'PRODUCT_DESCRIPTION_LINK_UNSAFE', 'PRODUCT_DESCRIPTION_MEDIA_UNRESOLVED', 'UNKNOWN_ERROR'])('does not hide %s', code => {
    expect(reviewCategory({ code, severity: 'blocker', table: 'products', sourceId: '2', field: 'description' })).toBe('data_issue')
  })
  it('delegates only the approved rich-text fidelity fields and keeps diagnostic evidence', () => {
    const diagnostic: Diagnostic = { code: 'PRODUCT_DESCRIPTION_STYLE_FIDELITY', severity: 'blocker', table: 'products', sourceId: '2', field: 'description' }
    const review = exportReview([diagnostic], [], [])
    expect(review).toMatchObject({ dataStatus: 'complete', delegatedContentCount: 1 })
    expect(review.groups[0]).toMatchObject({ code: diagnostic.code, examples: [{ sourceId: '2' }] })
    expect(reviewCategory({ ...diagnostic, field: 'price' })).toBe('data_issue')
  })
  it('requires exclusive external contributions and verified ownership for raw CSV scope', () => {
    const row = { table: 'model_settings', sourceId: '9', storeId: '1', ownership: { rule: 'SOURCE_STORE_ID' }, contributions: [{ table: 'model_settings', sourceId: '9', storeId: '1', rule: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE', targetPath: 'source-csv.model_settings' }] }
    const d: Diagnostic = { code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', table: row.table, sourceId: row.sourceId, storeId: '1', field: 'value', reason: 'UNKNOWN_SETTING_KEY' }
    expect(reviewCategory(d, new Set(externalArchiveKeys(row)))).toBe('outside_scope')
    expect(reviewCategory(d)).toBe('data_issue')
    expect(externalArchiveKeys({ ...row, ownership: { rule: 'OWNERSHIP_STORE_CONFLICT' } })).toEqual([])
    expect(externalArchiveKeys({ ...row, contributions: [...row.contributions, { ...row.contributions[0], targetPath: 'sites.theme', rule: 'MASTER-4' }] })).toEqual([])
    expect(reviewCategory({ ...d, storeId: '2' }, new Set(externalArchiveKeys(row)))).toBe('data_issue')
  })
})

describe('[TC-F42-EXP-089] Corrected outcome scope', () => {
  const payment: Diagnostic = { code: 'ORDER_PAYMENT_METHOD_UNVERIFIED', severity: 'warning', storeId: '31', sourceId: '18', table: 'orders', field: 'payment_method_id' }
  const cancellation: Diagnostic = { code: 'SUBSCRIPTION_CANCEL_FLAG_ABSENT', severity: 'warning', storeId: '1', sourceId: '27', table: 'plan_subscriptions', field: 'canceled_immediately', reason: 'NO_CANCELLATION_DATE' }
  it('counts exact warning-based importer gates as requirements, without changing severity', () => {
    // Arrange / Act
    const report = exportReview([payment, cancellation], [], [])
    // Assert
    expect(report).toMatchObject({ importRequirementCount: 2, warningCount: 0, dataStatus: 'complete' })
    expect(payment.severity).toBe('warning')
    expect(reviewCategory({ ...payment, sourceId: undefined })).toBe('warning')
    expect(reviewCategory({ ...cancellation, reason: 'OTHER' })).toBe('warning')
    expect(reviewCategory({ ...payment, table: 'users' })).toBe('warning')
  })
  it('keeps excluded Store evidence without affecting in-scope data completeness', () => {
    // Arrange
    const excluded: Diagnostic = { code: 'TENANT_LIFECYCLE_CONFLICT', severity: 'blocker', storeId: '323' }
    // Act
    const review = exportReview([excluded], [], ['323'])
    // Assert
    expect(review).toMatchObject({ dataStatus: 'complete', dataIssueCount: 0, policyExcludedDiagnosticCount: 1, policyExcludedStoreCount: 1 })
    expect(review.groups[0]).toMatchObject({ category: 'policy_excluded', code: excluded.code, examples: [{ storeId: '323' }] })
    expect(exportReview([excluded, { ...excluded, storeId: '324' }], [], ['323']).dataStatus).toBe('partial')
    expect(exportReview([excluded, { ...excluded, storeId: undefined }], [], ['323']).dataStatus).toBe('partial')
    expect(exportReview([payment], [], ['31']).importRequirementCount).toBe(0)
  })
})
