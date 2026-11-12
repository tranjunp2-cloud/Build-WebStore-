// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { buildFieldEvidence } from '@/lib/migration/pw1-evidence/build'
import { QC_FIELD_REGISTRY } from '@/lib/migration/pw1-evidence/qc-field-registry'
import { localTarget } from '@/lib/migration/pw1-json/runtime'

let cleanup: (() => Promise<void>) | undefined
afterEach(async () => {
  if (cleanup) await cleanup()
  cleanup = undefined
})

describe('[TC-F42-EVD-DB-03] synthetic builder DB rehearsal', () => {
  it.runIf(Boolean(process.env.PW1_TEST_DATABASE && process.env.PW1_TEST_ARTIFACT && process.env.DATABASE_URI))('persists field status and summary for an existing local VERIFIED child run', async () => {
    // Arrange — synthetic source values are inserted only into the disposable clone.
    const database = process.env.PW1_TEST_DATABASE!
    expect(database).toMatch(/^pw1_import_1886_[a-z0-9_]+$/)
    const uri = new URL(process.env.DATABASE_URI!)
    expect(['localhost','127.0.0.1']).toContain(uri.hostname)
    uri.pathname = `/${database}`
    const pool = new Pool({ connectionString: uri.toString(), max: 2 })
    const manifestPath = join(process.env.PW1_TEST_ARTIFACT!, 'import', 'import-manifest.json')
    const manifestBytes = await readFile(manifestPath)
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
      sourceInstance: string; snapshotId: string; exporterManifestHash: string
    }
    const manifestHash = createHash('sha256').update(manifestBytes).digest('hex')
    const run = await pool.query<{ run_id: string; source_store_id: string; state: string }>(
      `SELECT r.run_id,r.source_store_id,r.state FROM migration_runs r
       JOIN migration_import_stores s ON s.run_id=r.run_id
       JOIN migration_import_batches b ON b.batch_id=s.batch_id
       WHERE r.source_store_id='91886001' AND r.state='VERIFIED' AND s.state='VERIFIED'
         AND b.binding->>'manifestHash'=$1 AND r.source_instance_id=$2 AND r.source_snapshot_id=$3
       ORDER BY r.created_at DESC LIMIT 1`, [manifestHash,manifest.sourceInstance,manifest.snapshotId],
    )
    expect(run.rows[0]).toMatchObject({ source_store_id: '91886001', state: 'VERIFIED' })
    const childRunId = run.rows[0].run_id
    const snapshotId = randomUUID()
    const sidecarHash = createHash('sha256').update(snapshotId).digest('hex')
    await pool.query(`INSERT INTO migration_source_evidence_snapshots
      (snapshot_id,source_instance_id,source_snapshot_id,manifest_sha256,sidecar_sha256,pii_comparable,provenance_kind,state)
      VALUES($1,$2,$3,$4,$5,false,'synthetic_fixture','COMPLETE')`, [snapshotId,manifest.sourceInstance,manifest.snapshotId,
      manifest.exporterManifestHash,sidecarHash])
    const fields = {
      name: { presence: 'value', display: 'Synthetic product', fingerprint: null, disposition: 'mapped' },
      slug: { presence: 'value', display: 'deliberately-different', fingerprint: null, disposition: 'mapped' },
      status: { presence: 'value', display: '1', fingerprint: null, disposition: 'mapped' },
    }
    await pool.query(`INSERT INTO migration_source_evidence_rows
      (snapshot_id,source_store_id,source_entity,source_id,record_no,disposition,target_paths,redacted_field_count,fields)
      VALUES($1,'91886001','products','1',1,'mapped',$2::jsonb,0,$3::jsonb)`, [snapshotId,
      JSON.stringify([{ path: '@products:products:1', rule: 'local-synthetic-test', fields: Object.keys(fields) }]),
      JSON.stringify(fields)])
    await pool.query(`INSERT INTO migration_source_evidence_rows
      (snapshot_id,source_store_id,source_entity,source_id,record_no,disposition,target_paths,redacted_field_count,fields)
      VALUES($1,'91886001','products','999',2,'excluded','[]'::jsonb,0,$2::jsonb)`, [snapshotId,
      JSON.stringify({ name: { presence: 'value', display: 'Filtered product', fingerprint: null,
        disposition: 'excluded' } })])
    let generationId: string | undefined
    cleanup = async () => {
      try {
        if (generationId) {
          await pool.query('DELETE FROM migration_field_evidence WHERE generation_id=$1', [generationId])
          await pool.query('DELETE FROM migration_evidence_generations WHERE generation_id=$1', [generationId])
        }
        await pool.query('DELETE FROM migration_source_evidence_rows WHERE snapshot_id=$1', [snapshotId])
        await pool.query('DELETE FROM migration_source_evidence_snapshots WHERE snapshot_id=$1', [snapshotId])
      } finally { await pool.end() }
    }

    // Act
    const buildInput = { pool, sourceStoreId: '91886001', childRunId,
      sourceSnapshotId: snapshotId, sourceSidecarSha256: sidecarHash, provenanceKind: 'synthetic_fixture',
      importManifestPath: manifestPath, expectedTargetInstanceId: 'local-evidence-full',
      expectedTargetHash: localTarget(uri.toString(), true, database).identity } as const
    const [built, replay] = await Promise.all([buildFieldEvidence(buildInput),buildFieldEvidence(buildInput)])
    generationId = built.generationId
    const stored = await pool.query<{ comparison_status: string; source_field: string; source_id: string;
      source_disposition: string; target_projection_checksum: string | null }>(
      'SELECT source_id,source_disposition,source_field,comparison_status,target_projection_checksum FROM migration_field_evidence WHERE generation_id=$1 ORDER BY source_id,source_field',
      [generationId],
    )
    const generation = await pool.query<{ state: string; summary: { fieldTotal: number; fieldCounts: Record<string, number>;
      sourceInventory: { records: number; byEntity: Record<string,{ records: number; dispositions: Record<string,number> }> } } }>(
      'SELECT state,summary FROM migration_evidence_generations WHERE generation_id=$1', [generationId],
    )

    // Assert
    const expectedFields = QC_FIELD_REGISTRY.filter(field => field.group === 'Product').length
    expect(built.fieldTotal).toBe(expectedFields * 2)
    expect(replay.generationId).toBe(generationId)
    expect([built.reused,replay.reused].sort()).toEqual([false,true])
    expect(generation.rows[0].state).toBe('COMPLETE')
    expect(generation.rows[0].summary.fieldTotal).toBe(expectedFields * 2)
    expect(generation.rows[0].summary.sourceInventory.records).toBe(2)
    expect(generation.rows[0].summary.sourceInventory.byEntity.products.dispositions.excluded).toBe(1)
    expect(Object.values(generation.rows[0].summary.fieldCounts).reduce((sum, count) => sum + count, 0)).toBe(expectedFields * 2)
    expect(stored.rows).toHaveLength(expectedFields * 2)
    expect(stored.rows.filter(row => row.source_id === '999')).toHaveLength(expectedFields)
    expect(stored.rows.filter(row => row.source_id === '999').every(row =>
      row.source_disposition === 'excluded' && row.comparison_status === 'unsupported')).toBe(true)
    expect(stored.rows.find(row => row.source_id === '1' && row.source_field === 'name')
      ?.target_projection_checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.rows.some(row => row.comparison_status === 'mismatch')).toBe(true)
  }, 30000)
})
