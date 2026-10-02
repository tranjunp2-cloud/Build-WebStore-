import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import { importManifestSchema } from '../pw1-json/artifact'
import { checksum } from '../pw1-json/projection'
import { evidenceKeyId, type SourceEvidenceRow } from '../pw1-export/source-evidence'
import { compareSourceRow, EVIDENCE_CONTRACT_VERSION, EVIDENCE_STATUSES, targetIndex, type FieldResult, type VerifiedTarget } from './comparator'
import { sourceEvidenceRowSchema } from './ingest'
import { QC_FIELD_REGISTRY, QC_FIELD_REGISTRY_HASH, QC_FIELD_REGISTRY_VERSION } from './qc-field-registry'

const uuid = z.string().uuid()
const storeId = z.string().regex(/^[1-9]\d*$/)

type RunRow = {
  run_id: string
  state: string
  import_state: string
  source_instance_id: string
  source_snapshot_id: string
  source_store_id: string
  mapping_version: string
  target_instance_id: string
  importer_profile: string
  evidence_verified_at: string | Date | null
  updated_at: string | Date
  binding: { manifestHash?: string; targetHash?: string; snapshotId?: string; profile?: string; executionScope?: string }
}

type SnapshotRow = {
  snapshot_id: string
  sidecar_sha256: string
  source_snapshot_at: string | Date | null
  hmac_key_id: string | null
  pii_comparable: boolean
  provenance_kind: 'exporter_sidecar' | 'synthetic_fixture'
  state: string
  summary: { sidecarVersion?: number; selectedTables?: string[]; selectedFiles?: Array<{ table?: string; sha256: string; rowCount: number | null }>; sourceRecords?: number }
}

type SourceDbRow = {
  source_entity: string; source_id: string; source_store_id: string; record_no: number
  disposition: SourceEvidenceRow['disposition']; target_paths: SourceEvidenceRow['targetPaths']
  redacted_field_count: number; fields: SourceEvidenceRow['fields']
}

function emptyCounts(): Record<(typeof EVIDENCE_STATUSES)[number], number> {
  return { match: 0, mismatch: 0, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 }
}

function rollup(fields: readonly FieldResult[]): (typeof EVIDENCE_STATUSES)[number] {
  for (const status of ['duplicate','missing','mismatch','unverified','unsupported'] as const) {
    if (fields.some(field => field.comparisonStatus === status)) return status
  }
  return 'match'
}

async function insertFields(client: PoolClient, generationId: string, verifiedAt: string, rows: FieldResult[]): Promise<void> {
  if (!rows.length) return
  await client.query(`INSERT INTO migration_field_evidence (
    generation_id,source_entity,source_id,source_record_no,source_disposition,source_field,element_key,
    target_collection,target_id,target_claims,target_field,comparison_status,reason_code,
    source_display,target_display,source_normalized,target_normalized,
    source_fingerprint,target_fingerprint,target_projection_checksum,transform_code,verified_at)
    SELECT $1::uuid,x.source_entity,x.source_id,x.source_record_no,x.source_disposition,x.source_field,x.element_key,
      x.target_collection,x.target_id,x.target_claims,x.target_field,x.comparison_status,x.reason_code,
      x.source_display,x.target_display,x.source_normalized,x.target_normalized,
      x.source_fingerprint,x.target_fingerprint,x.target_projection_checksum,x.transform_code,$3::timestamptz
    FROM jsonb_to_recordset($2::jsonb) AS x(
      source_entity varchar,source_id varchar,source_record_no integer,source_disposition varchar,source_field varchar,element_key varchar,
      target_collection varchar,target_id varchar,target_claims jsonb,target_field varchar,comparison_status varchar,reason_code varchar,
      source_display varchar,target_display varchar,source_normalized varchar,target_normalized varchar,
      source_fingerprint varchar,target_fingerprint varchar,target_projection_checksum varchar,transform_code varchar)`, [
    generationId,
    JSON.stringify(rows.map(row => ({
      source_entity: row.sourceEntity, source_id: row.sourceId, source_record_no: row.sourceRecordNo,
      source_disposition: row.sourceDisposition,
      source_field: row.sourceField, element_key: row.elementKey, target_collection: row.targetCollection,
      target_id: row.targetId, target_claims: row.targetClaims, target_field: row.targetField, comparison_status: row.comparisonStatus,
      reason_code: row.reasonCode, source_display: row.sourceDisplay, target_display: row.targetDisplay,
      source_normalized: row.sourceNormalized, target_normalized: row.targetNormalized,
      source_fingerprint: row.sourceFingerprint, target_fingerprint: row.targetFingerprint,
      target_projection_checksum: row.targetProjectionChecksum,
      transform_code: row.transformCode,
    }))),
    verifiedAt,
  ])
}

/** Build an immutable comparison against PW2 projections verified by the importer. */
export async function buildFieldEvidence(input: {
  pool: Pool
  sourceStoreId: string
  childRunId: string
  sourceSnapshotId: string
  sourceSidecarSha256: string
  provenanceKind: 'exporter_sidecar' | 'synthetic_fixture'
  importManifestPath: string
  expectedTargetInstanceId: string
  expectedTargetHash: string
  hmacKey?: string
}): Promise<{ generationId: string; fieldTotal: number; reused: boolean }> {
  storeId.parse(input.sourceStoreId)
  uuid.parse(input.childRunId)
  uuid.parse(input.sourceSnapshotId)
  z.string().regex(/^[a-f0-9]{64}$/).parse(input.sourceSidecarSha256)
  const manifestBytes = await readFile(input.importManifestPath)
  const importManifest = importManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')) as unknown)
  const importManifestHash = createHash('sha256').update(manifestBytes).digest('hex')
  const client = await input.pool.connect()
  try {
    await client.query('BEGIN')
    const guard = await client.query<{ target_instance_id: string }>(
      'SELECT target_instance_id FROM migration_target_guard WHERE singleton=true FOR SHARE',
    )
    if (guard.rows[0]?.target_instance_id !== input.expectedTargetInstanceId) throw new Error('EVIDENCE_TARGET_GUARD_MISMATCH')
    const runQuery = await client.query<RunRow>(`SELECT r.run_id,r.state,s.state AS import_state,r.source_instance_id,
      r.source_snapshot_id,r.source_store_id,r.mapping_version,r.target_instance_id,r.importer_profile,
      r.evidence_verified_at,r.updated_at,b.binding
      FROM migration_runs r JOIN migration_import_stores s ON s.run_id=r.run_id
      JOIN migration_import_batches b ON b.batch_id=s.batch_id
      WHERE r.run_id=$1::uuid AND r.source_store_id=$2 FOR SHARE OF r,s,b`, [input.childRunId,input.sourceStoreId])
    const run = runQuery.rows[0]
    if (!run || run.state !== 'VERIFIED' || run.import_state !== 'VERIFIED') throw new Error('CHILD_RUN_NOT_VERIFIED')
    if (run.target_instance_id !== input.expectedTargetHash || run.binding.targetHash !== input.expectedTargetHash ||
      run.binding.manifestHash !== importManifestHash || run.source_instance_id !== importManifest.sourceInstance ||
      run.source_snapshot_id !== importManifest.snapshotId || run.binding.snapshotId !== importManifest.snapshotId ||
      run.mapping_version !== importManifest.mappingHash || run.importer_profile !== importManifest.profile ||
      (run.binding.profile ?? 'pw1-json-v1') !== importManifest.profile) throw new Error('EVIDENCE_RUN_BINDING_MISMATCH')
    if (run.binding.executionScope === 'foundation') throw new Error('EVIDENCE_COMMERCE_NOT_IN_RUN_SCOPE')
    if (!run.evidence_verified_at && input.provenanceKind === 'exporter_sidecar') {
      throw new Error('EVIDENCE_VERIFIED_TIME_UNAVAILABLE')
    }
    const snapshotQuery = await client.query<SnapshotRow>(`SELECT snapshot_id,sidecar_sha256,source_snapshot_at,hmac_key_id,pii_comparable,provenance_kind,state,summary
      FROM migration_source_evidence_snapshots
      WHERE snapshot_id=$1 AND sidecar_sha256=$2 AND provenance_kind=$3
        AND source_instance_id=$4 AND source_snapshot_id=$5 AND manifest_sha256=$6 FOR SHARE`, [
      input.sourceSnapshotId,input.sourceSidecarSha256,input.provenanceKind,
      run.source_instance_id, run.source_snapshot_id, importManifest.exporterManifestHash,
    ])
    const snapshot = snapshotQuery.rows[0]
    if (!snapshot || snapshot.state !== 'COMPLETE') throw new Error('SOURCE_EVIDENCE_SNAPSHOT_NOT_READY')
    if (input.provenanceKind === 'exporter_sidecar' && snapshot.summary.sidecarVersion !== 3) {
      throw new Error('SOURCE_EVIDENCE_FINGERPRINT_VERSION_UNSUPPORTED')
    }
    if (snapshot.pii_comparable && snapshot.hmac_key_id !== evidenceKeyId(input.hmacKey)) {
      throw new Error('SOURCE_EVIDENCE_HMAC_KEY_MISMATCH')
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',
      [input.childRunId,input.sourceSnapshotId])
    const existing = await client.query<{ generation_id: string; state: string; summary: { fieldTotal?: number; registryHash?: string } }>(
      `SELECT generation_id,state,summary FROM migration_evidence_generations
       WHERE child_run_id=$1 AND snapshot_id=$2 AND contract_version=$3 FOR UPDATE`,
      [run.run_id,snapshot.snapshot_id,EVIDENCE_CONTRACT_VERSION],
    )
    if (existing.rows[0]) {
      if (existing.rows[0].state !== 'COMPLETE') throw new Error('EVIDENCE_GENERATION_INCOMPLETE')
      if (existing.rows[0].summary.registryHash !== QC_FIELD_REGISTRY_HASH) {
        throw new Error('EVIDENCE_REGISTRY_CHANGED_WITHOUT_CONTRACT_VERSION')
      }
      await client.query('COMMIT')
      return { generationId: existing.rows[0].generation_id, fieldTotal: existing.rows[0].summary.fieldTotal ?? 0, reused: true }
    }
    const generationId = randomUUID()
    const verifiedAt = new Date(run.evidence_verified_at ?? run.updated_at).toISOString()
    await client.query(`INSERT INTO migration_evidence_generations
      (generation_id,child_run_id,snapshot_id,contract_version,mapping_version,target_instance_id,state,verified_at)
      VALUES($1,$2,$3,$4,$5,$6,'BUILDING',$7)`, [generationId,run.run_id,snapshot.snapshot_id,
      EVIDENCE_CONTRACT_VERSION,run.mapping_version,run.target_instance_id,verifiedAt])
    const maps = await client.query<{
      source_entity: string; source_id: string; target_collection: string | null; target_id: string | null;
      target_checksum: string | null; state: string;
      detail: { projection?: unknown; scope?: string; ownsBusinessRow?: boolean }
    }>(`SELECT source_entity,source_id,target_collection,target_id,target_checksum,state,detail
      FROM migration_entity_map WHERE run_id=$1 AND state IN ('VERIFIED','SKIPPED')`, [run.run_id])
    const targets: VerifiedTarget[] = []
    for (const map of maps.rows) {
      if (map.state === 'SKIPPED' && map.detail?.scope === 'external_reference' &&
        map.detail.ownsBusinessRow === false) continue
      if (!map.target_collection || !map.target_id || !map.target_checksum ||
        !map.detail || typeof map.detail !== 'object' || !map.detail.projection ||
        typeof map.detail.projection !== 'object' || Array.isArray(map.detail.projection) ||
        checksum(map.detail.projection) !== map.target_checksum) throw new Error('LEDGER_PROJECTION_INVALID')
      targets.push({ sourceEntity: map.source_entity, sourceId: map.source_id,
        targetCollection: map.target_collection, targetId: map.target_id,
        projectionChecksum: map.target_checksum,
        projection: map.detail.projection as Record<string, unknown> })
    }
    const targetMap = targetIndex(targets)
    const verifiedTargetGroups = new Map<string,VerifiedTarget[]>()
    for (const target of targets) {
      const key = `${target.targetCollection}\0${target.sourceEntity}\0${target.sourceId}`
      const group = verifiedTargetGroups.get(key) ?? []
      group.push(target)
      verifiedTargetGroups.set(key,group)
    }
    const absence = await client.query<{ source_entity: string; source_id: string; target_collection: string }>(
      `SELECT source_entity,source_id,target_collection FROM migration_target_absence_proofs
       WHERE snapshot_id=$1 AND source_store_id=$2 AND proof_kind=$3`,
      [snapshot.snapshot_id,input.sourceStoreId,
        snapshot.provenance_kind === 'synthetic_fixture' ? 'synthetic_fixture' : 'target_read'],
    )
    const confirmedAbsentTargets = new Set(absence.rows.map(row =>
      `${row.target_collection}\0${row.source_entity}\0${row.source_id}`))
    const currencyRows = await client.query<{ source_entity: string; source_id: string; fields: SourceEvidenceRow['fields'] }>(
      `SELECT source_entity,source_id,fields FROM migration_source_evidence_rows
       WHERE snapshot_id=$1 AND ((source_entity='currencies' AND source_store_id IS NULL)
         OR (source_entity='stores' AND source_id=$2 AND source_store_id=$2))`,
      [snapshot.snapshot_id,input.sourceStoreId],
    )
    const currencyCodes = new Map<string,string>()
    let storeCurrencyId: string | undefined
    for (const row of currencyRows.rows) {
      if (row.source_entity === 'currencies' && row.fields.code?.presence === 'value' &&
        /^[A-Z]{3}$/.test(row.fields.code.display ?? '')) {
        if (currencyCodes.has(row.source_id)) throw new Error('SOURCE_CURRENCY_CROSSWALK_DUPLICATE')
        currencyCodes.set(row.source_id,row.fields.code.display!)
      }
      if (row.source_entity === 'stores') storeCurrencyId = row.fields.currency_id?.display ?? undefined
    }
    const storeCurrency = storeCurrencyId ? currencyCodes.get(storeCurrencyId) : undefined
    const orderCurrencyRows = await client.query<{ source_id: string; fields: SourceEvidenceRow['fields'] }>(
      `SELECT source_id,fields FROM migration_source_evidence_rows
       WHERE snapshot_id=$1 AND source_store_id=$2 AND source_entity='orders'`,
      [snapshot.snapshot_id,input.sourceStoreId],
    )
    const orderCurrencies = new Map(orderCurrencyRows.rows.map(order => [order.source_id,
      currencyCodes.get(order.fields.currency_id?.display ?? '')]))
    const methodRows = await client.query<{ source_id: string; fields: SourceEvidenceRow['fields'] }>(
      `SELECT source_id,fields FROM migration_source_evidence_rows
       WHERE snapshot_id=$1 AND source_entity='payment_methods' AND source_store_id IS NULL`,
      [snapshot.snapshot_id],
    )
    const paymentMethods = new Map(methodRows.rows.map(method => [method.source_id,
      method.fields.code?.display ?? undefined]))
    const imageRows = snapshot.summary.selectedTables?.includes('product_images')
      ? await client.query<{ source_id: string; fields: SourceEvidenceRow['fields'] }>(
          `SELECT source_id,fields FROM migration_source_evidence_rows
           WHERE snapshot_id=$1 AND source_store_id=$2 AND source_entity='product_images'
             AND disposition IN ('mapped','partial')`, [snapshot.snapshot_id,input.sourceStoreId])
      : null
    const sourceImages = new Map<string,Array<{ sourceId: string; targetId: string | null }>>()
    if (imageRows) {
      for (const image of imageRows.rows) {
        const productId = image.fields.product_id?.display
        if (!productId) throw new Error('IMAGE_SOURCE_PRODUCT_ID_MISSING')
        // Importer ledger keys media by target collection, while exporter provenance
        // keys the same identity by its PW1 table (product_images).
        const media = targetMap.get(`media\0media\0${image.source_id}`) ??
          targetMap.get(`media\0product_images\0${image.source_id}`)
        const list = sourceImages.get(productId) ?? []
        list.push({ sourceId: image.source_id, targetId: media?.targetId ?? null })
        sourceImages.set(productId,list)
      }
    }
    const addressRows = snapshot.summary.selectedTables?.includes('addresses')
      ? await client.query<{ target_paths: SourceEvidenceRow['targetPaths'] }>(
          `SELECT target_paths FROM migration_source_evidence_rows
           WHERE snapshot_id=$1 AND source_store_id=$2 AND source_entity='addresses'
             AND disposition IN ('mapped','partial')`, [snapshot.snapshot_id,input.sourceStoreId])
      : null
    const addressIndexes = new Map<string,Set<number>>()
    if (addressRows) {
      for (const address of addressRows.rows) {
        for (const contribution of address.target_paths) {
          const match = /^@customers:customers:([1-9]\d*)\.addresses\.(\d+)$/.exec(contribution.path)
          if (!match) continue
          const indexes = addressIndexes.get(match[1]) ?? new Set<number>()
          indexes.add(Number(match[2]))
          addressIndexes.set(match[1],indexes)
        }
      }
    }
    const inventory = await client.query<{ source_entity: string; disposition: string; records: string; fields: string; redacted_fields: string }>(
      `SELECT r.source_entity,r.disposition,count(*)::text AS records,
         sum(f.field_count)::text AS fields,
         sum(r.redacted_field_count)::text AS redacted_fields
       FROM migration_source_evidence_rows r
       CROSS JOIN LATERAL (SELECT count(*)::integer AS field_count FROM jsonb_object_keys(r.fields)) f
       WHERE r.snapshot_id=$1 AND r.source_store_id=$2
       GROUP BY r.source_entity,r.disposition`, [snapshot.snapshot_id,input.sourceStoreId],
    )
    const unattributed = await client.query<{ source_entity: string; records: string; fields: string }>(
      `SELECT r.source_entity,count(*)::text AS records,sum(f.field_count)::text AS fields
       FROM migration_source_evidence_rows r
       CROSS JOIN LATERAL (SELECT count(*)::integer AS field_count FROM jsonb_object_keys(r.fields)) f
       WHERE r.snapshot_id=$1 AND r.source_store_id IS NULL GROUP BY r.source_entity`,
      [snapshot.snapshot_id],
    )
    const dispositions: Record<string,number> = {}
    for (const row of inventory.rows) dispositions[row.disposition] =
      (dispositions[row.disposition] ?? 0) + Number(row.records)
    const sourceInventory = {
      records: inventory.rows.reduce((sum, row) => sum + Number(row.records), 0),
      fields: inventory.rows.reduce((sum, row) => sum + Number(row.fields), 0),
      redactedFields: inventory.rows.reduce((sum, row) => sum + Number(row.redacted_fields), 0),
      dispositions,
      byEntity: inventory.rows.reduce<Record<string,{ records: number; fields: number; dispositions: Record<string,number> }>>(
        (groups,row) => {
          const group = groups[row.source_entity] ?? { records: 0, fields: 0, dispositions: {} }
          group.records += Number(row.records)
          group.fields += Number(row.fields)
          group.dispositions[row.disposition] = Number(row.records)
          groups[row.source_entity] = group
          return groups
        }, {}),
    }
    const digest = createHash('sha256')
    const fieldCounts = emptyCounts()
    const recordCounts = emptyCounts()
    const outsideScope = new Map<string, number>()
    let sourceRecords = 0
    let processedSourceFields = 0
    let fieldTotal = 0
    const pending: FieldResult[] = []
    let cursor: { source_entity: string; source_id: string; record_no: number } | null = null
    for (;;) {
      const source: { rows: SourceDbRow[] } = await client.query<SourceDbRow>(`SELECT source_entity,source_id,source_store_id,record_no,disposition,target_paths,redacted_field_count,fields
        FROM migration_source_evidence_rows
        WHERE snapshot_id=$1 AND source_store_id=$2 AND
          ($3::varchar IS NULL OR (source_entity,source_id,record_no) >
            ($3::varchar,$4::varchar,$5::integer))
        ORDER BY source_entity,source_id,record_no LIMIT 500`, [snapshot.snapshot_id,input.sourceStoreId,
        cursor?.source_entity ?? null,cursor?.source_id ?? null,cursor?.record_no ?? null])
      if (!source.rows.length) break
      for (const entry of source.rows) {
        const row = sourceEvidenceRowSchema.parse({ kind: 'row', table: entry.source_entity,
          sourceId: entry.source_id, storeId: entry.source_store_id, record: entry.record_no,
          disposition: entry.disposition, targetPaths: entry.target_paths,
          redactedFieldCount: entry.redacted_field_count, fields: entry.fields }) as SourceEvidenceRow
        const sourceCurrency = row.table === 'orders'
          ? orderCurrencies.get(row.sourceId)
          : row.table === 'order_details'
          ? orderCurrencies.get(row.fields.order_id?.display ?? '') : storeCurrency
        const customerTargetId = row.table === 'customers'
          ? row.targetPaths.map(path => /^@customers:customers:([1-9]\d*)$/.exec(path.path)?.[1])
              .find((id): id is string => Boolean(id)) : undefined
        const results = compareSourceRow(row, targetMap, input.hmacKey, confirmedAbsentTargets, true,
          sourceCurrency, row.table === 'products' && imageRows ? sourceImages.get(row.sourceId) ?? [] : undefined,
          customerTargetId && addressRows ? addressIndexes.get(customerTargetId)?.size ?? 0 : undefined,
          row.table === 'orders' ? paymentMethods.get(row.fields.payment_method_id?.display ?? '') : undefined,
          verifiedTargetGroups)
        sourceRecords++
        processedSourceFields += Object.keys(row.fields).length
        recordCounts[rollup(results)]++
        for (const result of results) {
          fieldCounts[result.comparisonStatus]++
          if (result.comparisonStatus === 'unsupported') {
            const key = `${result.sourceEntity}.${result.sourceField}:${result.reasonCode}`
            outsideScope.set(key, (outsideScope.get(key) ?? 0) + 1)
          }
          fieldTotal++
          digest.update(JSON.stringify(result)).update('\n')
          pending.push(result)
          if (pending.length >= 500) { await insertFields(client,generationId,verifiedAt,pending); pending.length = 0 }
        }
      }
      const last: SourceDbRow = source.rows[source.rows.length - 1]
      cursor = { source_entity: last.source_entity, source_id: last.source_id, record_no: last.record_no }
    }
    await insertFields(client,generationId,verifiedAt,pending)
    const dbCount = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM migration_field_evidence WHERE generation_id=$1', [generationId],
    )
    if (Number(dbCount.rows[0]?.count) !== fieldTotal) throw new Error('FIELD_EVIDENCE_COUNT_MISMATCH')
    if (Object.values(fieldCounts).reduce((sum, count) => sum + count, 0) !== fieldTotal ||
      processedSourceFields > sourceInventory.fields || sourceRecords > sourceInventory.records) {
      throw new Error('FIELD_EVIDENCE_SUMMARY_INVALID')
    }
    const openExceptions = await client.query<{ severity: string; count: string }>(
      `SELECT severity,count(*)::text AS count FROM migration_exceptions
       WHERE run_id=$1 AND state='OPEN' GROUP BY severity`, [run.run_id],
    )
    const summary = { sourceRecords, fieldTotal, fieldCounts, recordCounts, sourceInventory,
      sourceSnapshotRecords: snapshot.summary.sourceRecords ?? null,
      selectedSourceFiles: snapshot.summary.selectedFiles ?? null,
      unattributedSource: {
        records: unattributed.rows.reduce((sum,row) => sum + Number(row.records),0),
        fields: unattributed.rows.reduce((sum,row) => sum + Number(row.fields),0),
        byEntity: Object.fromEntries(unattributed.rows.map(row => [row.source_entity,
          { records: Number(row.records), fields: Number(row.fields) }])),
      },
      registryVersion: QC_FIELD_REGISTRY_VERSION, registryHash: QC_FIELD_REGISTRY_HASH,
      registrySupport: {
        compare: QC_FIELD_REGISTRY.filter(field => field.support === 'compare').map(field => field.key),
        unsupported: QC_FIELD_REGISTRY.filter(field => field.support === 'unsupported').map(field => ({ key: field.key, reason: field.reason })),
        unverified: QC_FIELD_REGISTRY.filter(field => field.support === 'unverified').map(field => ({ key: field.key, reason: field.reason })),
      },
      openExceptionCount: openExceptions.rows.reduce((sum,row) => sum + Number(row.count), 0),
      openExceptionsBySeverity: Object.fromEntries(openExceptions.rows.map(row => [row.severity,Number(row.count)])),
      outsideScopeFields: [...outsideScope].sort(([a],[b]) => a.localeCompare(b))
        .map(([fieldAndReason,count]) => ({ fieldAndReason, count })),
      sourceFieldsOutsideRunComparison: sourceInventory.fields - processedSourceFields,
      sourceRecordsOutsideRunComparison: sourceInventory.records - sourceRecords,
      comparisonBasis: 'importer_verified_projection', targetDriftCheck: 'not_run',
      piiComparable: snapshot.pii_comparable, provenanceKind: snapshot.provenance_kind,
      sourceSnapshotAt: snapshot.source_snapshot_at ? new Date(snapshot.source_snapshot_at).toISOString() : null,
      sourceCurrency: storeCurrency ?? null,
      stockRule: 'pw1_sku_stock_to_pw2_variant_or_primary_on_hand_snapshot_v1',
      verifiedAtSource: run.evidence_verified_at ? 'importer_verified_event' : 'legacy_run_updated_at_synthetic_only',
      expectedFrom: 'source_evidence_registry_v1' }
    await client.query(`UPDATE migration_evidence_generations
      SET state='COMPLETE',summary=$2::jsonb,digest=$3,completed_at=clock_timestamp()
      WHERE generation_id=$1 AND state='BUILDING'`, [generationId,JSON.stringify(summary),digest.digest('hex')])
    await client.query('COMMIT')
    return { generationId, fieldTotal, reused: false }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
