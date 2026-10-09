import { Pool } from 'pg'
import { ingestSourceEvidence } from '../src/lib/migration/pw1-evidence/ingest'
import { localTarget } from '../src/lib/migration/pw1-json/runtime'

async function main(): Promise<void> {
  const [artifactDir, targetInstanceId, sourceStoreId, targetHost] = process.argv.slice(2)
  const uri = process.env.DATABASE_URI
  if (!artifactDir || !targetInstanceId || !uri || ![4, 6].includes(process.argv.length)) {
    throw new Error('EVIDENCE_INPUT_OR_TARGET_APPROVAL_MISSING')
  }
  const url = new URL(uri)
  const database = decodeURIComponent(url.pathname.slice(1))
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (local && !/^pw1_import_1886_[a-z0-9_]+$/.test(database)) throw new Error('EVIDENCE_DATABASE_NOT_APPROVED')
  if (!local && (!sourceStoreId || !/^[1-9]\d*$/.test(sourceStoreId) || !targetHost)) {
    throw new Error('EVIDENCE_STORE_SELECTION_REQUIRED')
  }
  const target = localTarget(uri, true, database, targetHost, local ? undefined : targetInstanceId)
  const pool = new Pool({ connectionString: target.uri, ssl: target.ssl,
    enableChannelBinding: target.enableChannelBinding, max: 2, connectionTimeoutMillis: 10000 })
  try {
    const result = await ingestSourceEvidence({ pool, artifactDir, expectedTargetInstanceId: targetInstanceId,
      ...(!local ? { remoteTarget: { targetHash: target.identity, database: target.database,
        approvedStoreIds: [sourceStoreId!] } } : {}) })
    process.stdout.write(JSON.stringify(result) + '\n')
  } finally {
    await pool.end()
  }
}

main().catch(() => {
  process.stderr.write('PW1_EVIDENCE_INGEST_FAILED\n')
  process.exitCode = 1
})
