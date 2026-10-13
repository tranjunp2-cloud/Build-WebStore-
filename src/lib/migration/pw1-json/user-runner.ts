import type { ImportOrchestrationOptions } from './orchestration-hooks'
import { parseArgs } from 'node:util'
import { resolve, dirname, isAbsolute } from 'node:path'
import { stat, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { realpathSync } from 'node:fs'
import { loadImportArtifact, readImportStore, readStoreTargetChecks } from './artifact'
import { loadCredentialSidecar } from './credentials'
import { selectStoreIds } from './selectors'
import { createRuntime, type Runtime } from './runtime'
import { buildEntities, checksum, creatorDiagnosticResolved } from './projection'
import { configurations, preflightStore, writeEntity, finalizeEntity, verifyStore } from './writer'
import { assertWritableProfile, registerPreflightedStores, markStoreVerified, createBatch, acquireLease, releaseLease, renewLease, type BatchBinding, type LedgerBatch, type LedgerLease } from './ledger'
import { leaseHeartbeat } from './lease-heartbeat'
import { progressLogger } from './progress'
import { MigrationError } from './errors'
import { resolveCreatorContext } from './creator-bindings'
import { writerHash, schemaHash, safeError } from './runner'
import { validateOutputPath, validateDestinationPartsOutput, destinationPartsDirectory, writeDestinationMasterParts, writeDestinationMaster, type FoundationDestination } from './destination-master'
import { assertTargetSchema } from './target-schema'
import { COLLECTIONS, type CollectionName, type ImportDocument, type ImportStore } from './types'

export interface UserArguments {
  manifest?: string
  store?: string
  stores?: string
  fromStore?: string
  toStore?: string
  all?: boolean
  dryRun?: boolean
  localDatabase?: string
  targetHost?: string
  outputMaster?: string
  outputFile?: string
  help?: boolean
}

export interface MigratedUserRecord {
  storeId: string
  sourceUserId: string
  userId: number | null
  email: string
  roles: string[]
  tenantId: number | null
  tenantSlug: string
  siteId: number | null
  siteName: string
  passwordResetRequired?: boolean
  action: 'CREATED' | 'REUSED' | 'PREFLIGHT_ONLY'
}

export function argumentsForUsers(args: string[]): UserArguments {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      manifest: { type: 'string' },
      store: { type: 'string' },
      stores: { type: 'string' },
      'from-store': { type: 'string' },
      'to-store': { type: 'string' },
      'local-database': { type: 'string' },
      'target-host': { type: 'string' },
      'output-file': { type: 'string' },
      'output-master': { type: 'string' },
      all: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  })
  const result: UserArguments = {
    manifest: values.manifest,
    store: values.store,
    stores: values.stores,
    fromStore: values['from-store'],
    toStore: values['to-store'],
    localDatabase: values['local-database'],
    targetHost: values['target-host'],
    outputFile: values['output-file'],
    outputMaster: values['output-master'],
    all: values.all,
    dryRun: values['dry-run'],
    help: values.help,
  }
  if (result.help) return result
  for (const path of [result.outputMaster, result.outputFile]) if (path !== undefined && !isAbsolute(path)) throw new MigrationError('OUTPUT_PATH_MUST_BE_ABSOLUTE')
  if (result.localDatabase !== undefined && !/^[a-zA-Z0-9_]+$/.test(result.localDatabase)) {
    throw new MigrationError('LOCAL_DATABASE_ARGUMENT_INVALID')
  }
  if (!result.manifest) throw new MigrationError('MANIFEST_REQUIRED')
  const modes = [
    result.store !== undefined,
    result.stores !== undefined,
    result.fromStore !== undefined || result.toStore !== undefined,
    result.all === true,
  ].filter(Boolean).length
  if (modes !== 1 || ((result.fromStore !== undefined) !== (result.toStore !== undefined))) {
    throw new MigrationError('EXACTLY_ONE_STORE_SELECTOR_REQUIRED')
  }
  return result
}

async function resolveManifestPath(inputPath: string): Promise<string> {
  const resolved = resolve(inputPath)
  try {
    const s = await stat(resolved)
    if (s.isDirectory()) {
      return resolve(resolved, 'import-manifest.json')
    }
  } catch {
    // let loadImportArtifact handle invalid path
  }
  return resolved
}

export async function runUserImport(args: UserArguments, options: ImportOrchestrationOptions = {}): Promise<MigratedUserRecord[]> {
  if (args.help) {
    process.stdout.write(
      'PW1 User & Tenant Migration:\n' +
      '  npm run migrate:pw1:users -- --manifest <path> (--store ID | --stores ID,ID | --from-store ID --to-store ID | --all) [--local-database NAME] [--target-host <exact-neon-host>] [--dry-run] [--output-file PATH] [--output-master /private/master-with-destination.json]\n'
    )
    return []
  }

  const progress = progressLogger(line => process.stderr.write(line))
  progress.report({ phase: 'connect-database' })

  let runtime: Runtime | undefined
  let lease: LedgerLease | undefined
  let leaseClock: ReturnType<typeof leaseHeartbeat> | undefined
  let spool: string | undefined
  let batch: LedgerBatch | undefined
  const userResults: MigratedUserRecord[] = []
  const destinations = new Map<string, FoundationDestination>()

  try {
    runtime = await createRuntime(process.env.DATABASE_URI ?? '', !args.dryRun, args.localDatabase, args.targetHost)
    await assertWritableProfile(runtime.pool)
    await assertTargetSchema(runtime.pool)

    const manifestPath = await resolveManifestPath(args.manifest!)
    const outputMaster = resolve(args.outputMaster ?? resolve(dirname(manifestPath), 'master-with-destination.json'))
    const outputReport = resolve(args.outputFile ?? resolve(dirname(manifestPath), 'migrated-users.json'))
    if (!args.dryRun && !options.compactOutput) {
      await validateOutputPath(outputMaster)
      await validateOutputPath(outputReport)
      if (outputMaster === outputReport) throw new MigrationError('OUTPUT_PATH_CONFLICT')
    }
    const artifact = await loadImportArtifact(manifestPath, {
      scope: 'foundation',
      progress: progress.report,
      spoolDirectory: realpathSync(tmpdir()),
      selector: args,
    })
    spool = artifact.spoolDirectory
    if (!args.dryRun && !options.compactOutput && artifact.masterParts) {
      await validateDestinationPartsOutput(outputMaster)
      if (destinationPartsDirectory(outputMaster) === outputReport) throw new MigrationError('OUTPUT_PATH_CONFLICT')
    }


    const selected = selectStoreIds(artifact.storeIds, args)
    if (!selected.length) throw new MigrationError('NO_MATCHING_STORES')
    // Until foundation-specific diagnostic ownership is proven, fail closed rather than waive blockers.
    const blockers = artifact.diagnosticSummary
      ? artifact.diagnosticSummary.buckets.filter(bucket => bucket.disposition === 'BLOCKED').map(bucket => bucket.diagnostic)
      : artifact.blockers
    if (blockers.some(d => !d.storeId || selected.includes(d.storeId))) throw new MigrationError('FOUNDATION_SCOPE_BLOCKED')
    if (artifact.creatorBindings && artifact.creatorBindings.targetIdentityHash !== runtime.identity) throw new MigrationError('CREATOR_BINDING_TARGET_MISMATCH')

    const credentials = await loadCredentialSidecar(artifact)
    const configs = configurations(runtime)
    const namespace = `${artifact.manifest.sourceInstance}:${artifact.manifest.snapshotId}`
    const actorRefs = new Set(artifact.actors?.actors.map(actor => actor._ref) ?? [])
    const creatorInput = {
      actors: artifact.actors,
      bindings: artifact.creatorBindings,
      sourceInstance: artifact.manifest.sourceInstance,
      sourceDatabase: artifact.manifest.sourceDatabase,
      sourceInstanceToken: artifact.manifest.sourceInstanceToken ?? '',
      snapshotId: artifact.manifest.snapshotId,
      actorArtifactHash: artifact.manifest.actorArtifactHash ?? null,
      targetIdentityHash: runtime.identity,
    }

    if (!args.dryRun) {
      const binding: BatchBinding = {
        executionVersion: 'grouped-v1',
        executionScope: 'foundation',
        groupSize: 1,
        ...(artifact.manifest.version >= 2 ? {
          profile: artifact.manifest.profile,
          sourceInstanceToken: artifact.manifest.sourceInstanceToken,
          migrationPolicyHash: artifact.manifest.migrationPolicyHash,
          actorArtifactHash: artifact.manifest.actorArtifactHash,
          creatorBindingsHash: artifact.manifest.creatorBindingsHash,
          classifierVersion: artifact.manifest.classifierVersion,
          ...(artifact.manifest.version === 3 ? {
            classificationVersion: artifact.manifest.classificationVersion,
            customerReconciliationHash: artifact.manifest.customerReconciliationHash,
            productReconciliationHash: artifact.manifest.productReconciliationHash,
          } : {}),
        } : {}),
        sourceInstance: artifact.manifest.sourceInstance,
        sourceDatabase: artifact.manifest.sourceDatabase,
        snapshotId: artifact.manifest.snapshotId,
        targetHash: runtime.identity,
        manifestHash: artifact.manifestHash,
        masterHash: artifact.manifest.masterHash,
        mappingHash: artifact.manifest.mappingHash,
        credentialHash: artifact.manifest.credentialHash,
        writerHash: await writerHash(),
        schemaHash: await schemaHash(runtime),
        manifestPath,
        pw1AppKeyFingerprint: artifact.manifest.credentialHash && process.env.PW1_APP_KEY ? checksum(process.env.PW1_APP_KEY) : null,
        ...(artifact.manifest.credentialHash ? { ssoKeyFingerprint: checksum(process.env.SSO_ENCRYPTION_KEY ?? '') } : {}),
      }

      batch = await runtime.transaction(async (_req, db) => createBatch(db, binding, selected, options.batchId))
      await options.onBatch?.(batch)
      lease = await acquireLease(runtime.pool, batch.id)
      const currentRuntime = runtime
      const currentLease = lease
      leaseClock = leaseHeartbeat(() => renewLease({
        query: async (text, params) => {
          const config = { text, values: params, query_timeout: 10_000 }
          return currentRuntime.pool.query(config as never)
        },
      }, currentLease), 30_000)
    }

    const currentRuntime = runtime
    const failedStores: Array<{ storeId: string; reason: string }> = []
    let failure: unknown
    let preflightedStores = 0

    for (const storeId of selected) {
      let preflightCollection: string | undefined
      try {
        leaseClock?.check()
        progress.report({ phase: 'preflight', storeId })
        const store = await readImportStore(artifact, storeId)
        const foundationStore: ImportStore = {
          storeId: store.storeId,
          collections: {
            ...Object.fromEntries(COLLECTIONS.map(c => [c, []])),
            tenants: store.collections.tenants ?? [],
            sites: store.collections.sites ?? [],
            users: store.collections.users ?? [],
          } as Record<CollectionName, ImportDocument[]>,
        }
        const targetEntities = buildEntities(foundationStore, configs, namespace, actorRefs, artifact.preserveInvalidUserEmails, artifact.delegateRawPageContent, artifact.delegateRawModelSettings)
        const tenantEntity = targetEntities.find(e => e.collection === 'tenants')
        const siteEntity = targetEntities.find(e => e.collection === 'sites')
        if (!tenantEntity || !siteEntity) throw new MigrationError('FOUNDATION_TENANT_SITE_REQUIRED')

        const userEntities = targetEntities.filter(e => e.collection === 'users')
        const creatorContext = await resolveCreatorContext(runtime.pool, creatorInput, targetEntities)

        for (const gate of await readStoreTargetChecks(artifact, storeId)) {
          const d = gate.diagnostic
          const entity = targetEntities.find(candidate => candidate.sourceEntity === d.table && candidate.sourceId === d.sourceId)
          if (!entity) continue
          if (d.code === 'TARGET_USER_CREATOR_BINDING_REQUIRED' && !creatorDiagnosticResolved(entity, creatorContext.targets)) {
            throw new MigrationError('CREATOR_DIAGNOSTIC_UNRESOLVED')
          }
        }

        const proposal = await preflightStore(runtime, targetEntities, artifact.manifest.sourceInstance, credentials, batch, undefined, creatorContext, entity => { preflightCollection = entity?.collection }, true)

        if (args.dryRun) {
          preflightedStores++
          for (const userEntity of userEntities) {
            userResults.push({
              storeId,
              sourceUserId: userEntity.sourceId,
              userId: proposal.targets.get(userEntity.ref) ?? null,
              email: String(userEntity.data.email ?? ''),
              roles: (userEntity.data.roles as string[]) ?? [],
              tenantId: proposal.targets.get(tenantEntity.ref) ?? null,
              tenantSlug: String(tenantEntity.data.slug ?? ''),
              siteId: siteEntity ? (proposal.targets.get(siteEntity.ref) ?? null) : null,
              siteName: siteEntity ? String(siteEntity.data.name ?? '') : '',
              passwordResetRequired: proposal.claims.has(userEntity.ref) ? undefined : !credentials.get(userEntity.sourceId)?.key_string && !credentials.get(userEntity.sourceId)?.passwordHash,
              action: proposal.claims.has(userEntity.ref) ? 'REUSED' : 'PREFLIGHT_ONLY',
            })
          }
          continue
        }

        const currentBatch = batch!
        const currentLease = lease!
        await renewLease(runtime.pool, currentLease)
        await currentRuntime.transaction(async (_req, db) => registerPreflightedStores(db, currentLease, [storeId]))

        const targets = proposal.targets
        const remaining = [...targetEntities]

        while (remaining.length) {
          leaseClock?.check()
          const index = remaining.findIndex(entity => targets.has(entity.ref) || entity.refs.every(ref => !ref.required || targets.has(ref.ref)))
          if (index < 0) throw new MigrationError('REQUIRED_REFERENCE_CYCLE')
          const entity = remaining.splice(index, 1)[0]
          const outcome = await writeEntity(currentRuntime, entity, targets, credentials, currentBatch, currentLease, creatorContext)
          targets.set(entity.ref, outcome.targetId)
        }

        for (const entity of targetEntities) {
          leaseClock?.check()
          await finalizeEntity(currentRuntime, entity, targets, currentBatch, currentLease, creatorContext)
        }

        await currentRuntime.transaction(async (req, db) => {
          await verifyStore(currentRuntime, targetEntities, targets, currentBatch, req, db, creatorContext)
          await markStoreVerified(db, currentLease, storeId)
        })

        const tenantId = targets.get(tenantEntity.ref), siteId = targets.get(siteEntity.ref)
        if (!tenantId || !siteId) throw new MigrationError('DESTINATION_TARGET_MISSING')
        destinations.set(storeId, { tenantId, siteId, productCategories: [] })

        for (const userEntity of userEntities) {
          userResults.push({
            storeId,
            sourceUserId: userEntity.sourceId,
            userId: targets.get(userEntity.ref) ?? null,
            email: String(userEntity.data.email ?? ''),
            roles: (userEntity.data.roles as string[]) ?? [],
            tenantId: targets.get(tenantEntity.ref) ?? null,
            tenantSlug: String(tenantEntity.data.slug ?? ''),
            siteId: siteEntity ? (targets.get(siteEntity.ref) ?? null) : null,
            siteName: siteEntity ? String(siteEntity.data.name ?? '') : '',
            passwordResetRequired: proposal.claims.has(userEntity.ref) ? undefined : !credentials.get(userEntity.sourceId)?.key_string && !credentials.get(userEntity.sourceId)?.passwordHash,
            action: proposal.claims.has(userEntity.ref) ? 'REUSED' : 'CREATED',
          })
        }
      } catch (err) {
        if (err instanceof MigrationError && err.code === 'TARGET_PROJECTION_CONFLICT') {
          const fields = /^TARGET_PROJECTION_CONFLICT fields=([A-Za-z0-9_.,]+)$/.exec(err.message)?.[1].split(',')
          process.stderr.write(JSON.stringify({ code: err.code, storeId, collection: preflightCollection, fields }) + '\n')
        }
        const reason = safeError(err).code
        failure = err
        failedStores.push({ storeId, reason })
        // Never continue after an unknown commit outcome, lost lease, or data conflict.
        break
      }
    }

    // Report results to stdout
    const createdCount = userResults.filter(r => r.action === 'CREATED').length
    const reusedCount = userResults.filter(r => r.action === 'REUSED').length
    const preflightCount = userResults.filter(r => r.action === 'PREFLIGHT_ONLY').length
    process.stdout.write('\n' + '='.repeat(80) + '\n')
    process.stdout.write(`PW1 USER, TENANT & SITE MIGRATION SUMMARY (${args.dryRun ? 'DRY RUN' : 'APPLIED'})\n`)
    process.stdout.write(`Selected Stores: ${selected.length} | Succeeded: ${args.dryRun ? preflightedStores : destinations.size} | Failed: ${failedStores.length}\n`)
    process.stdout.write(`Total Users Processed: ${userResults.length} (${args.dryRun ? `Preflight: ${preflightCount}` : `Created: ${createdCount}, Reused: ${reusedCount}`})\n`)
    process.stdout.write('='.repeat(80) + '\n')

    if (!options.quietUsers && userResults.length <= 50) {
      for (const r of userResults) {
        process.stdout.write(`Store #${r.storeId} -> Tenant #${r.tenantId} (${r.tenantSlug}) | Site #${r.siteId} (${r.siteName}) | User PW2 #${r.userId} (PW1 #${r.sourceUserId}) | ${r.email} | [${r.roles.join(',')}] | ${r.action}\n`)
      }
    } else if (!options.quietUsers) {
      for (const r of userResults.slice(0, 10)) {
        process.stdout.write(`Store #${r.storeId} -> Tenant #${r.tenantId} (${r.tenantSlug}) | Site #${r.siteId} (${r.siteName}) | User PW2 #${r.userId} (PW1 #${r.sourceUserId}) | ${r.email} | [${r.roles.join(',')}] | ${r.action}\n`)
      }
      process.stdout.write(`... and ${userResults.length - 10} more user records in output JSON file.\n`)
    }

    if (failedStores.length > 0) {
      process.stdout.write(`\nFailed Stores (${failedStores.length}):\n`)
      for (const f of failedStores.slice(0, 20)) {
        process.stdout.write(`  Store #${f.storeId}: ${f.reason}\n`)
      }
      if (failedStores.length > 20) {
        process.stdout.write(`  ... and ${failedStores.length - 20} more failed stores.\n`)
      }
    }
    process.stdout.write('='.repeat(80) + '\n\n')

    if (failedStores.length) throw failure
    if (!args.dryRun) {
      if (destinations.size !== selected.length) throw new MigrationError('DESTINATION_INCOMPLETE')
      if (!options.compactOutput) {
        if (artifact.masterParts) await writeDestinationMasterParts(artifact.directory,artifact.masterParts,artifact.manifest.masterHash,outputMaster,destinations,progress.report)
        else await writeDestinationMaster(resolve(artifact.directory, 'master.json'), artifact.manifest.masterHash, outputMaster, destinations, progress.report)
        await writeFile(outputReport, JSON.stringify(userResults, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
        process.stderr.write(`${artifact.masterParts ? 'Destination index and matching parts' : 'Master with destinations'} saved to: ${outputMaster}\nUser records saved to: ${outputReport}\n`)
      }
    }

    return userResults
  } finally {
    try { await leaseClock?.stop() } catch { process.stderr.write('{"code":"USER_IMPORT_HEARTBEAT_STOP_FAILED"}\n') }
    if (runtime && lease) {
      try { await releaseLease(runtime.pool, lease) } catch { process.stderr.write('{"code":"USER_IMPORT_CLEANUP_FAILED"}\n') }
    }
    try { await runtime?.close() } catch { process.stderr.write('{"code":"USER_IMPORT_CLEANUP_FAILED"}\n') }
    try { if (spool) await rm(spool, { recursive: true, force: true }) } catch { process.stderr.write('{"code":"USER_IMPORT_CLEANUP_FAILED"}\n') }
  }
}
