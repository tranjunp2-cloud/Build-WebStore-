// @vitest-environment node
const adapters = vi.hoisted(() => ({
  binding: vi.fn(), prepare: vi.fn(), full: vi.fn(), users: vi.fn(), destination: vi.fn(), finalize: vi.fn(),
  batch: vi.fn(), schema: vi.fn(), profile: vi.fn(), end: vi.fn(),
}))
vi.mock('pg', () => ({ Pool: class { end = adapters.end } }))
vi.mock('@/lib/migration/pw1-json/prepare-system-creator', () => ({ prepareSystemCreator: adapters.binding }))
vi.mock('@/lib/migration/pw1-json/credentials', () => ({ prepareImportArtifact: adapters.prepare }))
vi.mock('@/lib/migration/pw1-json/destination-map', () => ({ buildDestinationMap: adapters.destination }))
vi.mock('@/lib/migration/pw1-json/prepared-destination', () => ({ finalizePreparedDestination: adapters.finalize }))
vi.mock('@/lib/migration/pw1-json/target-schema', () => ({ assertTargetSchema: adapters.schema }))
vi.mock('@/lib/migration/pw1-json/ledger', async importOriginal => ({ ...await importOriginal<object>(), getBatch: adapters.batch, assertWritableProfile: adapters.profile }))
vi.mock('@/lib/migration/pw1-json/runner', async importOriginal => ({ ...await importOriginal<object>(), runImport: adapters.full }))
vi.mock('@/lib/migration/pw1-json/user-runner', () => ({ runUserImport: adapters.users }))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { runWorkflow } from '@/lib/migration/pw1-json/workflow'
import { workflowArguments, loadWorkflowConfig } from '@/lib/migration/pw1-json/workflow-config'
import { lockWorkflow } from '@/lib/migration/pw1-json/workflow-files'
import { localTarget } from '@/lib/migration/pw1-json/runtime'
import { MigrationError } from '@/lib/migration/pw1-json/errors'
import type { LedgerBatch } from '@/lib/migration/pw1-json/ledger'
import type { Arguments } from '@/lib/migration/pw1-json/runner'
import type { ImportOrchestrationOptions } from '@/lib/migration/pw1-json/orchestration-hooks'

let root: string
const uri = 'postgres://test:test@localhost:5433/primeweb'
const targetHash = () => localTarget(uri, false).identity
const manifestText = '{}\n'
const manifestHash = createHash('sha256').update(manifestText).digest('hex')
async function configFile() {
  const filename = resolve(root, 'local.json')
  await writeFile(filename, JSON.stringify({ version: 1, exportArtifact: './artifact', localDatabase: 'primeweb', outputRoot: './runs', systemCreator: { sourceRef: '@users:users:51', approvedBy: 'tester' } }), { mode: 0o600 })
  return filename
}
async function runDirectory() { return resolve(root, 'runs', (await readdir(resolve(root, 'runs')))[0]) }
async function state(directory: string): Promise<Record<string, unknown>> { return JSON.parse(await readFile(resolve(directory, 'run.json'), 'utf8')) }
async function existingRun(mode = 'full', stage = 'IMPORTING', batchObserved = false) {
  const directory = resolve(root, 'existing')
  await mkdir(resolve(directory, 'prepared'), { recursive: true, mode: 0o700 })
  await writeFile(resolve(directory, 'prepared/import-manifest.json'), manifestText, { mode: 0o600 })
  const saved = { version: 1, mode, batchId: randomUUID(), targetHash: targetHash(), localDatabase: 'primeweb', selection: { all: true }, stage, batchObserved, manifestHash }
  await writeFile(resolve(directory, 'run.json'), JSON.stringify(saved), { mode: 0o600 })
  // Only these binding fields are consulted by orchestration; actual ledger semantics have separate tests.
  const batch = { id: `json:${saved.batchId}`, binding: { manifestHash, manifestPath: resolve(directory, 'prepared/import-manifest.json'), targetHash: targetHash(), ...(mode === 'users' ? { executionScope: 'foundation' } : {}) } } as LedgerBatch
  return { directory, saved, batch }
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubEnv('DATABASE_URI', uri)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  root = await mkdtemp(resolve(tmpdir(), 'pw1-workflow-'))
  adapters.batch.mockRejectedValue(new MigrationError('BATCH_NOT_FOUND'))
  adapters.binding.mockResolvedValue({ bindingPath: resolve(root, 'binding.json'), targetUserId: 17 })
  adapters.prepare.mockImplementation(async ({ output }: { output: string }) => {
    await mkdir(output, { mode: 0o700 })
    await writeFile(resolve(output, 'import-manifest.json'), manifestText, { mode: 0o600 })
  })
  adapters.destination.mockResolvedValue({ status: 'complete' })
  adapters.finalize.mockResolvedValue({ manifestPath: 'prepared/destination-manifest.json', files: [] })
})
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }) })

describe('[TC-F42-IMP-WORKFLOW] One-command migration recovery', () => {
  it('persists batch intent before invoking importer and dry-run never exports destinations', async () => {
    // Arrange
    const config = await configFile()
    adapters.full.mockImplementation(async (_args: Arguments, options: ImportOrchestrationOptions) => {
      expect(await state(await runDirectory())).toMatchObject({ batchId: options.batchId, stage: 'IMPORTING', batchObserved: false })
    })
    // Act
    await runWorkflow(['--config', config, '--all', '--dry-run'], 'full')
    // Assert
    expect(adapters.full).toHaveBeenCalledWith(expect.objectContaining({ all: true, dryRun: true }), expect.objectContaining({ compactOutput: true }))
    expect(adapters.binding.mock.invocationCallOrder[0]).toBeLessThan(adapters.prepare.mock.invocationCallOrder[0])
    expect(adapters.prepare.mock.invocationCallOrder[0]).toBeLessThan(adapters.full.mock.invocationCallOrder[0])
    expect(adapters.destination).not.toHaveBeenCalled()
    expect(await state(await runDirectory())).toMatchObject({ stage: 'DRY_RUN_PASSED' })
  })
  it('dispatches new users run to foundation runner with compact private output', async () => {
    // Arrange
    const config = await configFile()
    // Act
    await runWorkflow(['--config', config, '--store', '636'], 'users')
    // Assert
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.users).toHaveBeenCalledWith(expect.objectContaining({ store: '636' }), expect.objectContaining({ compactOutput: true, quietUsers: true }))
    expect(await readFile(resolve(await runDirectory(), 'events.ndjson'), 'utf8')).toContain('export-destination')
  })
  it('stops credential preparation failure before either import runner', async () => {
    // Arrange
    const config = await configFile()
    adapters.prepare.mockRejectedValueOnce(new MigrationError('MIGRATION_SECRET_REQUIRED'))
    // Act / Assert
    await expect(runWorkflow(['--config', config, '--all'], 'full')).rejects.toThrow('MIGRATION_SECRET_REQUIRED')
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.users).not.toHaveBeenCalled()
    expect(await state(await runDirectory())).toMatchObject({ stage: 'BOUND', error: 'MIGRATION_SECRET_REQUIRED' })
  })
  it('does not prescribe export-only for an incomplete users import', async () => {
    // Arrange
    const config = await configFile()
    adapters.users.mockRejectedValueOnce(new MigrationError('USER_CONFLICT'))
    // Act
    await expect(runWorkflow(['--config', config, '--all'], 'users')).rejects.toThrow('USER_CONFLICT')
    // Assert
    const output = vi.mocked(process.stderr.write).mock.calls.map(call => String(call[0])).join('')
    expect(output).toContain('Users DB resume is unsupported once a batch exists')
    expect(output).not.toContain('Retry:')
  })
  it('prescribes output-only after users import completed but finalization failed', async () => {
    // Arrange
    const run = await existingRun('users', 'IMPORTED', true)
    adapters.batch.mockResolvedValue(run.batch)
    adapters.finalize.mockRejectedValueOnce(new MigrationError('DISK_FULL'))
    // Act
    await expect(runWorkflow(['--run', run.directory, '--export-only'], 'users')).rejects.toThrow('DISK_FULL')
    // Assert
    const output = vi.mocked(process.stderr.write).mock.calls.map(call => String(call[0])).join('')
    expect(output).toContain('Retry: npm run migrate:pw1:users')
    expect(output).toContain('--export-only')
    expect(adapters.users).not.toHaveBeenCalled()
  })
  it('reuses persisted UUID after a crash before batch commit', async () => {
    // Arrange
    const run = await existingRun()
    // Act
    await runWorkflow(['--run', run.directory, '--continue'], 'full')
    // Assert
    expect(adapters.full).toHaveBeenCalledWith(expect.objectContaining({ manifest: run.batch.binding.manifestPath }), expect.objectContaining({ batchId: run.saved.batchId }))
  })
  it('resumes exact batch after commit even if onBatch state write did not happen', async () => {
    // Arrange
    const run = await existingRun()
    adapters.batch.mockResolvedValue(run.batch)
    // Act
    await runWorkflow(['--run', run.directory, '--continue'], 'full')
    // Assert
    expect(adapters.full).toHaveBeenCalledWith(expect.objectContaining({ resume: run.batch.id }), expect.objectContaining({ batchId: run.saved.batchId }))
    expect(adapters.prepare).not.toHaveBeenCalled()
  })
  it('blocks replay if an observed batch is missing after database reset', async () => {
    // Arrange
    const run = await existingRun('full', 'IMPORTING', true)
    // Act / Assert
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'full')).rejects.toThrow('WORKFLOW_BATCH_MISSING')
    expect(adapters.full).not.toHaveBeenCalled()
  })
  it('retries failed destination publication without replaying successful import', async () => {
    // Arrange
    const run = await existingRun('full', 'IMPORTED', true)
    adapters.batch.mockResolvedValue(run.batch)
    adapters.finalize.mockRejectedValueOnce(new MigrationError('DISK_FULL'))
    // Act
    await expect(runWorkflow(['--run', run.directory, '--export-only'], 'full')).rejects.toThrow('DISK_FULL')
    expect(await state(run.directory)).toMatchObject({ stage: 'FINALIZING' })
    await runWorkflow(['--run', run.directory, '--export-only'], 'full')
    // Assert
    expect(adapters.full).not.toHaveBeenCalled()
    expect(await state(run.directory)).toMatchObject({ stage: 'COMPLETED' })
  })
  it('refuses users DB resume and refuses finalizing an incomplete selection', async () => {
    // Arrange
    const run = await existingRun('users')
    adapters.batch.mockResolvedValue(run.batch)
    adapters.destination.mockResolvedValue({ status: 'partial' })
    // Act
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'users')).rejects.toThrow('USERS_RESUME_UNSUPPORTED_USE_EXPORT_ONLY')
    await expect(runWorkflow(['--run', run.directory, '--export-only'], 'users')).rejects.toThrow('WORKFLOW_DESTINATION_INCOMPLETE')
    // Assert
    expect(adapters.users).not.toHaveBeenCalled()
    expect(adapters.finalize).not.toHaveBeenCalled()
    expect(await state(run.directory)).toMatchObject({ stage: 'IMPORTING' })
  })
  it.each(['FINALIZING', 'COMPLETED'])('never invokes DB runner when continuing %s, including old map-only completion', async stage => {
    // Arrange
    const run = await existingRun('full', stage, true)
    adapters.batch.mockResolvedValue(run.batch)
    adapters.finalize.mockImplementation(async () => {
      expect(await state(run.directory)).toMatchObject({ stage: 'FINALIZING' })
      return { manifestPath: resolve(run.directory, 'prepared/destination-manifest.json'), files: [] }
    })
    // Act
    await runWorkflow(['--run', run.directory, '--continue'], 'full')
    // Assert
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.finalize).toHaveBeenCalledWith(resolve(run.directory, 'prepared'), manifestHash, { status: 'complete' }, expect.any(Function))
    expect(await state(run.directory)).toMatchObject({ stage: 'COMPLETED' })
  })
  it('treats an existing destination journal as sealed even with an earlier run stage', async () => {
    // Arrange
    const run = await existingRun('full', 'IMPORTING', true)
    await writeFile(resolve(run.directory, 'prepared/destination-manifest.json'), '{}')
    adapters.batch.mockResolvedValue(run.batch)
    // Act
    await runWorkflow(['--run', run.directory, '--continue'], 'full')
    // Assert
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.finalize).toHaveBeenCalledOnce()
  })
  it('requires the original batch for a sealed prepared input even before batchObserved was saved', async () => {
    // Arrange
    const run = await existingRun('full', 'IMPORTING', false)
    await writeFile(resolve(run.directory, 'prepared/destination-manifest.json'), '{}')
    // Act / Assert
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'full')).rejects.toThrow('WORKFLOW_BATCH_MISSING')
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.finalize).not.toHaveBeenCalled()
  })
  it('verifies batch provenance before finalization recovery', async () => {
    // Arrange
    const run = await existingRun('full', 'FINALIZING', true)
    adapters.batch.mockResolvedValue({ ...run.batch, binding: { ...run.batch.binding, manifestHash: 'f'.repeat(64) } })
    // Act / Assert
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'full')).rejects.toThrow('WORKFLOW_BATCH_MISMATCH')
    expect(adapters.full).not.toHaveBeenCalled()
    expect(adapters.finalize).not.toHaveBeenCalled()
  })
  it('marks users complete from verified ledger output after final state-save crash', async () => {
    // Arrange
    const run = await existingRun('users', 'IMPORTING', true)
    adapters.batch.mockResolvedValue(run.batch)
    // Act
    await runWorkflow(['--run', run.directory, '--export-only'], 'users')
    // Assert
    expect(adapters.users).not.toHaveBeenCalled()
    expect(await state(run.directory)).toMatchObject({ stage: 'COMPLETED' })
  })
  it('rejects newly created batch with changed manifest before handing control back to writer', async () => {
    // Arrange
    const run = await existingRun()
    adapters.full.mockImplementation(async (_args: Arguments, options: ImportOrchestrationOptions) => {
      await options.onBatch?.({ ...run.batch, binding: { ...run.batch.binding, manifestHash: 'f'.repeat(64) } })
      throw new Error('writer must not be reached')
    })
    // Act / Assert
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'full')).rejects.toThrow('WORKFLOW_BATCH_MISMATCH')
    expect(await state(run.directory)).toMatchObject({ batchObserved: false })
    expect(adapters.destination).not.toHaveBeenCalled()
  })
  it('does not rewrite metadata when requested scope differs', async () => {
    // Arrange
    const run = await existingRun('full')
    const original = await readFile(resolve(run.directory, 'run.json'), 'utf8')
    // Act / Assert
    await expect(runWorkflow(['--run', run.directory, '--continue'], 'users')).rejects.toThrow('WORKFLOW_SCOPE_MISMATCH')
    expect(await readFile(resolve(run.directory, 'run.json'), 'utf8')).toBe(original)
  })
  it('releases run lock even if pool shutdown fails', async () => {
    // Arrange
    const run = await existingRun('full', 'IMPORTED', true)
    adapters.batch.mockResolvedValue(run.batch)
    adapters.end.mockRejectedValueOnce(new Error('pool end failed'))
    // Act
    await expect(runWorkflow(['--run', run.directory, '--export-only'], 'full')).rejects.toThrow('pool end failed')
    const release = await lockWorkflow(run.directory)
    // Assert
    expect(release).toBeTypeOf('function')
    await release()
  })
  it('locks across concurrent invocations and permits acquisition after release', async () => {
    // Arrange
    const release = await lockWorkflow(root)
    // Act / Assert
    await expect(lockWorkflow(root)).rejects.toThrow('WORKFLOW_LOCKED')
    await release()
    const again = await lockWorkflow(root)
    await again()
  })
  it('stops on schema precheck before preparing or invoking business runners', async () => {
    // Arrange
    const config = await configFile()
    adapters.schema.mockRejectedValueOnce(new MigrationError('TARGET_SCHEMA_MISSING'))
    // Act / Assert
    await expect(runWorkflow(['--config', config, '--all'], 'users')).rejects.toThrow('TARGET_SCHEMA_MISSING')
    expect(adapters.binding).not.toHaveBeenCalled()
    expect(adapters.prepare).not.toHaveBeenCalled()
    expect(adapters.users).not.toHaveBeenCalled()
  })
  it('resolves config paths against config location and rejects unknown keys', async () => {
    // Arrange
    const config = await configFile()
    // Act / Assert
    expect(await loadWorkflowConfig(config)).toMatchObject({ exportArtifact: resolve(root, 'artifact'), outputRoot: resolve(root, 'runs') })
    await writeFile(config, JSON.stringify({ ...JSON.parse(await readFile(config, 'utf8')), password: 'forbidden' }), { mode: 0o600 })
    await expect(loadWorkflowConfig(config)).rejects.toThrow('WORKFLOW_CONFIG_INVALID')
  })
  it.each([
    ['--config', '/tmp/config.json'], ['--config', '/tmp/config.json', '--all', '--store', '1'],
    ['--run', '/tmp/run', '--continue', '--all'], ['--run', '/tmp/run', '--continue', '--export-only'],
    ['--config', '/tmp/config.json', '--all', '--manifest', '/tmp/manifest'],
  ])('rejects conflicting or incomplete CLI arguments %j', (...argv) => {
    // Arrange / Act / Assert
    expect(() => workflowArguments(argv)).toThrow()
  })
})
