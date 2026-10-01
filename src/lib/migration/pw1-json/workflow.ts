import { mkdir, realpath, lstat } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { z } from 'zod'
import { loadWorkflowConfig, workflowArguments } from './workflow-config'
import { lockWorkflow, writeWorkflowState } from './workflow-files'
import { prepareSystemCreator } from './prepare-system-creator'
import { prepareImportArtifact } from './credentials'
import { readBoundFile } from './artifact'
import { validateOutputPath } from './destination-master'
import { buildDestinationMap } from './destination-map'
import { finalizePreparedDestination } from './prepared-destination'
import { localTarget } from './runtime'
import { getBatch, assertWritableProfile, type LedgerBatch } from './ledger'
import { assertTargetSchema } from './target-schema'
import { runImport, safeError, type Arguments } from './runner'
import { runUserImport } from './user-runner'
import { MigrationError } from './errors'
import { progressLogger } from './progress'

export type WorkflowMode = 'users' | 'full'
const selectionSchema = z.object({ all: z.boolean().optional(), store: z.string().optional(), stores: z.string().optional(), fromStore: z.string().optional(), toStore: z.string().optional(), groupSize: z.number().int().min(1).max(100).optional(), dryRun: z.boolean().optional() }).strict()
const stateSchema = z.object({
  version: z.literal(1), mode: z.enum(['users', 'full']), batchId: z.string().uuid(),
  targetHash: z.string().regex(/^[a-f0-9]{64}$/), localDatabase: z.string().regex(/^[a-zA-Z0-9_]+$/), targetHost: z.string().regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/i).optional(), selection: selectionSchema,
  stage: z.enum(['CREATED', 'BOUND', 'PREPARED', 'IMPORTING', 'IMPORTED', 'FINALIZING', 'COMPLETED', 'DRY_RUN_PASSED']),
  batchObserved: z.boolean(), manifestHash: z.string().optional(), error: z.string().optional(),
}).strict()
type RunState = z.infer<typeof stateSchema>
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

/** The run state is metadata; the exact preallocated ledger batch remains authoritative. */
export async function runWorkflow(argv: string[], mode: WorkflowMode): Promise<void> {
  const args = workflowArguments(argv)
  if (mode === 'users' && args.selection.groupSize !== undefined) throw new MigrationError('USERS_GROUP_SIZE_UNSUPPORTED')
  let directory: string, state: RunState
  const config = args.config ? await loadWorkflowConfig(args.config) : undefined
  if (config) {
    const target = localTarget(process.env.DATABASE_URI, !args.selection.dryRun, config.localDatabase, config.targetHost)
    // Validate the existing parent before creating only the explicitly configured output root.
    try { if (await realpath(config.outputRoot) !== config.outputRoot) throw new MigrationError('OUTPUT_PARENT_UNSAFE') }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
      await validateOutputPath(config.outputRoot)
      await mkdir(config.outputRoot, { mode: 0o700 })
    }
    directory = resolve(config.outputRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`)
    await validateOutputPath(directory)
    await mkdir(directory, { mode: 0o700 })
    state = { version: 1, mode, batchId: randomUUID(), targetHash: target.identity, localDatabase: config.localDatabase, ...(config.targetHost ? { targetHost: config.targetHost } : {}), selection: args.selection, stage: 'CREATED', batchObserved: false }
  } else {
    directory = args.run!
    // Read again under lock below; this initial read only locates the expected target.
    state = await readState(directory)
  }
  const unlock = await lockWorkflow(directory)
  let pool: Pool | undefined
  let maySaveFailure = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const statePath = resolve(directory, 'run.json'), manifest = resolve(directory, 'prepared/import-manifest.json')
  const save = async () => writeWorkflowState(statePath, state)
  const step = (phase: string) => {
    clearInterval(heartbeat)
    const event = JSON.stringify({ phase, run: directory, time: new Date().toISOString() }) + '\n'
    appendFileSync(resolve(directory, 'events.ndjson'), event, { mode: 0o600 })
    process.stderr.write(event)
    if (phase === 'binding' || phase === 'prepare' || phase === 'export-destination') {
      heartbeat = setInterval(() => process.stderr.write(JSON.stringify({ phase, status: 'running', run: directory }) + '\n'), 10000)
      heartbeat.unref()
    }
  }
  try {
    if (!config) state = await readState(directory)
    if (state.mode !== mode) throw new MigrationError('WORKFLOW_SCOPE_MISMATCH')
    const target = localTarget(process.env.DATABASE_URI, !state.selection.dryRun, state.localDatabase, state.targetHost)
    if (target.identity !== state.targetHash) throw new MigrationError('WORKFLOW_TARGET_CHANGED')
    pool = new Pool({ connectionString: target.uri, ...(target.ssl ? { ssl: target.ssl } : {}), ...(target.enableChannelBinding ? { enableChannelBinding: true } : {}), connectionTimeoutMillis: 10000, options: '-c default_transaction_read_only=on -c statement_timeout=10000' })
    try {
      await assertWritableProfile(pool)
      await assertTargetSchema(pool)
    } catch (error) {
      // No batch, binding, or business write can have started at this point.
      if (safeError(error).code === 'OUTCOME_REQUIRES_RESUME_RECONCILIATION') throw new MigrationError('TARGET_DATABASE_UNREACHABLE')
      throw error
    }
    if (config) {
      maySaveFailure = true
      await save()
      step('binding')
      const bindingPath = config.creatorBindings ?? (await prepareSystemCreator({ exportArtifact: config.exportArtifact, ...config.systemCreator!, output: resolve(directory, 'binding'), localDatabase: config.localDatabase, targetHost: config.targetHost })).bindingPath
      state.stage = 'BOUND'; await save()
      step('prepare')
      await prepareImportArtifact({ exportArtifact: config.exportArtifact, credentials: config.credentials, creatorBindings: bindingPath, output: resolve(directory, 'prepared') })
      state.manifestHash = (await readBoundFile(manifest, { maxBytes: 1024 * 1024 })).hash
      state.stage = 'PREPARED'; await save()
    } else {
      if (!state.manifestHash || ['CREATED', 'BOUND'].includes(state.stage)) throw new MigrationError('WORKFLOW_SETUP_INCOMPLETE_NEW_RUN_REQUIRED')
      if (state.selection.dryRun) throw new MigrationError('DRY_RUN_REQUIRES_NEW_APPLY_RUN')
      await readBoundFile(manifest, { expectedHash: state.manifestHash, maxBytes: 1024 * 1024 })
    }
    const assertBatch = (value: LedgerBatch) => {
      if (value.id !== `json:${state.batchId}` || value.binding.manifestHash !== state.manifestHash || value.binding.manifestPath !== manifest || value.binding.targetHash !== state.targetHash || (value.binding.executionScope === 'foundation') !== (mode === 'users')) throw new MigrationError('WORKFLOW_BATCH_MISMATCH')
    }
    // Any finalization journal seals this prepared input, including a crash before state save.
    let sealed = false
    try { await lstat(resolve(directory, 'prepared/destination-manifest.json')); sealed = true }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error }
    const outputOnly = args.exportOnly || sealed || ['IMPORTED', 'FINALIZING', 'COMPLETED'].includes(state.stage)
    let batch: LedgerBatch | undefined
    try { batch = await getBatch(pool, state.batchId) }
    catch (error) { if (!(error instanceof MigrationError && error.code === 'BATCH_NOT_FOUND')) throw error }
    if (batch) {
      assertBatch(batch)
    } else if (state.batchObserved || ['IMPORTED', 'FINALIZING', 'COMPLETED'].includes(state.stage) || outputOnly) throw new MigrationError('WORKFLOW_BATCH_MISSING')
    maySaveFailure = true
    if (!outputOnly) {
      if (batch && mode === 'users' && state.stage !== 'IMPORTED') throw new MigrationError('USERS_RESUME_UNSUPPORTED_USE_EXPORT_ONLY')
      if (state.stage !== 'IMPORTED') {
        state.stage = 'IMPORTING'; delete state.error; await save()
        step(state.selection.dryRun ? 'dry-run' : 'import')
        const options = { batchId: state.batchId, compactOutput: true, quietUsers: true, onBatch: async (created: LedgerBatch) => {
          assertBatch(created)
          state.batchObserved = true; await save()
        } }
        if (mode === 'users') await runUserImport({ ...state.selection, manifest, localDatabase: state.localDatabase, targetHost: state.targetHost }, options)
        else {
          const input: Arguments = batch ? { resume: batch.id, localDatabase: state.localDatabase, targetHost: state.targetHost } : { ...state.selection, manifest, localDatabase: state.localDatabase, targetHost: state.targetHost }
          await runImport({ ...input, logDir: resolve(directory, 'logs') }, options)
        }
        state.stage = state.selection.dryRun ? 'DRY_RUN_PASSED' : 'IMPORTED'; await save()
      }
    }
    if (!state.selection.dryRun) {
      step('export-destination')
      const mapping = await buildDestinationMap(pool, `json:${state.batchId}`, state.targetHash)
      if (mapping.status !== 'complete') throw new MigrationError('WORKFLOW_DESTINATION_INCOMPLETE')
      state.stage = 'FINALIZING'; delete state.error; await save()
      const progress = progressLogger(line => process.stderr.write(line))
      const output = await finalizePreparedDestination(resolve(directory, 'prepared'), state.manifestHash!, mapping, progress.report)
      state.stage = 'COMPLETED'; delete state.error; await save()
      process.stderr.write(JSON.stringify({ phase: 'destination-ready', manifest: output.manifestPath, files: output.files }) + '\n')
    }
    step(state.selection.dryRun ? 'dry-run-passed' : state.stage === 'COMPLETED' ? 'finished' : 'partial-output-finished')
  } catch (error) {
    state.error = safeError(error).code
    // Preserve the last completed stage. Never hide the original failure if disk is full.
    try { if (maySaveFailure) await save() } catch { process.stderr.write('{"code":"WORKFLOW_STATE_WRITE_FAILED"}\n') }
    const operation = mode === 'full' && !['IMPORTED', 'FINALIZING', 'COMPLETED'].includes(state.stage) ? '--continue' : '--export-only'
    if (state.manifestHash && !state.selection.dryRun) {
      process.stderr.write(`Inspect run: ${directory}\n`)
      if (mode === 'users' && !['IMPORTED', 'FINALIZING', 'COMPLETED'].includes(state.stage)) {
        // A batch may have committed even when the callback/state write failed.
        process.stderr.write('Inspect the ledger before retrying users import. Users DB resume is unsupported once a batch exists; reconcile incomplete writes first. Export-only requires every selected Store VERIFIED.\n')
      } else {
        process.stderr.write(`Retry: npm run migrate:pw1:${mode === 'full' ? 'import' : 'users'} -- --run ${quote(directory)} ${operation}\n`)
      }
    }
    throw error
  } finally {
    clearInterval(heartbeat)
    try { await pool?.end() } finally { await unlock() }
  }
}
async function readState(directory: string): Promise<RunState> {
  const result = stateSchema.safeParse((await readBoundFile(resolve(directory, 'run.json'), { json: true, maxBytes: 64 * 1024 })).value)
  if (!result.success) throw new MigrationError('WORKFLOW_STATE_INVALID')
  return result.data
}
export function isWorkflowInvocation(argv: string[]): boolean {
  return argv.some(arg => arg === '--config' || arg.startsWith('--config=') || arg === '--run' || arg.startsWith('--run='))
}
