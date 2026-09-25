import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { inspectExportArtifact, readBoundFile } from './artifact'
import { validateOutputPath } from './destination-master'
import { validateUserActors, loadCreatorBindings } from './creator-bindings'
import { lookupSystemCreator } from './system-creator'
import { localTarget } from './runtime'
import { MigrationError } from './errors'


export interface PrepareSystemCreatorInput {
  exportArtifact: string
  sourceRef: string
  approvedBy: string
  output: string
  localDatabase?: string
}

/** Prepare approval evidence against a read-only local DB connection; never creates users. */
export async function prepareSystemCreator(input: PrepareSystemCreatorInput): Promise<{ bindingPath: string; targetUserId: number }> {
  if (!input.exportArtifact || !input.output || !isAbsolute(input.output) || !/^@users:users:[1-9]\d*$/.test(input.sourceRef) || !input.approvedBy?.trim()) throw new MigrationError('SYSTEM_BINDING_ARGUMENTS_REQUIRED')
  const output = await validateOutputPath(input.output)
  const directory = resolve(input.exportArtifact)
  const exported = await inspectExportArtifact(directory)
  const actorHash = 'user-actors.json' in exported.manifest.artifacts ? exported.manifest.artifacts['user-actors.json'] : undefined
  if (!actorHash) throw new MigrationError('ACTOR_ARTIFACT_REQUIRED')
  const actors = validateUserActors((await readBoundFile(resolve(directory, 'user-actors.json'), { json: true, expectedHash: actorHash, maxBytes: 16 * 1024 * 1024 })).value, exported.manifest.sourceSnapshot)
  if (!actors.actors.some(actor => actor._ref === input.sourceRef)) throw new MigrationError('SOURCE_ACTOR_NOT_FOUND')
  const target = localTarget(process.env.DATABASE_URI, false, input.localDatabase)
  const pool = new Pool({ connectionString: target.uri, connectionTimeoutMillis: 10000, options: '-c default_transaction_read_only=on -c statement_timeout=10000' })
  try {
    const identity = await lookupSystemCreator(pool)
    const { sourceInstance, sourceDatabase, sourceInstanceToken, snapshotId } = exported.manifest.sourceSnapshot
    const provenance = { sourceInstance, sourceDatabase, sourceInstanceToken, snapshotId, actorArtifactHash: actorHash, targetIdentityHash: target.identity }
    const decision = { ...provenance, sourceRef: input.sourceRef, ...identity, decision: 'approve-existing-creator-binding', approvedBy: input.approvedBy, approvedAt: new Date().toISOString() }
    await mkdir(output, { mode: 0o700 })
    const evidenceRef = resolve(output, 'decision.json')
    const evidence = JSON.stringify(decision, null, 2) + '\n'
    await writeFile(evidenceRef, evidence, { mode: 0o600, flag: 'wx' })
    const binding = { version: 1, ...provenance, entries: [{ sourceRef: input.sourceRef, ...identity, provenanceKind: 'operator-approved', evidenceRef, evidenceHash: createHash('sha256').update(evidence).digest('hex') }] }
    const bindingPath = resolve(output, 'creator-bindings.json')
    await writeFile(bindingPath, JSON.stringify(binding, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    await loadCreatorBindings(bindingPath)
    return { bindingPath, targetUserId: identity.targetUserId }
  } finally { await pool.end() }
}
