// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { readFixtureMasterText, writeFixtureMaster } from '@/__tests__/helpers/pw1-master-artifact'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { validateArtifact } from '@/lib/migration/pw1-export/validate-artifact'
import { MODEL_SETTINGS_MASTER_SHA256 } from '@/lib/migration/pw1-export/master-version'
import type { RowDisposition } from '@/lib/migration/pw1-export/source-dispositions'
import type { Diagnostic } from '@/lib/migration/pw1-export/contracts'

let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-social-media-artifact-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
async function fixture() {
  const source = await writeExportFixture(root), output = path.join(root, 'artifact')
  await writeFile(path.join(source.input, 'medias.csv'), 'id,store_id,name,url,type,parent_id,created_by,signature,deleted_at,created_at,updated_at\n1252,1,Original,https://Legacy.EXAMPLE.test/A%2Fb.PNG?w=100,1,0,1,,,,\n1253,1,Folder,,2,0,1,,,,\n1254,1,Deleted,https://old.test/deleted.png,1,0,1,,2022-02-28 07:32:46,,\n')
  const config = JSON.parse(await readFile(source.configPath, 'utf8'))
  config.tables.medias = 'medias.csv'
  config.tables.model_settings = 'model_settings.csv'
  await writeFile(path.join(source.input, 'model_settings.csv'), 'id,model_type,model_id,key,value\n201,Unknown,999,title,original\n')
  await writeFile(source.configPath, JSON.stringify(config))
  await exportMaster(source.input, source.configPath, output)
  return output
}
async function report(output: string) { return JSON.parse(await readFile(path.join(output, 'mapping-report.json'), 'utf8')) as { rows: RowDisposition[]; diagnostics: Diagnostic[] } }
async function rewriteReport(output: string, value: unknown) {
  const text = JSON.stringify(value)
  await writeFile(path.join(output, 'mapping-report.json'), text)
  const manifest = JSON.parse(await readFile(path.join(output, 'master-manifest.json'), 'utf8'))
  manifest.artifacts['mapping-report.json'] = digest(text)
  await writeFile(path.join(output, 'master-manifest.json'), JSON.stringify(manifest))
}

describe('[TC-F42-EXP-110] Hashed standalone media evidence', () => {
  it('roundtrips real mapped media and source-only folder through export and validator', async () => {
    // Arrange / Act
    const output = await fixture()
    const result = await validateArtifact(output)
    const stores = JSON.parse(await readFixtureMasterText(output))
    // Assert
    expect(result.integrityStatus).toBe('valid')
    const media = stores.flatMap((store: { media: Record<string, unknown>[] }) => store.media)
    expect(media).toContainEqual(expect.objectContaining({ _ref: '@media:medias:1252', url: 'https://Legacy.EXAMPLE.test/A%2Fb.PNG?w=100', sourceUrl: 'https://Legacy.EXAMPLE.test/A%2Fb.PNG?w=100' }))
    expect(media.some((row: Record<string, unknown>) => ['@media:medias:1253', '@media:medias:1254'].includes(String(row._ref)))).toBe(false)
    const evidence = await report(output)
    expect(evidence.rows.find(row => row.table === 'medias' && row.sourceId === '1254')).toMatchObject({ disposition: 'retained-source', contributions: [] })
    expect(evidence.diagnostics).toContainEqual(expect.objectContaining({ code: 'MEDIA_SOURCE_ONLY', sourceId: '1254', severity: 'warning', reason: 'DELETED' }))
  })
  it.each(['old-contract', 'emitted-folder', 'forged-contribution', 'forged-settings-contribution', 'missing-warning'] as const)('rejects rehashed inconsistent source-only media: %s', async mutation => {
    // Arrange
    const output = await fixture()
    const value = await report(output)
    const row = value.rows.find(row => row.table === 'medias' && row.sourceId === '1253')!
    // Act
    if (mutation === 'forged-contribution') row.contributions.push({ storeId: '1', table: 'medias', sourceId: '1253', fields: ['name'], targetPath: 'media[]', rule: 'MASTER-10-EXTERNAL-LIBRARY-MEDIA' })
    if (mutation === 'forged-settings-contribution') value.rows.find(row => row.table === 'model_settings' && row.sourceId === '201')!.contributions.push({ table: 'model_settings', sourceId: '201', fields: ['value'], targetPath: 'sites[].name', rule: 'FAKE_OPERATIONAL_MAPPING' })
    if (mutation === 'missing-warning') value.diagnostics = value.diagnostics.filter(d => !(d.code === 'MEDIA_SOURCE_ONLY' && d.sourceId === '1253'))
    await rewriteReport(output, value)
    if (mutation === 'emitted-folder') {
      const master = JSON.parse(await readFixtureMasterText(output))
      master[0].media.push({ _ref: '@media:medias:1253', url: 'https://old.test/folder.png', sourceUrl: 'https://old.test/folder.png', alt: 'Folder' })
      await writeFixtureMaster(output, master)
    }
    if (mutation === 'old-contract') {
      const oldMaster = JSON.parse(await readFixtureMasterText(output))
      for (const store of oldMaster) for (const site of store.sites) delete site.raw_model_settings
      await writeFixtureMaster(output, oldMaster)
      const filename = path.join(output, 'master-manifest.json')
      const manifest = JSON.parse(await readFile(filename, 'utf8'))
      manifest.exporterVersion = '1.10.1'; manifest.contractSha256 = MODEL_SETTINGS_MASTER_SHA256
      await writeFile(filename, JSON.stringify(manifest))
    }
    // Assert
    await expect(validateArtifact(output)).rejects.toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})
