// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { ingestSourceEvidence } from '@/lib/migration/pw1-evidence/ingest'

let temporaryRoot: string | undefined
afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = undefined
})

describe('[TC-F42-EVD-DB-01] source sidecar DB ingestion on an isolated local clone', () => {
  it.runIf(Boolean(process.env.PW1_TEST_DATABASE && process.env.DATABASE_URI))('stores all selected source rows, reuses exact evidence and rejects tampering', async () => {
    // Arrange
    const name = process.env.PW1_TEST_DATABASE!
    expect(name).toMatch(/^pw1_import_1886_[a-z0-9_]+$/)
    const uri = new URL(process.env.DATABASE_URI!)
    expect(['localhost', '127.0.0.1']).toContain(uri.hostname)
    uri.pathname = `/${name}`
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pw1-evidence-db-'))
    const { input, configPath } = await writeExportFixture(temporaryRoot)
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
    config.snapshotId = randomUUID()
    await writeFile(configPath, JSON.stringify(config))
    const artifactDir = path.join(temporaryRoot, 'artifact')
    await exportMaster(input, configPath, artifactDir, false)
    const pool = new Pool({ connectionString: uri.toString(), max: 2 })
    let snapshotId: string | undefined
    const remoteTarget = { targetHash: 'a'.repeat(64), database: name, approvedStoreIds: ['1'] }
    const guard = await pool.query<{ target_instance_id: string }>(
      'SELECT target_instance_id FROM migration_target_guard WHERE singleton=true')
    const targetInstanceId = guard.rows[0]?.target_instance_id
    expect(targetInstanceId).toBeTruthy()
    try {
      await pool.query(`INSERT INTO migration_qc_import_authorizations
        (target_instance_id,target_hash,database_name,allowed_store_ids,expires_at,approved_by)
        VALUES($1,$2,$3,$4::jsonb,clock_timestamp()+interval '1 hour',$5)`,
      [targetInstanceId, remoteTarget.targetHash, name, JSON.stringify(['1']), 'test'])
      // Act
      const first = await ingestSourceEvidence({ pool, artifactDir, expectedTargetInstanceId: targetInstanceId, remoteTarget })
      snapshotId = first.snapshotId
      const replay = await ingestSourceEvidence({ pool, artifactDir, expectedTargetInstanceId: targetInstanceId, remoteTarget })
      const counts = await pool.query<{ records: string; fields: string }>(`SELECT count(*)::text AS records,
        sum(jsonb_array_length(jsonb_path_query_array(fields,'$.*')))::text AS fields
        FROM migration_source_evidence_rows WHERE snapshot_id=$1`, [first.snapshotId])
      const otherStores = await pool.query<{ count: string }>(`SELECT count(*)::text AS count
        FROM migration_source_evidence_rows WHERE snapshot_id=$1 AND source_store_id='2'`, [first.snapshotId])
      // Assert
      expect(first.reused).toBe(false)
      expect(first.sourceRecords).toBeGreaterThan(0)
      expect(first.sourceFields).toBeGreaterThan(0)
      expect(replay).toMatchObject({ snapshotId: first.snapshotId, reused: true })
      expect(Number(counts.rows[0].records)).toBe(first.sourceRecords)
      expect(Number(otherStores.rows[0].count)).toBeGreaterThan(0)
      await expect(ingestSourceEvidence({ pool, artifactDir,
        expectedTargetInstanceId: targetInstanceId,
        remoteTarget: { ...remoteTarget, approvedStoreIds: ['2'] } })).rejects.toThrow('STAGING_QC_IMPORT_NOT_AUTHORIZED')
      const sidecar = path.join(artifactDir, 'source-evidence.ndjson')
      await writeFile(sidecar, (await readFile(sidecar, 'utf8')) + '\n')
      await expect(ingestSourceEvidence({ pool, artifactDir, expectedTargetInstanceId: targetInstanceId })).rejects.toThrow()
    } finally {
      if (snapshotId) {
        await pool.query('DELETE FROM migration_source_evidence_rows WHERE snapshot_id=$1', [snapshotId])
        await pool.query('DELETE FROM migration_source_evidence_snapshots WHERE snapshot_id=$1', [snapshotId])
      }
      await pool.query('DELETE FROM migration_qc_import_authorizations WHERE target_instance_id=$1 AND approved_by=$2',
        [targetInstanceId, 'test'])
      await pool.end()
    }
  }, 30000)
})
