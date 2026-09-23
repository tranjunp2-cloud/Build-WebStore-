import { parseArgs } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { inspectExportArtifact, readBoundFile } from '../src/lib/migration/pw1-json/artifact'
import { validateOutputPath } from '../src/lib/migration/pw1-json/destination-master'
import { validateUserActors, loadCreatorBindings } from '../src/lib/migration/pw1-json/creator-bindings'
import { lookupSystemCreator } from '../src/lib/migration/pw1-json/system-creator'
import { localTarget } from '../src/lib/migration/pw1-json/runtime'
import { MigrationError } from '../src/lib/migration/pw1-json/errors'

async function main() {
  const { values } = parseArgs({ options: { 'export-artifact': { type: 'string' }, 'source-ref': { type: 'string' }, 'approved-by': { type: 'string' }, output: { type: 'string' } }, strict: true, allowPositionals: false })
  if (!values['export-artifact'] || !values.output || !isAbsolute(values.output) || !/^@users:users:[1-9]\d*$/.test(values['source-ref'] ?? '') || !values['approved-by']?.trim()) throw new MigrationError('SYSTEM_BINDING_ARGUMENTS_REQUIRED')
  const output = await validateOutputPath(values.output)
  const directory = resolve(values['export-artifact'])
  const exported = await inspectExportArtifact(directory)
  const actorHash = 'user-actors.json' in exported.manifest.artifacts ? exported.manifest.artifacts['user-actors.json'] : undefined
  if (!actorHash) throw new MigrationError('ACTOR_ARTIFACT_REQUIRED')
  const actors = validateUserActors((await readBoundFile(resolve(directory, 'user-actors.json'), { json: true, expectedHash: actorHash, maxBytes: 16 * 1024 * 1024 })).value, exported.manifest.sourceSnapshot)
  if (!actors.actors.some(actor => actor._ref === values['source-ref'])) throw new MigrationError('SOURCE_ACTOR_NOT_FOUND')
  const target = localTarget(process.env.DATABASE_URI, false)
  const pool = new Pool({ connectionString: target.uri, connectionTimeoutMillis: 10000, options: '-c default_transaction_read_only=on -c statement_timeout=10000' })
  try {
    const identity = await lookupSystemCreator(pool)
    const { sourceInstance, sourceDatabase, sourceInstanceToken, snapshotId } = exported.manifest.sourceSnapshot
    const provenance = { sourceInstance, sourceDatabase, sourceInstanceToken, snapshotId, actorArtifactHash: actorHash, targetIdentityHash: target.identity }
    const decision = { ...provenance, sourceRef: values['source-ref'], ...identity, decision: 'approve-existing-creator-binding', approvedBy: values['approved-by'], approvedAt: new Date().toISOString() }
    await mkdir(output, { mode: 0o700 })
    const evidenceRef = resolve(output, 'decision.json')
    const evidence = JSON.stringify(decision, null, 2) + '\n'
    await writeFile(evidenceRef, evidence, { mode: 0o600, flag: 'wx' })
    const binding = { version: 1, ...provenance, entries: [{ sourceRef: values['source-ref'], ...identity, provenanceKind: 'operator-approved', evidenceRef, evidenceHash: createHash('sha256').update(evidence).digest('hex') }] }
    const bindingPath = resolve(output, 'creator-bindings.json')
    await writeFile(bindingPath, JSON.stringify(binding, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    await loadCreatorBindings(bindingPath)
    process.stdout.write(JSON.stringify({ status: 'PREPARED', bindingPath, targetUserId: identity.targetUserId }) + '\n')
  } finally { await pool.end() }
}
main().catch(error => { process.stderr.write(JSON.stringify({ code: error instanceof MigrationError ? error.code : 'SYSTEM_BINDING_PREPARE_FAILED' }) + '\n'); process.exitCode = 2 })
