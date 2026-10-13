import { Pool } from 'pg'
import { buildFieldEvidence } from '../src/lib/migration/pw1-evidence/build'
import { assertStagingQcAuthorization, localTarget } from '../src/lib/migration/pw1-json/runtime'
import { evidenceHmacKey } from '../src/lib/migration/pw1-export/source-evidence'

async function main(): Promise<void> {
  const [sourceStoreId, childRunId, sourceSnapshotId, sourceSidecarSha256, importManifestPath, targetInstanceId, targetHost] = process.argv.slice(2)
  const uri = process.env.DATABASE_URI
  if (!sourceStoreId || !childRunId || !sourceSnapshotId || !sourceSidecarSha256 || !importManifestPath || !targetInstanceId ||
    ![8, 9].includes(process.argv.length) || !uri) {
    throw new Error('EVIDENCE_INPUT_OR_TARGET_APPROVAL_MISSING')
  }
  const parsed = new URL(uri)
  const database = decodeURIComponent(parsed.pathname.slice(1))
  const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)
  if (local && !/^pw1_import_1886_[a-z0-9_]+$/.test(database)) throw new Error('EVIDENCE_DATABASE_NOT_APPROVED')
  const target = localTarget(uri, true, database, targetHost, local ? undefined : targetInstanceId)
  const pool = new Pool({ connectionString: target.uri, ssl: target.ssl,
    enableChannelBinding: target.enableChannelBinding, max: 2, connectionTimeoutMillis: 10000 })
  try {
    if (!local) await assertStagingQcAuthorization(pool, targetInstanceId, target.identity, target.database, [sourceStoreId])
    const result = await buildFieldEvidence({ pool, sourceStoreId, childRunId, sourceSnapshotId,
      sourceSidecarSha256, provenanceKind: 'exporter_sidecar', importManifestPath,
      expectedTargetInstanceId: targetInstanceId, expectedTargetHash: target.identity,
      hmacKey: evidenceHmacKey(process.env.PW2_MIGRATION_SECRET) })
    process.stdout.write(JSON.stringify(result) + '\n')
  } finally {
    await pool.end()
  }
}

main().catch(() => {
  process.stderr.write('PW1_FIELD_EVIDENCE_BUILD_FAILED\n')
  process.exitCode = 1
})
