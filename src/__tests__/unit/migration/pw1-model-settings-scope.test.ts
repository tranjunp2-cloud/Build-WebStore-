// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dispositions } from '@/lib/migration/pw1-export/source-dispositions'
import { validateClassification } from '@/lib/migration/pw1-export/validate-classification'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { MODEL_SETTINGS_SCOPE_RULE } from '@/lib/migration/pw1-export/model-settings-scope'
import type { Diagnostic } from '@/lib/migration/pw1-export/contracts'

function fixture() {
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'test', sourceDatabase: 'test', sourceInstanceToken: 'test', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { model_settings: 'settings.csv' }, deletedStores: 'review' })
  const settings = [
    { id: '36557', model_type: 'Unknown', model_id: '2724', key: 'items.0.srcUpload', value: 'javascript:invalid', api_secret: 'private', novel_field: '{broken' },
    { id: '36562', model_type: 'App\\Models\\MenuLine', model_id: '2724', key: 'items.1.idEdit', value: '{invalid', api_secret: '', novel_field: 'unknown' },
  ]
  const diagnostics: Diagnostic[] = []
  const rows = dispositions({ inputRoot: '/unused', config, tables: { model_settings: settings }, files: [{ table: 'model_settings', filename: 'settings.csv', sha256: '0'.repeat(64), bytes: 1, selected: true, rowCount: settings.length, headers: Object.keys(settings[0]) }] }, [], diagnostics)
  // Historical artifact fixture: current export intentionally uses a different scope.
  for (const row of rows) row.fieldRetentionRules = Object.fromEntries(Object.keys(row.fieldRetentionRules ?? {}).map(field => [field, MODEL_SETTINGS_SCOPE_RULE]))
  diagnostics.splice(diagnostics.findIndex(d => d.code === 'MODEL_SETTINGS_RAW_PRESERVED'), 1, { code: 'MODEL_SETTINGS_OUTSIDE_SCOPE', table: 'model_settings', severity: 'warning' })
  return { rows, diagnostics }
}
describe('[TC-F42-EXP-108] model_settings source-only evidence', () => {
  it('retains unknown fields and invalid values without contributions or source blockers', () => {
    // Arrange / Act
    const { rows, diagnostics } = fixture()
    // Assert
    expect(rows).toHaveLength(2)
    expect(diagnostics.filter(d => d.code === 'MODEL_SETTINGS_OUTSIDE_SCOPE')).toEqual([{ code: 'MODEL_SETTINGS_OUTSIDE_SCOPE', table: 'model_settings', severity: 'warning' }])
    expect(diagnostics.some(d => d.severity === 'blocker')).toBe(false)
    for (const row of rows) {
      expect(row.disposition).toBe('retained-source')
      expect(row.contributions).toEqual([])
      expect(row.storeId).toBeNull()
      expect(row.fields.api_secret).toBe('security-excluded')
      expect(row.fieldRetentionRules?.novel_field).toBe(MODEL_SETTINGS_SCOPE_RULE)
    }
    expect(() => validateClassification(rows, diagnostics, undefined, [], true, new Set(), true, true, true, true, false)).not.toThrow()
  })
  it.each(['old-contract', 'wrong-table', 'duplicate-id', 'false-owner', 'missing-warning', 'forged-contribution', 'secret-retained'])('rejects %s despite approved source-only scope', mutation => {
    // Arrange
    const { rows, diagnostics } = fixture()
    if (mutation === 'wrong-table') rows[0].table = 'products'
    if (mutation === 'duplicate-id') rows.push(structuredClone(rows[0]))
    if (mutation === 'false-owner') rows[0].storeId = '1'
    if (mutation === 'missing-warning') diagnostics.splice(diagnostics.findIndex(d => d.code === 'MODEL_SETTINGS_OUTSIDE_SCOPE'), 1)
    if (mutation === 'forged-contribution') rows[0].contributions.push({ table: 'model_settings', sourceId: rows[0].sourceId, fields: ['value'], targetPath: 'sites[0].name', rule: 'FAKE' })
    if (mutation === 'secret-retained') rows[0].fields.api_secret = 'retained-source'
    // Act / Assert
    expect(() => validateClassification(rows, diagnostics, undefined, [], true, new Set(), true, mutation !== 'old-contract', true, true, false)).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})
