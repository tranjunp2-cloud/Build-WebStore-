import { storeGroups } from './groups'
import { DiskRegistry } from './disk-registry'
import { RunLogger, safeLogEvent, type StoreDestination } from './run-logger'
import { leaseHeartbeat } from './lease-heartbeat'
import { progressLogger } from './progress'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { readdir, readFile, rm } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { readStoreTargetChecks, loadImportArtifact, readImportStore, readBoundFile } from './artifact'
import { loadCredentialSidecar } from './credentials'
import { selectStoreIds } from './selectors'
import { createRuntime } from './runtime'
import { buildEntities, canonical, checksum, creatorDiagnosticResolved } from './projection'
import { configurations, sourceKeyRecords, preflightStore, writeEntity, finalizeEntity, verifyStore, databaseErrorCode, type PreflightEntityContext } from './writer'
import { findOperation, registerPreflightedStores, completeBatch, assertWritableProfile, getBatch, createBatch, acquireLease, releaseLease, renewLease, markStoreVerified, listStoreStates, lockStore, type BatchBinding, type LedgerBatch, type LedgerLease } from './ledger'
import { MigrationError } from './errors'
import { assertTargetSchema } from './target-schema'
import { resolveCreatorContext } from './creator-bindings'
import type { Runtime } from './runtime'

export interface Arguments { manifest?: string; store?: string; stores?: string; fromStore?: string; toStore?: string; all?: boolean; dryRun?: boolean; resume?: string; help?: boolean; localDatabase?: string; groupSize?: number; logDir?: string }
export function argumentsFor(args: string[]): Arguments {
  const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
    manifest: { type: 'string' }, store: { type: 'string' }, stores: { type: 'string' }, 'from-store': { type: 'string' }, 'to-store': { type: 'string' },
    'group-size': { type: 'string' }, 'log-dir': { type: 'string' }, 'local-database': { type: 'string' }, all: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, resume: { type: 'string' }, help: { type: 'boolean' },
  } })
  const result = { manifest: values.manifest, store: values.store, stores: values.stores, fromStore: values['from-store'], toStore: values['to-store'], all: values.all, dryRun: values['dry-run'], resume: values.resume, help: values.help, localDatabase: values['local-database'], groupSize: values['group-size'] === undefined ? undefined : Number(values['group-size']), logDir: values['log-dir'] }
  if (result.help) return result
  if (result.groupSize !== undefined) storeGroups([], result.groupSize)
  if (result.localDatabase !== undefined && !/^[a-zA-Z0-9_]+$/.test(result.localDatabase)) throw new MigrationError('LOCAL_DATABASE_ARGUMENT_INVALID')
  if (result.resume) {
    if (!/^json:[a-f0-9-]{36}$/.test(result.resume) || [result.manifest, result.store, result.stores, result.toStore, result.all, result.dryRun, result.groupSize].some(value => value !== undefined)) throw new MigrationError('RESUME_FLAGS_INVALID')
  } else {
    if (!result.manifest) throw new MigrationError('MANIFEST_REQUIRED')
    // Selector validation is independent of Store inventory.
    const modes = [result.store !== undefined, result.stores !== undefined, result.fromStore !== undefined || result.toStore !== undefined, result.all === true].filter(Boolean).length
    if (modes !== 1 || ((result.fromStore !== undefined) !== (result.toStore !== undefined))) throw new MigrationError('EXACTLY_ONE_STORE_SELECTOR_REQUIRED')
  }
  return result
}
export function validateResumeCursor(ids: string[], states: Record<string, string>, cursor?: string): void {
  if (!cursor) return
  const index = ids.indexOf(cursor), firstIncomplete = ids.findIndex(id => states[id] !== 'VERIFIED')
  if (index < 0 || (firstIncomplete >= 0 && index > firstIncomplete)) throw new MigrationError('RESUME_CANNOT_SKIP_STORE')
}
export async function writerHash(): Promise<string> {
  const files: string[] = []
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(ts|tsx|js|cjs|json)$/.test(entry.name)) files.push(path)
    }
  }
  // Hooks/helpers are dependencies too: any source change invalidates a partial run.
  await walk(resolve('src'))
  files.push(...['package-lock.json', 'scripts/import-pw1-json.ts', 'scripts/pw1-json-migration-schema.js', 'scripts/pw1-content-schema.js', 'scripts/pw1-migration-schema.js', 'scripts/seed-preload.cjs'].map(path => resolve(path)))
  const hash = createHash('sha256')
  for (const path of files.sort()) { hash.update(relative(process.cwd(), path)); hash.update('\0'); hash.update(await readFile(path)); hash.update('\0') }
  return hash.digest('hex')
}
export async function schemaHash(runtime: Runtime): Promise<string> {
  const columns = await runtime.pool.query(`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)
  const indexes = await runtime.pool.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`)
  const constraints = await runtime.pool.query(`SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' ORDER BY c.relname,k.conname`)
  return checksum([columns.rows, indexes.rows, constraints.rows])
}
export function safeError(error: unknown): { code: string; exitCode: number } {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code.startsWith('ERR_PARSE_ARGS_')) return { code: 'ARGUMENTS_INVALID', exitCode: 2 }
  let networkError: unknown = error
  for (let depth = 0; depth < 5 && networkError !== null && typeof networkError === 'object'; depth++) {
    const candidate = networkError as { code?: unknown; message?: unknown; cause?: unknown }
    if ((typeof candidate.code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNABORTED', 'ENETRESET', 'EHOSTUNREACH', 'ECONNREFUSED'].includes(candidate.code)) || (typeof candidate.message === 'string' && /connection (?:terminated|closed|lost)|socket hang up|terminating connection|timeout expired|query read timeout/i.test(candidate.message))) return { code: 'OUTCOME_REQUIRES_RESUME_RECONCILIATION', exitCode: 5 }
    networkError = candidate.cause
  }
  const driverCode = databaseErrorCode(error)
  if (driverCode?.startsWith('08') || ['57P01', '57P02', '57P03'].includes(driverCode ?? '')) return { code: 'OUTCOME_REQUIRES_RESUME_RECONCILIATION', exitCode: 5 }
  if (driverCode === '23505') return { code: 'TARGET_UNIQUE_CONFLICT', exitCode: 3 }
  if (['40001', '40P01'].includes(driverCode ?? '')) return { code: 'TRANSACTION_RETRY_EXHAUSTED', exitCode: 4 }
  const message = error instanceof MigrationError ? error.code : error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : 'IMPORT_FAILED'
  const exitCode = message === 'NO_MATCHING_STORES' ? 6 : message === 'INTERRUPTED' ? 4 : /FLAGS|ARGUMENT|SELECTOR|MANIFEST_REQUIRED|INVALID_STORE_ID|RANGE_|BOUNDS_REQUIRED/.test(message) ? 2 : 3
  return { code: message, exitCode }
}
/** Pick explicitly: callers may pass a full Entity despite the narrower structural type. */
export function updatePreflightContext(context: Record<string, unknown>, entity: PreflightEntityContext | undefined): void {
  delete context.collection; delete context.sourceEntity; delete context.sourceId
  if (entity) {
    context.storeId = entity.storeId
    context.collection = entity.collection
    context.sourceEntity = entity.sourceEntity
    context.sourceId = entity.sourceId
  }
}
export async function runImport(args: Arguments): Promise<void> {
  if (args.help) {
    process.stdout.write('PW1 local import: --manifest /private/import-manifest.json (--store ID | --stores ID,ID | --from-store ID --to-store ID | --all) [--group-size 1..100] [--log-dir /private/logs] [--dry-run]\nResume: --resume json:UUID [--from-store ID]\nApply defaults to local clones pw1_import_1886_*. To use an existing local DB, pass --local-database NAME matching DATABASE_URI (also on resume). Remote/Vercel targets remain blocked.\nExit: 0 verified/preflight passed; 2 arguments; 3 blocked/conflict; 4 interrupted/retry exhausted; 5 reconcile with resume; 6 no matching Stores.\n')
    return
  }
  const logger = await RunLogger.create(args.logDir, args.dryRun ? 'dry-run' : args.resume ? 'resume' : 'apply')
  process.stderr.write(`Migration logs: ${logger.directory}\n`)
  let context: Record<string, unknown> = {}
  const preflightContext = (entity: PreflightEntityContext | undefined) => updatePreflightContext(context, entity)
  const emit = async (value: Record<string, unknown>) => { await logger.event({ ...context, ...value }); process.stdout.write(JSON.stringify(value) + '\n') }
  let leaseClock: ReturnType<typeof leaseHeartbeat> | undefined
  const progress = progressLogger(line => process.stderr.write(line))
  progress.report({ phase: 'connect-database' })
  const heartbeat = setInterval(progress.heartbeat, 1000)
  heartbeat.unref()
  let runtime: Runtime | undefined, lease: LedgerLease | undefined, spool: string | undefined
  let interrupted = false
  const stop = () => { interrupted = true }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  try {
    runtime = await createRuntime(process.env.DATABASE_URI ?? '', !args.dryRun, args.localDatabase)
    await assertWritableProfile(runtime.pool)
    let batch: LedgerBatch | undefined = args.resume ? await getBatch(runtime.pool, args.resume) : undefined
    if (batch) { context.runId = batch.id; await logger.event({ status: 'BATCH_RESUMED', runId: batch.id }) }
    if (batch?.binding.executionScope === 'foundation') throw new MigrationError('FOUNDATION_RESUME_REQUIRES_USER_RUNNER')
    if (batch && batch.binding.executionVersion !== 'grouped-v1') throw new MigrationError('GROUPED_RESUME_UNSUPPORTED')
    const groupSize = batch?.binding.groupSize ?? args.groupSize ?? 100
    storeGroups([], groupSize)
    const manifestPath = batch?.binding.manifestPath ?? resolve(args.manifest!)
    const artifact = await loadImportArtifact(manifestPath, { progress: progress.report, spoolDirectory: tmpdir(), ...(batch ? { storeIds: batch.storeIds } : { selector: args }) })
    spool = artifact.spoolDirectory
    if (artifact.creatorBindings && artifact.creatorBindings.targetIdentityHash !== runtime.identity) throw new MigrationError('CREATOR_BINDING_TARGET_MISMATCH')
    const selected = batch?.storeIds ?? selectStoreIds(artifact.storeIds, args)
    if (!selected.length) throw new MigrationError('NO_MATCHING_STORES')
    if (selected.some(id => !artifact.storeIds.includes(id))) throw new MigrationError('BATCH_STORE_MISSING')
    await logger.event({ status: 'SELECTION_READY', stores: selected.length, groupSize, groupCount: Math.ceil(selected.length / groupSize) })
    await emit({ status: 'ARTIFACT_CHECKED', manifestHash: artifact.manifestHash, masterHash: artifact.manifest.masterHash, scope: 'selected-emitted-stores', ...artifact.coverage, requestedStoreCount: selected.length, pageDisposition: 'OUT_OF_SCOPE', pageExcludedRecords: artifact.pageExcludedRecords, optionalDispositions: artifact.optionalDispositions })
    const pending = artifact.diagnosticSummary?.buckets.filter(bucket => bucket.disposition === 'TARGET_CHECK_REQUIRED' && (!bucket.diagnostic.storeId || selected.includes(bucket.diagnostic.storeId))) ?? []
    const blockers = (artifact.diagnosticSummary ? artifact.diagnosticSummary.buckets.filter(bucket => bucket.disposition === 'BLOCKED').map(bucket => ({ ...bucket.diagnostic, count: bucket.count, samples: bucket.samples })) : artifact.blockers.map(row => ({ ...row, samples: [row] }))).filter(row => !row.storeId || selected.includes(row.storeId))
    if (pending.length) await emit({ status: 'TARGET_CHECKS_PENDING', count: pending.reduce((sum, bucket) => sum + bucket.count, 0), codes: [...new Set(pending.map(bucket => bucket.diagnostic.code))] })
    const reportBlockers = async (rows: typeof blockers) => {
      for (const diagnostic of rows) {
        await logger.diagnosticBlocked(diagnostic, context)
      }
      await emit({ status: 'BLOCKED', blockerCount: rows.reduce((sum, row) => sum + (row.count ?? 1), 0), codes: [...new Set(rows.map(row => row.code))], diagnosticGroups: rows.slice(0, 50), diagnosticGroupsTruncated: rows.length > 50 })
    }
    const globalBlockers = blockers.filter(row => !row.storeId)
    if (globalBlockers.length) { await reportBlockers(globalBlockers); throw new MigrationError('ARTIFACT_BLOCKED') }
    progress.report({ phase: 'check-schema-and-credentials' })
    if (artifact.manifest.version >= 2) await assertTargetSchema(runtime.pool)
    const credentials = await loadCredentialSidecar(artifact)
    const binding: BatchBinding = {
      executionVersion: 'grouped-v1', groupSize,
      ...(artifact.manifest.version >= 2 ? { profile: artifact.manifest.profile, sourceInstanceToken: artifact.manifest.sourceInstanceToken, migrationPolicyHash: artifact.manifest.migrationPolicyHash, actorArtifactHash: artifact.manifest.actorArtifactHash, creatorBindingsHash: artifact.manifest.creatorBindingsHash, classifierVersion: artifact.manifest.classifierVersion, ...(artifact.manifest.version === 3 ? { classificationVersion: artifact.manifest.classificationVersion, customerReconciliationHash: artifact.manifest.customerReconciliationHash, productReconciliationHash: artifact.manifest.productReconciliationHash } : {}) } : {}),
      sourceInstance: artifact.manifest.sourceInstance, sourceDatabase: artifact.manifest.sourceDatabase, snapshotId: artifact.manifest.snapshotId,
      targetHash: runtime.identity, manifestHash: artifact.manifestHash,
      masterHash: artifact.manifest.masterHash, mappingHash: artifact.manifest.mappingHash, credentialHash: artifact.manifest.credentialHash,
      writerHash: await writerHash(), schemaHash: await schemaHash(runtime), manifestPath,
      pw1AppKeyFingerprint: artifact.manifest.credentialHash && process.env.PW1_APP_KEY ? checksum(process.env.PW1_APP_KEY) : null,
      ...(artifact.manifest.credentialHash ? { ssoKeyFingerprint: checksum(process.env.SSO_ENCRYPTION_KEY ?? '') } : {}),
    }
    if (batch && canonical(binding) !== canonical(batch.binding)) throw new MigrationError('BATCH_BINDING_CHANGED')
    const states = batch ? await listStoreStates(runtime.pool, batch.id) : {}
    validateResumeCursor(selected, states, args.fromStore && args.resume ? args.fromStore : undefined)
    const configs = configurations(runtime)
    const namespace = `${artifact.manifest.sourceInstance}:${artifact.manifest.snapshotId}`
    const actorRefs = new Set(artifact.actors?.actors.map(actor => actor._ref) ?? [])
    const creatorInput = { actors: artifact.actors, bindings: artifact.creatorBindings, sourceInstance: artifact.manifest.sourceInstance,
      sourceDatabase: artifact.manifest.sourceDatabase, sourceInstanceToken: artifact.manifest.sourceInstanceToken ?? '', snapshotId: artifact.manifest.snapshotId,
      actorArtifactHash: artifact.manifest.actorArtifactHash ?? null, targetIdentityHash: runtime.identity }
    let creates = 0, reuses = 0
    const groups = storeGroups(selected, groupSize)
    const registry = new DiskRegistry(spool!)
    context = { groupSize, groupCount: groups.length }
    await logger.event({ status: 'SELECTION_READY', stores: selected.length, groupSize, groupCount: groups.length, verifiedBefore: Object.values(states).filter(state => state === 'VERIFIED').length })
    if (!args.dryRun) {
      await readBoundFile(manifestPath, { expectedHash: artifact.manifestHash, maxBytes: 1024 * 1024 })
      if (!batch) batch = await runtime.transaction(async (_req, db) => createBatch(db, binding, selected))
      context.runId = batch.id
      await emit({ status: 'BATCH_READY', runId: batch.id, stores: selected.length })
      lease = await acquireLease(runtime.pool, batch.id)
      const currentRuntime = runtime, currentLease = lease
      leaseClock = leaseHeartbeat(() => renewLease({ query: async (text, params) => {
        // pg supports this client-side timeout; QueryConfig types omit the option.
        const config = { text, values: params, query_timeout: 10_000 }
        return currentRuntime.pool.query(config)
      } }, currentLease), 30_000, error => databaseErrorCode(error) === '55P03')
    }
    const check = () => { leaseClock?.check(); if (interrupted) throw new MigrationError('INTERRUPTED') }
    for (const [groupIndex, ids] of groups.entries()) {
      check()
      context = { groupIndex: groupIndex + 1, groupCount: groups.length, groupSize, ...(batch ? { runId: batch.id } : {}) }
      await emit({ status: 'GROUP_PREFLIGHT_STARTED', ...context, stores: ids.length })
      const groupBlockers = blockers.filter(row => row.storeId && ids.includes(row.storeId))
      if (groupBlockers.length) { await reportBlockers(groupBlockers); throw new MigrationError('GROUP_BLOCKED') }
      for (const [offset, storeId] of ids.entries()) {
        check(); context.storeId = storeId; context.phase = 'preflight'
        progress.report({ phase: 'preflight', storeId, completed: offset, total: ids.length })
        const entities = buildEntities(await readImportStore(artifact, storeId), configs, namespace, actorRefs, artifact.preserveInvalidUserEmails)
        await registry.add(sourceKeyRecords(runtime, entities))
        const creatorContext = await resolveCreatorContext(runtime.pool, creatorInput, entities)
      for (const gate of await readStoreTargetChecks(artifact, storeId)) {
        const d = gate.diagnostic
        const entity = entities.find(candidate => candidate.sourceEntity === d.table && candidate.sourceId === d.sourceId)
        preflightContext(entity)
        if (!entity || gate.count !== 1) throw new MigrationError('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
        if (d.code === 'TARGET_USER_CREATOR_BINDING_REQUIRED' && !creatorDiagnosticResolved(entity, creatorContext.targets)) throw new MigrationError('CREATOR_DIAGNOSTIC_UNRESOLVED')
        if (d.code === 'SUBSCRIPTION_CANCEL_FLAG_ABSENT' && (entity.collection !== 'plan-subscriptions' || entity.data.canceledAt !== null || 'canceledImmediately' in entity.data)) throw new MigrationError('SUBSCRIPTION_CANCEL_EVIDENCE_MISMATCH')
        if (['ORDER_PAYMENT_METHOD_UNVERIFIED','ORDER_PAYMENT_METHOD_OMITTED'].includes(d.code) && (entity.collection !== 'orders' || entity.data.paymentMethod != null || entity.data.verificationSource !== 'manual' || (entity.data.paymentProvider != null && entity.data.paymentProvider !== 'stripe'))) throw new MigrationError('ORDER_PAYMENT_EVIDENCE_MISMATCH')
        if (d.code === 'RAW_VALUE_UNVERIFIED' && (entity.collection !== 'products' || !entity.data[d.field === 'description_ms' ? 'descriptionBM' : 'description'])) throw new MigrationError('RICH_TEXT_EVIDENCE_MISSING')
        if (d.field === 'slug' && typeof entity.data.slug !== 'string') throw new MigrationError('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
      }
        const proposal = await preflightStore(runtime, entities, binding.sourceInstance, credentials, batch, undefined, creatorContext, preflightContext)
        if (batch && states[storeId] === 'VERIFIED') {
          await verifyStore(runtime, entities, proposal.targets, batch, undefined, undefined, creatorContext)
          if (!args.dryRun) {
            const tenantEntity = entities.find(e => e.collection === 'tenants')
            const siteEntity = entities.find(e => e.collection === 'sites')
            const categoryEntities = entities.filter(e => e.collection === 'categories')
            await logger.recordDestination(storeId, {
              tenantId: tenantEntity ? proposal.targets.get(tenantEntity.ref) ?? null : null,
              siteId: siteEntity ? proposal.targets.get(siteEntity.ref) ?? null : null,
              productCategories: categoryEntities
                .map(e => proposal.targets.get(e.ref))
                .filter((id): id is number => typeof id === 'number')
                .sort((a, b) => a - b),
            })
          }
        }
        creates += proposal.creates; reuses += proposal.reuses
        await emit({ status: 'STORE_PREFLIGHT_PASSED', storeId, creates: proposal.creates, reuses: proposal.reuses })
      }
      context.phase = 'cross-group-check'; delete context.storeId
      await registry.commitGroup()
      check()
      await emit({ status: 'GROUP_PREFLIGHT_PASSED', ...context, stores: ids.length })
      if (args.dryRun) { await logger.checkpoint(); continue }
      const currentBatch = batch!, currentLease = lease!, currentRuntime = runtime
      await runtime.transaction(async (_req, db) => registerPreflightedStores(db, currentLease, ids))
      for (const storeId of ids) {
        check(); context.storeId = storeId; context.phase = 'apply'
        if (states[storeId] === 'VERIFIED') { await emit({ status: 'STORE_REVERIFIED', storeId }); continue }
        await renewLease(runtime.pool, currentLease)
        await emit({ status: 'STORE_STARTED', storeId })
        const entities = buildEntities(await readImportStore(artifact, storeId), configs, namespace, actorRefs, artifact.preserveInvalidUserEmails)
        const creatorContext = await resolveCreatorContext(runtime.pool, creatorInput, entities)
        const proposal = await preflightStore(runtime, entities, binding.sourceInstance, credentials, currentBatch, undefined, creatorContext, preflightContext)
        const targets = proposal.targets, remaining = [...entities]
        while (remaining.length) {
          check()
          const index = remaining.findIndex(entity => targets.has(entity.ref) || entity.refs.every(ref => !ref.required || targets.has(ref.ref)))
          if (index < 0) throw new MigrationError('REQUIRED_REFERENCE_CYCLE')
          const entity = remaining.splice(index, 1)[0]
          context = { ...context, collection: entity.collection, sourceEntity: entity.sourceEntity, sourceId: entity.sourceId }
          progress.report({ phase: 'write-entities', storeId, collection: entity.collection, completed: entities.length - remaining.length - 1, total: entities.length })
          const priorOperation = await findOperation(runtime.pool, currentBatch.id, storeId, entity.sourceEntity, entity.sourceId)
          check()
          const targetId = await writeEntity(runtime, entity, targets, credentials, currentBatch, currentLease, creatorContext)
          targets.set(entity.ref, targetId)
          const prior = proposal.claims.get(entity.ref)
          await logger.event({ ...context, status: 'ENTITY_COMMITTED', targetId, action: priorOperation ? 'RECONCILED' : prior ? 'REUSE' : 'CREATE', operationId: checksum([currentBatch.id, storeId, entity.sourceEntity, entity.sourceId]) })
        }
        context.phase = 'finalize-relations'
        progress.report({ phase: 'finalize-relations', storeId })
        for (const entity of entities) { check(); context.collection = entity.collection; context.sourceEntity = entity.sourceEntity; context.sourceId = entity.sourceId; await finalizeEntity(runtime, entity, targets, currentBatch, currentLease, creatorContext) }
        check(); context.phase = 'verify-store'; delete context.collection; delete context.sourceId; delete context.sourceEntity
        progress.report({ phase: 'verify-store', storeId })
        await runtime.transaction(async (req, db) => {
          await lockStore(db, currentLease, storeId)
          await verifyStore(currentRuntime, entities, targets, currentBatch, req, db, creatorContext)
          await markStoreVerified(db, currentLease, storeId)
        })
        states[storeId] = 'VERIFIED'
        const tenantEntity = entities.find(e => e.collection === 'tenants')
        const siteEntity = entities.find(e => e.collection === 'sites')
        const categoryEntities = entities.filter(e => e.collection === 'categories')
        const destination: StoreDestination = {
          tenantId: tenantEntity ? targets.get(tenantEntity.ref) ?? null : null,
          siteId: siteEntity ? targets.get(siteEntity.ref) ?? null : null,
          productCategories: categoryEntities
            .map(e => targets.get(e.ref))
            .filter((id): id is number => typeof id === 'number')
            .sort((a, b) => a - b),
        }
        await logger.recordDestination(storeId, destination)
        await emit({ status: 'STORE_VERIFIED', runId: currentBatch.id, storeId, entities: entities.length, destination })
      }
      delete context.storeId
      await emit({ status: 'GROUP_VERIFIED', ...context, stores: ids.length })
      await logger.checkpoint()
      // Registry retains only hashed keys; these store files have no remaining consumers.
      for (const id of ids) for (const file of [artifact.storeFiles?.[id], artifact.targetCheckFiles?.[id]]) if (file) await rm(file.path)
    }
    check()
    if (args.dryRun) await emit({ status: 'PREFLIGHT_PASSED', stores: selected.length, creates, reuses, writes: 0 })
    else {
      const currentLease = lease!
      const complete = await runtime.transaction(async (_req, db) => completeBatch(db, currentLease))
      if (!complete) throw new MigrationError('BATCH_INCOMPLETE')
      await emit({ status: 'VERIFIED', runId: batch!.id, stores: selected.length })
    }
    await logger.event({ status: 'SESSION_FINISHED', exitCode: 0, ...(batch ? { runId: batch.id } : {}) })
    await logger.checkpoint(args.dryRun ? 'PREFLIGHT_PASSED' : 'VERIFIED', { exitCode: 0 })
  } catch (error) {
    const result = safeError(error)
    process.stderr.write(JSON.stringify(safeLogEvent({ ...context, ...result })) + '\n')
    try {
      await logger.event({ ...context, status: result.code === 'INTERRUPTED' ? 'SESSION_INTERRUPTED' : 'SESSION_FAILED', ...result })
      await logger.checkpoint('FAILED', { ...context, ...result, nextAction: result.code === 'OUTCOME_REQUIRES_RESUME_RECONCILIATION' ? 'RECONCILE' : result.code === 'INTERRUPTED' && context.runId ? 'RESUME' : 'REVIEW_ERROR' })
    } catch { process.stderr.write('{"code":"LOG_WRITE_FAILED"}\n') }
    throw error
  } finally {
    clearInterval(heartbeat)
    progress.report({ phase: 'cleanup' })
    process.off('SIGINT', stop); process.off('SIGTERM', stop)
    await leaseClock?.stop()
    if (runtime && lease) {
      try { await releaseLease(runtime.pool, lease) } catch { process.stderr.write(JSON.stringify({ status: 'LEASE_RELEASE_PENDING_EXPIRY', runId: lease.batchId }) + '\n') }
    }
    try { await runtime?.close() } catch { process.stderr.write('{"code":"RUNTIME_CLOSE_FAILED"}\n') }
    try { if (spool) await rm(spool, { recursive: true, force: true }) } catch { process.stderr.write('{"code":"SPOOL_CLEANUP_FAILED"}\n') }
    await logger.close()
  }
}
