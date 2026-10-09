// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rename, rm, symlink, readdir, stat, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { workflowConfigSchema } from '@/lib/migration/pw1-json/workflow-config'

const script = path.resolve('scripts/data/run-pw1-export.ts')
const loader = path.resolve('node_modules/tsx/dist/loader.mjs')
const preload = path.resolve('scripts/seed-preload.cjs')
let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-run-export-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
function run(args: string[], environment: Record<string, string> = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const { DATABASE_URI: _databaseUri, DATABASE_URL: _databaseUrl, ...baseEnv } = process.env
    execFile(process.execPath, ['--require', preload, '--import', loader, script, ...args], { cwd: root, timeout: 30000, env: { ...baseEnv, ...environment, PAYLOAD_SECRET: '' } }, (error, stdout, stderr) => {
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
  it('uses the default profile, creates unique private runs and reports success separately from partial data', async () => {
    // Arrange
    const f = await fixture()
    await mkdir(path.join(root, 'configs/migration'), { recursive: true })
    await writeFile(path.join(root, 'configs/migration/pw1-prod-profile.json'), await readFile(f.profile))
    const before = await Promise.all((await readdir(f.input)).sort().map(async name => [name, await readFile(path.join(f.input, name), 'utf8')]))
    // Act
    const first = await run(f.args.slice(0, 3)), second = await run(f.args.slice(0, 3))
    // Assert
    expect(first.code, first.stderr).toBe(0)
    expect(second.code, second.stderr).toBe(0)
    const result = JSON.parse(first.stdout), other = JSON.parse(second.stdout)
    expect(result.counts.emittedStoreCount).toBe(3)
    // TC-F42-EXP-090: private, reviewable handoff survives publication without changing the import artifact.
    const handoff = JSON.parse(await readFile(result.handoff.report, 'utf8'))
    expect(handoff.counts).toEqual(result.handoff.counts)
    expect(handoff.stores).toHaveLength(3)
    expect(handoff.importReady).toBe(false)
    expect((await stat(result.handoff.report)).mode & 0o777).toBe(0o600)
    expect(path.dirname(result.handoff.report)).toBe(path.dirname(result.sourceConfig))
    expect(first.stderr).toContain('Chưa xác nhận import-ready')
    expect(result.sourceConfig).not.toBe(other.sourceConfig)
    const config = JSON.parse(await readFile(result.sourceConfig, 'utf8'))
    expect(config.asOf).toBe('2026-09-18T00:00:00Z')
    expect(config.tables.stores).toBe('stores_202609181351.csv')
    expect((await readdir(path.join(path.dirname(result.sourceConfig), 'artifact')))).toContain('master-manifest.json')
    const importConfig = JSON.parse(await readFile(path.join(path.dirname(result.sourceConfig), 'import-config.json'), 'utf8'))
    expect(importConfig.localDatabase).toBe('primeweb')
    expect(importConfig).not.toHaveProperty('targetHost')
    expect((await stat(result.sourceConfig)).mode & 0o777).toBe(0o600)
    expect((await stat(path.dirname(result.sourceConfig))).mode & 0o777).toBe(0o700)
    expect(await Promise.all((await readdir(f.input)).sort().map(async name => [name, await readFile(path.join(f.input, name), 'utf8')]))).toEqual(before)
  })
  it('TC-F42-EXP-085: creates a Neon-ready import config without a connection string', async () => {
    // Arrange
    const f = await fixture()
    const host = 'ep-raspy-mud-b4p48f4e.c-6.us-east-2.aws.neon.tech'
    await writeFile(path.join(root, '.env.local'), `DATABASE_URI=postgresql://owner:secret@${host}/primeweb_test?sslmode=require&channel_binding=require\n`)

    // Act
    const result = await run(f.args)

    // Assert
    expect(result.code, result.stderr).toBe(0)
    const importConfigPath = path.join(path.dirname(JSON.parse(result.stdout).sourceConfig), 'import-config.json')
    const raw = await readFile(importConfigPath, 'utf8')
    const importConfig = JSON.parse(raw)
    expect(importConfig.localDatabase).toBe('primeweb_test')
    expect(importConfig.targetHost).toBe(host)
    expect(importConfig.exportArtifact).toBe('./artifact')
    expect(workflowConfigSchema.safeParse(importConfig).success).toBe(true)
    expect(raw).not.toContain('postgres://')
    expect(raw).not.toContain('secret')
    expect((await stat(importConfigPath)).mode & 0o777).toBe(0o600)
  })
  it.each([
    ['invalid database', ['--target-database', 'primeweb/test'], 'INVALID_TARGET_DATABASE'],
    ['invalid host', ['--target-host', 'evil.example.com'], 'INVALID_TARGET_HOST'],
    ['empty host', ['--target-host', ''], 'INVALID_TARGET_HOST'],
    ['mismatched database', ['--target-database', 'different'], 'IMPORT_TARGET_DATABASE_MISMATCH'],
    ['mismatched host', ['--target-host', 'ep-other.neon.tech'], 'IMPORT_TARGET_HOST_MISMATCH'],
  ])('TC-F42-EXP-085: rejects %s before creating an artifact', async (_kind, options, code) => {
    // Arrange
    const f = await fixture()
    if (_kind.startsWith('mismatched')) await writeFile(path.join(root, '.env.local'), 'DATABASE_URI=postgresql://owner:secret@ep-example.neon.tech/primeweb?sslmode=require\n')

    // Act
    const result = await run([...f.args, ...options])

    // Assert
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(code)
    expect(await readdir(root)).not.toContain('.migration')
  })
  it('TC-F42-EXP-085: infers local database name without a Neon host', async () => {
    // Arrange
    const f = await fixture()
    await writeFile(path.join(root, '.env.local'), 'DATABASE_URI=postgresql://owner:secret@localhost/local_pw2\n')

    // Act
    const result = await run(f.args)

    // Assert
    expect(result.code, result.stderr).toBe(0)
    const importConfig = JSON.parse(await readFile(path.join(path.dirname(JSON.parse(result.stdout).sourceConfig), 'import-config.json'), 'utf8'))
    expect(importConfig.localDatabase).toBe('local_pw2')
    expect(importConfig).not.toHaveProperty('targetHost')
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
    expect(first.code, first.stderr).toBe(0)
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
