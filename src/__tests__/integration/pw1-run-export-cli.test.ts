// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rename, rm, symlink, readdir, stat, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'

const script = path.resolve('scripts/data/run-pw1-export.ts')
const loader = path.resolve('node_modules/tsx/dist/loader.mjs')
let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-run-export-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
function run(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(process.execPath, ['--import', loader, script, ...args], { cwd: root, timeout: 30000, env: { ...process.env, DATABASE_URI: 'postgres://invalid.invalid/offline', DATABASE_URL: 'postgres://invalid.invalid/offline', PAYLOAD_SECRET: '' } }, (error, stdout, stderr) => {
      if (error?.killed) return reject(error)
      resolve({ code: error && 'code' in error ? Number(error.code) : 0, stdout, stderr })
    })
  })
}
async function fixture() {
  const source = await writeExportFixture(root)
  const { tables, snapshotId: _snapshot, asOf: _asOf, ...settings } = JSON.parse(await readFile(source.configPath, 'utf8'))
  for (const [table, file] of Object.entries(tables)) {
    await rename(path.join(source.input, file as string), path.join(source.input, `${table}_202609181351.csv`))
  }
  const profile = path.join(root, 'profile.json')
  await writeFile(profile, JSON.stringify({ ...settings, requiredTables: Object.keys(tables) }))
  const args = [source.input, '--as-of', '2026-09-18T00:00:00Z', '--profile', profile]
  return { ...source, profile, args }
}
describe('[TC-F42-EXP-085] One-command offline export', () => {
  it('uses the default profile, creates unique private runs and propagates needs-review status', async () => {
    // Arrange
    const f = await fixture()
    await mkdir(path.join(root, 'configs/migration'), { recursive: true })
    await writeFile(path.join(root, 'configs/migration/pw1-prod-profile.json'), await readFile(f.profile))
    const before = await Promise.all((await readdir(f.input)).sort().map(async name => [name, await readFile(path.join(f.input, name), 'utf8')]))
    // Act
    const first = await run(f.args.slice(0, 3)), second = await run(f.args.slice(0, 3))
    // Assert
    expect(first.code, first.stderr).toBe(2)
    expect(second.code, second.stderr).toBe(2)
    const result = JSON.parse(first.stdout), other = JSON.parse(second.stdout)
    expect(result.counts.emittedStoreCount).toBe(3)
    expect(result.sourceConfig).not.toBe(other.sourceConfig)
    const config = JSON.parse(await readFile(result.sourceConfig, 'utf8'))
    expect(config.asOf).toBe('2026-09-18T00:00:00Z')
    expect(config.tables.stores).toBe('stores_202609181351.csv')
    expect((await readdir(path.join(path.dirname(result.sourceConfig), 'artifact')))).toContain('master-manifest.json')
    expect((await stat(result.sourceConfig)).mode & 0o777).toBe(0o600)
    expect((await stat(path.dirname(result.sourceConfig))).mode & 0o777).toBe(0o700)
    expect(await Promise.all((await readdir(f.input)).sort().map(async name => [name, await readFile(path.join(f.input, name), 'utf8')]))).toEqual(before)
  })
  it('supports explicit output and snapshot identity without overwriting', async () => {
    // Arrange
    const f = await fixture(), output = path.join(root, 'explicit')
    const args = [...f.args, '--snapshot-id', 'stable-snapshot', '--output-dir', output]
    // Act
    const first = await run(args)
    const original = await readFile(path.join(output, 'source-config.json'), 'utf8')
    const second = await run(args)
    // Assert
    expect(first.code, first.stderr).toBe(2)
    expect(JSON.parse(original).snapshotId).toBe('stable-snapshot')
    expect(second.code).toBe(1)
    expect(second.stderr).toContain('OUTPUT_EXISTS')
    expect(await readFile(path.join(output, 'source-config.json'), 'utf8')).toBe(original)
  })
  it.each(['inside-source', 'symlink-output', 'missing-table', 'invalid-as-of', 'missing-profile'])('rejects %s without publishing an artifact', async kind => {
    // Arrange
    const f = await fixture()
    let args = f.args
    if (kind === 'inside-source') args = [...args, '--output-dir', path.join(f.input, 'output')]
    if (kind === 'symlink-output') await symlink(f.input, path.join(root, '.migration'))
    if (kind === 'missing-table') await rm(path.join(f.input, 'stores_202609181351.csv'))
    if (kind === 'invalid-as-of') args = [f.input, '--as-of', 'invalid', '--profile', f.profile]
    if (kind === 'missing-profile') await rm(f.profile)
    // Act
    const result = await run(args)
    // Assert
    expect(result.code, result.stderr).toBe(1)
    expect(result.stdout).toBe('')
    expect(await readdir(f.input)).not.toContain('runs')
    expect(await readdir(f.input)).not.toContain('output')
    if (kind !== 'symlink-output' && kind !== 'inside-source') {
      for (const dir of await readdir(path.join(root, '.migration/runs'))) {
        expect(await readdir(path.join(root, '.migration/runs', dir))).not.toContain('artifact')
      }
    }
  })
  it('requires as-of, redacts unknown arguments and serves help without creating output', async () => {
    // Arrange
    const f = await fixture()
    // Act
    const missing = await run([f.input]), unknown = await run(['--private-secret']), help = await run(['--help'])
    // Assert
    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain('INVALID_CLI_ARGUMENTS')
    expect(unknown.code).toBe(1)
    expect(unknown.stderr).not.toContain('private-secret')
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('npm run migrate:pw1')
    expect(await readdir(root)).not.toContain('.migration')
  })
})
