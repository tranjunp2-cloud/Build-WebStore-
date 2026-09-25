// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createModelSettingsProof, RAW_SETTINGS_MARKER, RAW_SETTINGS_RULE, UNOWNED_SETTINGS_RULE } from '@/lib/migration/pw1-json/model-settings-proof'
import type { ClassificationRow } from '@/lib/migration/pw1-json/classification'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
const html = '<p><a href="tel:011 1259 5933">Call</a></p>{unparsed json'
const setting = { id: '227559', store_id: '411', model_type: 'App\\Models\\PageComponent', model_id: '36048', key: 'content', value: html }
const marker = { code: RAW_SETTINGS_MARKER, table: 'model_settings', severity: 'warning' as const }
function source(path = 'pages.components.model_settings'): ClassificationRow {
  return { table: 'model_settings', sourceId: setting.id, storeId: '411', record: 1, disposition: 'mapped',
    ownership: { storeId: '411', rule: 'SOURCE_PARENT_RELATION', parentTable: 'page_components', parentId: '36048' },
    fields: Object.fromEntries(Object.keys(setting).map(field => [field, 'mapped' as const])),
    contributions: [{ table: 'model_settings', sourceId: setting.id, storeId: '411', fields: Object.keys(setting), targetPath: path, rule: RAW_SETTINGS_RULE }] }
}
function store(): ImportStore {
  return { storeId: '411', collections: { ...Object.fromEntries(COLLECTIONS.map(c => [c, []])),
    sites: [{ raw_model_settings: [] }], pages: [{ components: [{ id: '36048', model_settings: [{ ...setting }] }] }] } as ImportStore['collections'] }
}
describe('[TC-F42-IMP-RAW-SETTINGS] Raw model_settings proof', () => {
  it('accepts verbatim opaque HTML with spaced tel and invalid JSON', () => {
    // Arrange
    const proof = createModelSettingsProof(true), master = store(), row = source()
    // Act
    proof.addStore(master); proof.addDiagnostic(marker)
    const valid = proof.validContribution(row, row.contributions[0]); proof.addRow(row); proof.finish()
    // Assert
    expect(valid).toBe(true)
    expect(master.collections.pages[0].components).toEqual([{ id: '36048', model_settings: [setting] }])
    expect(proof.disposition(marker)).toBe('OUT_OF_SCOPE')
  })
  it.each(['no-content', 'wrong-store', 'wrong-path', 'missing-field', 'wrong-parent', 'no-marker', 'duplicate-row', 'historical'])('rejects %s evidence', mutation => {
    // Arrange
    const proof = createModelSettingsProof(mutation !== 'historical'), master = store(), row = source()
    if (mutation === 'no-content') master.collections.pages = []
    if (mutation === 'wrong-store') row.storeId = row.ownership.storeId = '465'
    if (mutation === 'wrong-path') row.contributions[0].targetPath = 'products'
    if (mutation === 'wrong-parent') row.ownership.parentId = 'other-component'
    if (mutation === 'missing-field') row.contributions[0].fields = row.contributions[0].fields.filter(f => f !== 'value')
    // Act / Assert
    expect(() => {
      proof.addStore(master); if (mutation !== 'no-marker') proof.addDiagnostic(marker)
      proof.addRow(row); if (mutation === 'duplicate-row') proof.addRow(row); proof.finish()
    }).toThrow('MODEL_SETTINGS_RAW_EVIDENCE_INVALID')
  })
  it('requires each actual master setting to have one report receipt', () => {
    // Arrange
    const proof = createModelSettingsProof(true)
    proof.addStore(store()); proof.addDiagnostic(marker)
    // Act / Assert
    expect(() => proof.finish()).toThrow('MODEL_SETTINGS_RAW_EVIDENCE_INVALID')
  })
  it.each(['valid', 'foreign-direct-store'])('checks direct Store fallback: %s', mutation => {
    // Arrange
    const proof = createModelSettingsProof(true), master = store(), row = source('sites.raw_model_settings')
    master.collections.pages = []
    master.collections.sites[0].raw_model_settings = [{ ...setting, store_id: mutation === 'valid' ? '411' : '465' }]
    row.ownership = { storeId: '411', rule: 'SOURCE_SETTING_STORE_ID' }
    // Act / Assert
    const act = () => { proof.addStore(master); proof.addDiagnostic(marker); proof.addRow(row); proof.finish() }
    if (mutation === 'valid') expect(act).not.toThrow()
    else expect(act).toThrow('MODEL_SETTINGS_RAW_EVIDENCE_INVALID')
  })
  it.each([null, '999', '411'])('allows source-only only outside emitted Stores: %s', storeId => {
    // Arrange
    const proof = createModelSettingsProof(true), master = store(); master.collections.pages = []
    const row: ClassificationRow = { ...source(), storeId, disposition: 'retained-source', contributions: [],
      ownership: { storeId, rule: storeId ? 'SOURCE_SETTING_STORE_ID' : 'OWNERSHIP_PARENT_UNVERIFIED', ...(storeId ? {} : { parentTable: 'pages', parentId: 'absent' }) },
      fields: Object.fromEntries(Object.keys(setting).map(field => [field, 'retained-source' as const])),
      fieldRetentionRules: Object.fromEntries(Object.keys(setting).map(field => [field, UNOWNED_SETTINGS_RULE])) }
    proof.addStore(master); proof.addDiagnostic(marker)
    // Act / Assert
    if (storeId === '411') expect(() => proof.addRow(row)).toThrow('MODEL_SETTINGS_RAW_EVIDENCE_INVALID')
    else { proof.addRow(row); proof.finish(); expect(proof.allows(row, 'value', UNOWNED_SETTINGS_RULE)).toBe(true) }
  })
})
