// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { rawRow } from '@/lib/migration/pw1-export/mappers/raw'
import { mapRawContent } from '@/lib/migration/pw1-export/mappers/content-raw'
import { dispositions } from '@/lib/migration/pw1-export/source-dispositions'
import { validateClassification } from '@/lib/migration/pw1-export/validate-classification'
import { validateRawSettings } from '@/lib/migration/pw1-export/raw-settings-proof'

function fixture() {
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'test', sourceDatabase: 'test', sourceInstanceToken: 'test', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review' })
  const setting = (id: string, model: string, modelId: string, storeId: string, value: string | null): Row => ({ id, model_type: `App\\Models\\${model}`, model_id: modelId, store_id: storeId, key: 'content', value })
  const tables = {
    stores: [{ id: '411' }, { id: '465' }],
    pages: [{ id: '11961', store_id: '411', deleted_at: '' }],
    page_components: [{ id: '36048', page_id: '11961', store_id: '411', deleted_at: '2025-01-01' }],
    model_settings: [
      setting('227559', 'PageComponent', '36048', '411', '  <p><a href="tel:011 1259 5933">Call</a> password: opaque text</p>\n'),
      setting('2', 'Store', '411', '', '{broken'),
      setting('3', 'Product', '999', '411', ''),
      setting('4', 'PageComponent', '36048', '465', 'Foreign owner'),
      setting('5', 'Other', '555', '411', null),
      setting('6', 'Other', 'missing', '', 'Unowned'),
    ],
  }
  const output = emptyStore()
  output.tenants.push({ _ref: '@tenants:stores:411' })
  output.sites.push({ _ref: '@sites:stores:411' })
  const ctx = new SourceIndex(tables).context(config, '411', output, [], [])
  mapRawContent(ctx)
  const rows = dispositions({ inputRoot: '/unused', config, tables, files: Object.entries(tables).map(([table, items]) => ({ table, filename: `${table}.csv`, sha256: '0'.repeat(64), bytes: 1, selected: true, rowCount: items.length, headers: Object.keys(items[0]) })) }, ctx.contributions, ctx.diagnostics)
  return { ctx, rows, tables }
}

describe('[TC-F42-EXP-112] restored model settings', () => {
  it('preserves raw values exactly, resolves blank Store ID and retains orphan/deleted-parent rows once', () => {
    // Arrange / Act
    const { ctx, rows, tables } = fixture()
    // Assert
    expect(JSON.stringify(ctx.output)).toContain('tel:011 1259 5933')
    expect(ctx.output.pages[0].components).toMatchObject([{ model_settings: [tables.model_settings[0]] }])
    expect(ctx.output.sites[0].raw_model_settings).toEqual([tables.model_settings[1], tables.model_settings[2], tables.model_settings[4]])
    expect(ctx.contributions.filter(c => c.table === 'model_settings').map(c => c.sourceId)).toEqual(['227559', '2', '3', '5'])
    expect(ctx.diagnostics.some(d => ['RAW_VALUE_UNVERIFIED','MODEL_SETTINGS_OUTSIDE_SCOPE'].includes(d.code))).toBe(false)
    expect(rows.find(r => r.sourceId === '4' && r.table === 'model_settings')?.ownership).toEqual({ storeId: '465', rule: 'SOURCE_SETTING_STORE_ID' })
    expect(() => validateClassification(rows,ctx.diagnostics)).not.toThrow()
    expect(() => validateRawSettings([ctx.output],rows)).not.toThrow()
  })
  it('excludes structured credential columns without censoring the content value', () => {
    // Arrange
    const { ctx } = fixture()
    const source = { id: '99', value: 'password: source prose', key_string: 'private', recovery_codes: 'private' }
    // Act
    const raw = rawRow(ctx,'model_settings',source,'sites.raw_model_settings')
    // Assert
    expect(raw).toEqual({ id: '99', value: 'password: source prose' })
    expect(ctx.contributions.at(-1)?.fields).toEqual(['id','value'])
  })
  it.each(['duplicate','missing','wrong-store','wrong-parent','forged-receipt'])('rejects %s settings evidence', mutation => {
    // Arrange
    const { ctx, rows } = fixture()
    const raw = ctx.output.sites[0].raw_model_settings as Row[]
    if (mutation === 'duplicate') raw.push({ ...raw[0] })
    if (mutation === 'missing') raw.pop()
    if (mutation === 'wrong-store') raw[0].store_id = '465'
    if (mutation === 'wrong-parent') {
      const component = (ctx.output.pages[0].components as { model_settings: Row[] }[])[0]
      component.model_settings[0].model_id = 'wrong'
    }
    if (mutation === 'forged-receipt') rows.find(row => row.table === 'model_settings' && row.sourceId === '2')!.contributions[0].targetPath = 'sites.name'
    // Act / Assert
    expect(() => validateRawSettings([ctx.output],rows)).toThrow('MODEL_SETTINGS_EVIDENCE_INVALID')
  })
})
