import 'server-only';
import { sql } from 'drizzle-orm';
import { getPayload } from 'payload';
import config from '@payload-config';
import { F42_SOURCE_COVERAGE_SCHEMA, F42_WEBSITE_CATALOG_SCHEMA, F42SourceUnavailableError } from './f42-source-contract';
import { isF42SchemaReady } from './f42-source-readiness';
import { readWebsiteCatalogScope } from './website-migration-catalog';
import { QC_FIELD_REGISTRY, QC_FIELD_REGISTRY_VERSION } from './f42-reader-contract';

export type SourceCoverageBucket = {
  entity: string;
  disposition: string;
  records: number;
  comparableFields: number;
  redactedFields: number;
};

export type SourceCoverage = {
  state: 'complete' | 'unavailable';
  reason: string | null;
  snapshotId: string | null;
  sourceSnapshotId: string | null;
  sourceSnapshotAt: string | null;
  manifestSha256: string | null;
  sidecarSha256: string | null;
  sourceInstance: string | null;
  registryVersion: string;
  selectedFiles: Array<{ table: string; rowCount: number | null; sha256: string }>;
  snapshotRecords: number | null;
  records: number;
  comparableFields: number;
  redactedFields: number;
  fieldDispositions: Array<{ entity: string; disposition: string; fields: number }>;
  outsideRegistry: Array<{ entity: string; fields: number }>;
  unattributed: { records: number; comparableFields: number; redactedFields: number };
  buckets: SourceCoverageBucket[];
};

const unavailable = (reason: string): SourceCoverage => ({
  state: 'unavailable', reason, snapshotId: null, sourceSnapshotId: null,
  sourceSnapshotAt: null, manifestSha256: null, sidecarSha256: null,
  sourceInstance: null, registryVersion: QC_FIELD_REGISTRY_VERSION, selectedFiles: [], snapshotRecords: null,
  records: 0, comparableFields: 0, redactedFields: 0,
  fieldDispositions: [], outsideRegistry: [],
  unattributed: { records: 0, comparableFields: 0, redactedFields: 0 }, buckets: [],
});

/** Read only evidence already tied to this source namespace and Store. */
export async function readSourceCoverage(storeId: string, expectedSnapshotId?: string): Promise<SourceCoverage> {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  if (!await isF42SchemaReady(db, F42_SOURCE_COVERAGE_SCHEMA) || !await isF42SchemaReady(db, F42_WEBSITE_CATALOG_SCHEMA)) {
    throw new F42SourceUnavailableError();
  }
  const binding = await readWebsiteCatalogScope(payload);
  if (!binding) return unavailable('Chưa có binding nguồn F42 được xác minh.');

  const result = await db.execute(sql`
    SELECT s.snapshot_id::text AS "snapshotId", s.source_snapshot_id AS "sourceSnapshotId",
      s.source_snapshot_at::text AS "sourceSnapshotAt", s.manifest_sha256 AS "manifestSha256",
      s.sidecar_sha256 AS "sidecarSha256", s.source_instance_id AS "sourceInstance",
      s.summary->'selectedFiles' AS "selectedFiles",s.summary->>'sourceRecords' AS "snapshotRecords"
    FROM migration_source_evidence_snapshots s
    WHERE s.source_instance_id=${binding.sourceInstance}
      AND (${expectedSnapshotId ?? null}::uuid IS NULL OR s.snapshot_id=${expectedSnapshotId ?? null}::uuid)
      AND s.state='COMPLETE' AND s.provenance_kind='exporter_sidecar'
      AND s.summary->>'sidecarVersion'='3'
      AND EXISTS (SELECT 1 FROM migration_source_evidence_rows r
        WHERE r.snapshot_id=s.snapshot_id AND r.source_store_id=${storeId})
    ORDER BY s.completed_at DESC,s.snapshot_id DESC LIMIT 1
  `) as { rows: Array<Pick<SourceCoverage, 'snapshotId' | 'sourceSnapshotId' | 'sourceSnapshotAt' | 'manifestSha256' | 'sidecarSha256' | 'sourceInstance'> & { selectedFiles: unknown; snapshotRecords: string | null }> };
  const snapshot = result.rows[0];
  if (!snapshot?.snapshotId) return unavailable('Không có sidecar nguồn trước lọc đã xác minh cho Store này.');
  if (!Array.isArray(snapshot.selectedFiles) || snapshot.selectedFiles.length > 256) {
    return unavailable('Danh sách selected CSV của snapshot chưa hợp lệ.');
  }
  const selectedFiles = snapshot.selectedFiles.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const file = item as Record<string, unknown>;
    if (typeof file.table !== 'string' || !/^[a-z_]{1,64}$/.test(file.table)
      || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isInteger(file.rowCount) || Number(file.rowCount) < 0) return [];
    return [{ table: file.table, sha256: file.sha256, rowCount: file.rowCount as number | null }];
  });
  if (selectedFiles.length !== snapshot.selectedFiles.length) {
    return unavailable('Danh sách selected CSV của snapshot chưa hợp lệ.');
  }
  const snapshotRecords = Number(snapshot.snapshotRecords);
  if (snapshot.snapshotRecords === null || !Number.isSafeInteger(snapshotRecords) || snapshotRecords < 0
    || selectedFiles.reduce((sum, file) => sum + (file.rowCount ?? 0), 0) !== snapshotRecords) {
    return unavailable('Số dòng selected CSV không khớp tổng sidecar.');
  }
  const persistedRows = await db.execute(sql`
    SELECT source_entity AS entity, count(*)::text AS total
    FROM migration_source_evidence_rows
    WHERE snapshot_id=${snapshot.snapshotId}::uuid
    GROUP BY source_entity
  `) as { rows: Array<{ entity: string; total: string }> };
  const expectedByTable = new Map<string, number>();
  for (const file of selectedFiles) {
    expectedByTable.set(file.table, (expectedByTable.get(file.table) ?? 0) + (file.rowCount ?? 0));
  }
  const actualByTable = new Map(persistedRows.rows.map(row => [row.entity, Number(row.total)]));
  if (persistedRows.rows.reduce((total, row) => total + Number(row.total), 0) !== snapshotRecords
    || [...expectedByTable].some(([table, count]) => (actualByTable.get(table) ?? 0) !== count)
    || [...actualByTable].some(([table, count]) => (expectedByTable.get(table) ?? 0) !== count)) {
    return unavailable('Số dòng bằng chứng nguồn đã lưu không khớp selected CSV theo bảng.');
  }

  const aggregate = await db.execute(sql`
    SELECT r.source_entity AS entity,r.disposition,count(*)::integer AS records,
      coalesce(sum(f.field_count),0)::integer AS "comparableFields",
      coalesce(sum(r.redacted_field_count),0)::integer AS "redactedFields"
    FROM migration_source_evidence_rows r
    CROSS JOIN LATERAL (SELECT count(*)::integer AS field_count FROM jsonb_each(r.fields) field
      WHERE field.value->>'presence' IS DISTINCT FROM 'absent') f
    WHERE r.snapshot_id=${snapshot.snapshotId}::uuid AND r.source_store_id=${storeId}
    GROUP BY r.source_entity,r.disposition
    ORDER BY r.source_entity,r.disposition
  `) as { rows: Array<{ entity: string; disposition: string; records: number; comparableFields: number; redactedFields: number }> };
  const fieldAggregate = await db.execute(sql`
    SELECT r.source_entity AS entity, CASE
      WHEN f.value->>'disposition'='mapped' THEN 'emitted'
      WHEN f.value->>'disposition' IN ('retained-source','deleted-retained-source','source-identity') THEN 'retained-source'
      WHEN f.value->>'disposition' IN ('technical-user-excluded','excluded') THEN 'excluded-policy'
      ELSE 'unresolved' END AS disposition, count(*)::integer AS fields
    FROM migration_source_evidence_rows r
    CROSS JOIN LATERAL jsonb_each(r.fields) f
    WHERE r.snapshot_id=${snapshot.snapshotId}::uuid AND r.source_store_id=${storeId}
      AND f.value->>'presence' IS DISTINCT FROM 'absent'
    GROUP BY 1,2
  `) as { rows: Array<{ entity: string; disposition: string; fields: number }> };
  const registryKeys = QC_FIELD_REGISTRY.map(field => field.key);
  const untracked = await db.execute(sql`
    SELECT r.source_entity AS entity,count(*)::integer AS fields
    FROM migration_source_evidence_rows r
    CROSS JOIN LATERAL jsonb_each(r.fields) f
    WHERE r.snapshot_id=${snapshot.snapshotId}::uuid AND r.source_store_id=${storeId}
      AND f.value->>'presence' IS DISTINCT FROM 'absent'
      AND (r.source_entity || '.' || f.key) NOT IN (${sql.join(registryKeys.map(key => sql`${key}`), sql`,`)})
    GROUP BY r.source_entity ORDER BY r.source_entity
  `) as { rows: Array<{ entity: string; fields: number }> };
  const unattributedResult = await db.execute(sql`
    SELECT count(*)::integer AS records,coalesce(sum(f.field_count),0)::integer AS "comparableFields",
      coalesce(sum(r.redacted_field_count),0)::integer AS "redactedFields"
    FROM migration_source_evidence_rows r
    CROSS JOIN LATERAL (SELECT count(*)::integer AS field_count FROM jsonb_each(r.fields) field
      WHERE field.value->>'presence' IS DISTINCT FROM 'absent') f
    WHERE r.snapshot_id=${snapshot.snapshotId}::uuid AND r.source_store_id IS NULL
  `) as { rows: Array<{ records: number; comparableFields: number; redactedFields: number }> };
  const buckets = aggregate.rows.map(row => ({
    entity: row.entity, disposition: row.disposition,
    records: Number(row.records), comparableFields: Number(row.comparableFields), redactedFields: Number(row.redactedFields),
  }));
  return {
    state: 'complete', reason: null,
    snapshotId: snapshot.snapshotId, sourceSnapshotId: snapshot.sourceSnapshotId,
    sourceSnapshotAt: snapshot.sourceSnapshotAt, manifestSha256: snapshot.manifestSha256,
    sidecarSha256: snapshot.sidecarSha256, sourceInstance: snapshot.sourceInstance,
    selectedFiles, snapshotRecords,
    registryVersion: QC_FIELD_REGISTRY_VERSION,
    records: buckets.reduce((sum, row) => sum + row.records, 0),
    comparableFields: buckets.reduce((sum, row) => sum + row.comparableFields, 0),
    redactedFields: buckets.reduce((sum, row) => sum + row.redactedFields, 0),
    fieldDispositions: [
      ...fieldAggregate.rows.map(row => ({ entity: row.entity, disposition: row.disposition, fields: Number(row.fields) })),
      ...buckets.filter(row => row.redactedFields > 0).map(row => ({ entity: row.entity, disposition: 'excluded-security', fields: row.redactedFields })),
    ],
    outsideRegistry: untracked.rows.map(row => ({ entity: row.entity, fields: Number(row.fields) })),
    unattributed: {
      records: Number(unattributedResult.rows[0]?.records ?? 0),
      comparableFields: Number(unattributedResult.rows[0]?.comparableFields ?? 0),
      redactedFields: Number(unattributedResult.rows[0]?.redactedFields ?? 0),
    },
    buckets,
  };
}
