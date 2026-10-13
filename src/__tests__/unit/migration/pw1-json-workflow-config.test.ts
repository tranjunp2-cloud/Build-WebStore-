// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { argumentsFor } from '@/lib/migration/pw1-json/runner'
import { loadWorkflowConfig, workflowArguments, workflowConfigSchema } from '@/lib/migration/pw1-json/workflow-config'
import { lockWorkflow, writeWorkflowState } from '@/lib/migration/pw1-json/workflow-files'

let directory: string
const config = { version: 1, exportArtifact: './artifact', credentials: './users.csv', localDatabase: 'primeweb', outputRoot: './runs', systemCreator: { sourceRef: '@users:users:51', approvedBy: 'liam' } }
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'pw1-workflow-config-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

describe('[TC-F42-IMP-WORKFLOW] Strict configuration and run coordination', () => {
  it('resolves CLI paths from cwd and artifact paths relative to the config file', async () => {
    // Arrange
    const filename = join(directory, 'local.json')
    await writeFile(filename, JSON.stringify(config), { mode: 0o600 })
    // Act
    const args = workflowArguments(['--config', 'migration/local.json', '--all', '--group-size', '100', '--dry-run'])
    const loaded = await loadWorkflowConfig(filename)
    // Assert
    expect(args.config).toBe(resolve('migration/local.json'))
    expect(args.selection).toMatchObject({ all: true, groupSize: 100, dryRun: true })
    expect(loaded).toMatchObject({ exportArtifact: join(directory, 'artifact'), credentials: join(directory, 'users.csv'), outputRoot: join(directory, 'runs') })
  })
  it('supports supplied or deferred bindings while rejecting ambiguous modes and unknown keys', () => {
    // Arrange
    const { systemCreator: _systemCreator, ...base } = config
    // Act / Assert
    expect(workflowConfigSchema.safeParse({ ...base, creatorBindings: './bindings.json' }).success).toBe(true)
    expect(workflowConfigSchema.safeParse(base).success).toBe(true)
    for (const invalid of [{ ...config, creatorBindings: './bindings.json' }, { ...config, typo: true }, { ...config, systemCreator: { ...config.systemCreator, typo: true } }]) {
      expect(workflowConfigSchema.safeParse(invalid).success).toBe(false)
    }
  })
  it('reports invalid config with a sanitized code', async () => {
    // Arrange
    const filename = join(directory, 'bad.json')
    await writeFile(filename, JSON.stringify({ ...config, password: 'never-display-this' }))
    // Act / Assert
    await expect(loadWorkflowConfig(filename)).rejects.toThrow('WORKFLOW_CONFIG_INVALID')
  })
  it.each([
    ['--config', 'local.json', '--store', '0'], ['--config', 'local.json', '--store', 'abc'],
    ['--config', 'local.json', '--stores', ''], ['--config', 'local.json', '--stores', '1,'],
    ['--config', 'local.json', '--from-store', '200', '--to-store', '100'],
    [], ['--config', 'local.json'], ['--config', 'local.json', '--all', '--store', '1'],
    ['--config', 'local.json', '--all', '--continue'], ['--config', 'local.json', '--all', '--export-only'],
    ['--config', 'local.json', '--run', 'run', '--all'], ['--run', 'run'],
    ['--run', 'run', '--continue', '--export-only'], ['--run', 'run', '--continue', '--all'],
    ['--run', 'run', '--continue', '--dry-run'], ['--config', 'local.json', '--all', '--unknown'],
    ['--config', 'local.json', '--all', '--group-size', '101'], ['--config', 'local.json', '--all', '--resume', 'json:batch'],
  ])('rejects incompatible workflow flags %j', (...args) => {
    // Arrange / Act / Assert
    expect(() => workflowArguments(args)).toThrow()
  })
  it('supports exact run continuation/export and preserves the legacy string resume parser', () => {
    // Arrange
    const batch = 'json:c32fcaab-f511-4000-8000-000000000001'
    // Act / Assert
    expect(workflowArguments(['--run', 'run', '--continue'])).toMatchObject({ run: resolve('run'), continue: true })
    expect(workflowArguments(['--run', 'run', '--export-only'])).toMatchObject({ run: resolve('run'), exportOnly: true })
    expect(argumentsFor(['--resume', batch, '--from-store', '100', '--local-database', 'primeweb'])).toMatchObject({ resume: batch, fromStore: '100', localDatabase: 'primeweb' })
  })
  it('allows only one real lock owner and can reacquire after release', async () => {
    // Arrange
    const release = await lockWorkflow(directory)
    // Act / Assert
    try { await expect(lockWorkflow(directory)).rejects.toThrow('WORKFLOW_LOCKED') } finally { await release() }
    const releaseAgain = await lockWorkflow(directory)
    await releaseAgain()
  })
  it('atomically replaces state with private permissions and leaves no temporary files', async () => {
    // Arrange
    const filename = join(directory, 'run.json')
    await writeWorkflowState(filename, { phase: 'prepared' })
    // Act
    await writeWorkflowState(filename, { phase: 'importing', batchId: 'test-batch' })
    // Assert
    expect(JSON.parse(await readFile(filename, 'utf8'))).toEqual({ phase: 'importing', batchId: 'test-batch' })
    expect((await stat(filename)).mode & 0o777).toBe(0o600)
    expect(await readdir(directory)).toEqual(['run.json'])
  })
})
