// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rename, copyFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { parseConfig } from '@/lib/migration/pw1-export/source-config'

let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-snapshot-config-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const run = (args: string[]) => new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
  execFile(process.execPath, ['--import', 'tsx', 'scripts/data/create-pw1-source-config.ts', ...args], { timeout: 15000 }, (error, stdout, stderr) => {
    if (error?.killed) return reject(error)
    resolve({ code: error && 'code' in error ? Number(error.code) : 0, stdout, stderr })
  })
})
async function fixture() {
  const source = await writeExportFixture(root)
  const base = JSON.parse(await readFile(source.configPath, 'utf8'))
  const { tables, snapshotId: _snapshot, asOf: _asOf, ...settings } = base
  for (const [table, file] of Object.entries(tables)) await rename(path.join(source.input, file as string), path.join(source.input, `${table}_202609181351.csv`))
  await writeFile(path.join(source.input, '_attributes__202609181353.csv'), 'id,store_id\n')
  const profile = path.join(root, 'profile.json'), output = path.join(root, 'generated.json')
  await writeFile(profile, JSON.stringify({ ...settings, requiredTables: [...Object.keys(tables), 'attributes'] }))
  return { ...source, profile, output, args: ['--input-dir', source.input, '--profile', profile, '--snapshot-id', 'snapshot-20260918', '--as-of', '2026-09-18T00:00:00Z', '--output', output] }
}
describe('[TC-F42-EXP-084] Portable snapshot config CLI', () => {
  it('discovers new dates and attributes alias and produces config usable by real exporter', async () => {
    // Arrange
    const f = await fixture()
    // Act
    const result = await run(f.args), config = parseConfig(await readFile(f.output))
    const exported = await exportMaster(f.input, f.output, path.join(root, 'artifact'))
    // Assert
    expect(result.code, result.stderr).toBe(0)
    expect(config.snapshotId).toBe('snapshot-20260918')
    expect(config.asOf).toBe('2026-09-18T00:00:00Z')
    expect(config.tables.attributes).toBe('_attributes__202609181353.csv')
    expect(config.tables.stores).toBe('stores_202609181351.csv')
    expect(exported.counts.emittedStoreCount).toBe(3)
    expect((await run(f.args)).stderr).toContain('OUTPUT_EXISTS')
  })
  it.each([
    ['duplicate', 'AMBIGUOUS_SNAPSHOT_TABLE'], ['mixed', 'MIXED_SNAPSHOT_DATES'],
    ['missing', 'MISSING_SNAPSHOT_TABLE'], ['unknown', 'UNEXPECTED_SNAPSHOT_TABLE'],
    ['symlink', 'SYMLINK_SOURCE'], ['invalid-date', 'INVALID_SNAPSHOT_FILENAME_DATE'],
  ])('fails closed for %s without publishing config', async (kind, code) => {
    // Arrange
    const f = await fixture(), store = path.join(f.input, 'stores_202609181351.csv')
    if (kind === 'duplicate') await copyFile(store, path.join(f.input, 'stores_202609181352.csv'))
    if (kind === 'mixed') await rename(store, path.join(f.input, 'stores_202609191351.csv'))
    if (kind === 'missing') await rm(store)
    if (kind === 'unknown') await writeFile(path.join(f.input, 'unknown_202609181351.csv'), 'id\n')
    if (kind === 'symlink') await symlink(store, path.join(f.input, 'link.csv'))
    if (kind === 'invalid-date') await rename(store, path.join(f.input, 'stores_202602301351.csv'))
    // Act
    const result = await run(f.args)
    // Assert
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(code)
    await expect(readFile(f.output)).rejects.toThrow()
  })
  it('refuses output inside CSV directory and does not echo invalid arguments', async () => {
    const f = await fixture()
    const result = await run([...f.args.slice(0, -1), path.join(f.input, 'config.json')])
    expect(result.stderr).toContain('CONFIG_OUTPUT_INSIDE_SOURCE')
    const bad = await run(['--private-secret'])
    expect(bad.code).toBe(1)
    expect(bad.stderr).not.toContain('private-secret')
    expect((await run(['--help'])).code).toBe(0)
  })
})
