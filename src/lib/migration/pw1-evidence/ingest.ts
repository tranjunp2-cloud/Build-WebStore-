import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import { checkedFile } from '../pw1-export/csv-loader'
import { SOURCE_EVIDENCE_MAX_LINE_CHARS } from '../pw1-export/source-evidence'
import { manifestSchema } from '../pw1-export/artifact-schemas'
import { validateArtifact } from '../pw1-export/validate-artifact'
import { assertStagingQcAuthorization } from '../pw1-json/runtime'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const safeField = z.object({
  presence: z.enum(['absent', 'null', 'empty', 'value']),
  display: z.string().max(240).nullable(),
  fingerprint: digest.nullable(),
  disposition: z.string().max(64),
}).strict()
const headerSchema = z.object({
  kind: z.literal('header'), version: z.literal(3), sourceInstance: z.string(),
  snapshotId: z.string(), asOf: z.string(),
  selectedFiles: z.array(z.object({ table: z.string().optional(), sha256: digest, rowCount: z.number().int().nonnegative().nullable() }).strict()),
  piiComparable: z.boolean(),
  keyId: digest.nullable(),
}).strict()
export const sourceEvidenceRowSchema = z.object({
  kind: z.literal('row'), table: z.string().max(80), sourceId: z.string().max(128),
  storeId: z.string().regex(/^[1-9]\d*$/).nullable(), record: z.number().int().positive(),
  disposition: z.enum(['mapped', 'partial', 'retained-source', 'excluded', 'unresolved']),
  targetPaths: z.array(z.object({ path: z.string().max(512), rule: z.string().max(128), fields: z.array(z.string().max(80)) }).strict()),
  redactedFieldCount: z.number().int().nonnegative(),
  fields: z.record(safeField),
}).strict()

type EvidenceRow = z.infer<typeof sourceEvidenceRowSchema>
type RemoteTarget = { targetHash: string; database: string; approvedStoreIds: string[]; importBatchId?: string }

async function assertRemoteEvidenceAuthorization(pool: Pool, targetId: string, remote: RemoteTarget): Promise<void> {
  if (!remote.approvedStoreIds.length) throw new Error('EVIDENCE_STORE_SELECTION_REQUIRED')
  if (!remote.importBatchId) {
    await assertStagingQcAuthorization(pool, targetId, remote.targetHash, remote.database, remote.approvedStoreIds)
    return
  }
  if (!/^json:[a-f0-9-]{36}$/.test(remote.importBatchId)) throw new Error('EVIDENCE_BATCH_ID_INVALID')
  const result = await pool.query(`SELECT 1 FROM migration_import_batches b
    JOIN migration_target_guard guard ON guard.singleton=true AND guard.target_instance_id=$2
    WHERE b.batch_id=$1::uuid AND b.binding->>'targetHash'=$3
      AND b.binding->>'executionScope' IS DISTINCT FROM 'foundation'
      AND b.selected_store_ids=$4::jsonb AND b.state='APPLYING'
      AND current_database()=$5`, [remote.importBatchId.slice(5), targetId, remote.targetHash,
    JSON.stringify(remote.approvedStoreIds), remote.database])
  if (result.rowCount !== 1) throw new Error('EVIDENCE_REMOTE_IMPORT_NOT_AUTHORIZED')
}

async function flushRows(client: PoolClient, snapshotId: string, rows: EvidenceRow[]): Promise<void> {
  if (!rows.length) return
  await client.query(`INSERT INTO migration_source_evidence_rows
    (snapshot_id,source_store_id,source_entity,source_id,record_no,disposition,target_paths,redacted_field_count,fields)
    SELECT $1::uuid, x.store_id, x.table_name, x.source_id, x.record_no, x.disposition, x.target_paths, x.redacted_field_count, x.fields
    FROM jsonb_to_recordset($2::jsonb) AS x(
      store_id varchar, table_name varchar, source_id varchar, record_no integer,
      disposition varchar, target_paths jsonb, redacted_field_count integer, fields jsonb)
    ON CONFLICT (snapshot_id,source_entity,source_id,record_no) DO NOTHING`, [
    snapshotId,
    JSON.stringify(rows.map(row => ({
      store_id: row.storeId, table_name: row.table, source_id: row.sourceId,
      record_no: row.record, disposition: row.disposition, target_paths: row.targetPaths,
      redacted_field_count: row.redactedFieldCount, fields: row.fields,
    }))),
  ])
}

/** Operator-only ingestion. The artifact validator checks every bound hash and source row. */
export async function ingestSourceEvidence(input: {
  pool: Pool
  artifactDir: string
  expectedTargetInstanceId: string
  remoteTarget?: RemoteTarget
}): Promise<{ snapshotId: string; sourceRecords: number; sourceFields: number; reused: boolean }> {
  await validateArtifact(input.artifactDir)
  const manifestPath = await checkedFile(input.artifactDir, 'master-manifest.json')
  const manifestBytes = await readFile(manifestPath)
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')) as unknown)
  const sidecarHash = manifest.artifacts['source-evidence.ndjson']
  if (!sidecarHash) throw new Error('SOURCE_EVIDENCE_SIDECAR_REQUIRED')
  const sourceFile = await checkedFile(input.artifactDir, 'source-evidence.ndjson')
  const manifestHash = createHash('sha256').update(manifestBytes).digest('hex')
  if (input.remoteTarget) await assertRemoteEvidenceAuthorization(input.pool, input.expectedTargetInstanceId, input.remoteTarget)
  const client = await input.pool.connect()
  try {
    await client.query('BEGIN')
    const guard = await client.query<{ target_instance_id: string }>(
      'SELECT target_instance_id FROM migration_target_guard WHERE singleton=true FOR SHARE',
    )
    if (guard.rows[0]?.target_instance_id !== input.expectedTargetInstanceId) {
      throw new Error('EVIDENCE_TARGET_GUARD_MISMATCH')
    }
    const existing = await client.query<{ snapshot_id: string; state: string; manifest_sha256: string; summary: { sourceRecords?: number; sourceFields?: number } }>(
      `SELECT snapshot_id,state,manifest_sha256,summary
       FROM migration_source_evidence_snapshots
       WHERE source_instance_id=$1 AND source_snapshot_id=$2 AND sidecar_sha256=$3 FOR UPDATE`,
      [manifest.sourceSnapshot.sourceInstance, manifest.sourceSnapshot.snapshotId, sidecarHash],
    )
    if (existing.rows[0]) {
      const found = existing.rows[0]
      if (found.state !== 'COMPLETE' || found.manifest_sha256 !== manifestHash) {
        throw new Error('SOURCE_EVIDENCE_SNAPSHOT_CONFLICT')
      }
      await client.query('COMMIT')
      return { snapshotId: found.snapshot_id, sourceRecords: found.summary.sourceRecords ?? 0,
        sourceFields: found.summary.sourceFields ?? 0, reused: true }
    }
    const snapshotId = randomUUID()
    await client.query(`INSERT INTO migration_source_evidence_snapshots
      (snapshot_id,source_instance_id,source_snapshot_id,manifest_sha256,sidecar_sha256,pii_comparable,state)
      VALUES($1,$2,$3,$4,$5,false,'BUILDING')`, [
      snapshotId, manifest.sourceSnapshot.sourceInstance, manifest.sourceSnapshot.snapshotId,
      manifestHash, sidecarHash,
    ])
    let sourceRecords = 0
    let sourceFields = 0
    let redactedFields = 0
    let comparable = false
    let keyId: string | null = null
    let sourceSnapshotAt: string | null = null
    let headerRead = false
    let selectedTables: string[] = []
    let selectedFiles: Array<{ table?: string; sha256: string; rowCount: number | null }> = []
    const counts: Record<string, number> = Object.create(null)
    const batch: EvidenceRow[] = []
    const streamedHash = createHash('sha256')
    const stream = createReadStream(sourceFile)
    stream.on('data', chunk => streamedHash.update(chunk))
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      if (line.length > SOURCE_EVIDENCE_MAX_LINE_CHARS) throw new Error('SOURCE_EVIDENCE_LINE_TOO_LONG')
      const parsed: unknown = JSON.parse(line)
      if (!headerRead) {
        const header = headerSchema.parse(parsed)
        if (header.sourceInstance !== manifest.sourceSnapshot.sourceInstance ||
          header.snapshotId !== manifest.sourceSnapshot.snapshotId ||
          header.asOf !== manifest.sourceSnapshot.asOf) throw new Error('SOURCE_EVIDENCE_HEADER_MISMATCH')
        comparable = header.piiComparable
        keyId = header.keyId
        sourceSnapshotAt = header.asOf
        selectedTables = header.selectedFiles.map(file => file.table).filter((table): table is string => Boolean(table))
        selectedFiles = header.selectedFiles
        if (comparable !== Boolean(keyId)) throw new Error('SOURCE_EVIDENCE_KEY_ID_INVALID')
        headerRead = true
        continue
      }
      const row = sourceEvidenceRowSchema.parse(parsed)
      batch.push(row)
      sourceRecords++
      sourceFields += Object.keys(row.fields).length
      redactedFields += row.redactedFieldCount
      counts[row.disposition] = (counts[row.disposition] ?? 0) + 1
      if (batch.length >= 500) {
        await flushRows(client, snapshotId, batch)
        batch.length = 0
      }
    }
    if (!headerRead) throw new Error('SOURCE_EVIDENCE_HEADER_MISSING')
    if (streamedHash.digest('hex') !== sidecarHash) throw new Error('SOURCE_EVIDENCE_STREAM_HASH_MISMATCH')
    await flushRows(client, snapshotId, batch)
    const dbCount = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM migration_source_evidence_rows WHERE snapshot_id=$1', [snapshotId],
    )
    if (Number(dbCount.rows[0]?.count) !== sourceRecords) throw new Error('SOURCE_EVIDENCE_ROW_COUNT_MISMATCH')
    if (input.remoteTarget) await assertRemoteEvidenceAuthorization(input.pool, input.expectedTargetInstanceId, input.remoteTarget)
    await client.query(`UPDATE migration_source_evidence_snapshots
      SET pii_comparable=$2,hmac_key_id=$4,source_snapshot_at=$5::timestamptz,
        state='COMPLETE',summary=$3::jsonb,completed_at=clock_timestamp()
      WHERE snapshot_id=$1 AND state='BUILDING'`, [snapshotId, comparable,
      JSON.stringify({ sidecarVersion: 3, sourceRecords, sourceFields, redactedFields, dispositions: counts, selectedTables,
        selectedFiles }), keyId, sourceSnapshotAt])
    await client.query('COMMIT')
    return { snapshotId, sourceRecords, sourceFields, reused: false }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
