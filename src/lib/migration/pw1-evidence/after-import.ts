import type { Pool } from 'pg'
import { evidenceHmacKey } from '../pw1-export/source-evidence'
import { buildFieldEvidence } from './build'

/** Build F42 field evidence only after the import ledger marks this child VERIFIED. */
export async function evidenceAfterVerifiedImport(input: {
  pool: Pool
  importManifestPath: string
  batchId: string
  sourceStoreId: string
  sourceSnapshotId: string
  sourceSidecarSha256: string
  targetId: string
  targetHash: string
}): Promise<{ childRunId: string; generationId: string; fieldTotal: number; reused: boolean }> {
  if (!/^json:[a-f0-9-]{36}$/.test(input.batchId)) throw new Error('EVIDENCE_BATCH_ID_INVALID')
  const child = await input.pool.query<{ run_id: string }>(`SELECT s.run_id
    FROM migration_import_stores s JOIN migration_runs r ON r.run_id=s.run_id
    WHERE s.batch_id=$1::uuid AND s.source_store_id=$2
      AND s.state='VERIFIED' AND r.state='VERIFIED'`, [input.batchId.slice(5), input.sourceStoreId])
  if (child.rowCount !== 1) throw new Error('EVIDENCE_VERIFIED_CHILD_NOT_FOUND')
  const result = await buildFieldEvidence({
    pool: input.pool, sourceStoreId: input.sourceStoreId, childRunId: child.rows[0].run_id,
    sourceSnapshotId: input.sourceSnapshotId, sourceSidecarSha256: input.sourceSidecarSha256,
    provenanceKind: 'exporter_sidecar', importManifestPath: input.importManifestPath,
    expectedTargetInstanceId: input.targetId, expectedTargetHash: input.targetHash,
    hmacKey: evidenceHmacKey(process.env.PW2_MIGRATION_SECRET),
  })
  return { childRunId: child.rows[0].run_id, ...result }
}
