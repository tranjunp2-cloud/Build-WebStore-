import { sql } from 'drizzle-orm';
import { getPayload } from 'payload';
import config from '@payload-config';
import { QC_FIELD_REGISTRY, QC_FIELD_REGISTRY_HASH, F42_FIELD_EVIDENCE_CONTRACT } from './f42-reader-contract';
import { F42_FIELD_SCHEMA, F42_WEBSITE_CATALOG_SCHEMA, F42SourceUnavailableError } from './f42-source-contract';
import { isF42SchemaReady } from './f42-source-readiness';
import { readWebsiteCatalogScope } from './website-migration-catalog';
import { APPROVED_RECONCILIATION_FIELD_KEYS } from './migration-reconciliation';
import { FIELD_STATUSES, type FieldCounts, type FieldEvidenceResult, type FieldEvidenceSummary, type FieldStatus } from './field-evidence-summary';

type Db = Awaited<ReturnType<typeof getPayload>>['db']['drizzle'];
async function rows<T>(db: Db, query: ReturnType<typeof sql>) {
  return (await db.execute(query) as { rows: T[] }).rows;
}
const publicKeys = new Set<string>([...APPROVED_RECONCILIATION_FIELD_KEYS, 'product_skus.stock', 'orders.total', 'order_details.quantity', 'order_details.price']);
const isCommerce = (group: string) => ['Product', 'SKU', 'Order', 'Order item', 'Customer', 'Discount'].includes(group);
function keys(scope?: string) {
  return QC_FIELD_REGISTRY.filter(row => !scope || isCommerce(row.group) === (scope === 'commerce')).map(row => row.key);
}
async function schemaAvailable(db: Db) {
  return isF42SchemaReady(db, F42_FIELD_SCHEMA);
}

/** One batch query; latest VERIFIED run only, never fall back to an older run's evidence. */
export async function readFieldSummaries(storeIds: string[], scope?: 'commerce' | 'settings', binding?: { sourceInstance: string; targetInstance: string }): Promise<Map<string, FieldEvidenceSummary>> {
  const result = new Map<string, FieldEvidenceSummary>();
  if (!storeIds.length || !binding) return result;
  const { db: { drizzle: db } } = await getPayload({ config });
  if (!await schemaAvailable(db)) return result;
  const records = await rows<{ store: string; generationId: string; runId: string; digest: string; verifiedAt: string; sourceSnapshotAt: string | null; counts: FieldCounts | null; outsideScope: number; outsideComparison: number; openExceptions: number }>(db, sql`
    WITH latest AS (
      SELECT DISTINCT ON (r.source_store_id) r.source_store_id,r.run_id
      FROM migration_runs r JOIN migration_import_stores i ON i.run_id=r.run_id AND i.source_store_id=r.source_store_id
      WHERE r.source_store_id IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)}) AND r.state='VERIFIED' AND i.state='VERIFIED'
        AND r.source_system='pw1' AND r.source_instance_id=${binding.sourceInstance} AND r.target_instance_id=${binding.targetInstance}
      ORDER BY r.source_store_id,r.updated_at DESC,r.run_id DESC
    )
    SELECT l.source_store_id AS store,g.generation_id::text AS "generationId",l.run_id::text AS "runId",g.digest,
      g.verified_at::text AS "verifiedAt",g.source_snapshot_at::text AS "sourceSnapshotAt",
      GREATEST(COALESCE((g.summary->>'sourceFieldsOutsideRunComparison')::integer,0),0) AS "outsideComparison",
      (SELECT jsonb_object_agg(c.comparison_status,c.n) FROM (
        SELECT f.comparison_status,count(*)::integer n FROM migration_field_evidence f
        WHERE f.generation_id=g.generation_id AND (f.source_entity || '.' || f.source_field) IN (${sql.join(keys(scope).map(key => sql`${key}`), sql`,`)})
        GROUP BY f.comparison_status) c) AS counts,
      (SELECT count(*)::integer FROM migration_field_evidence f WHERE f.generation_id=g.generation_id AND (f.source_entity || '.' || f.source_field) NOT IN (${sql.join(keys().map(key => sql`${key}`), sql`,`)})) AS "outsideScope",
      (SELECT count(*)::integer FROM migration_exceptions e WHERE e.run_id=l.run_id AND e.state='OPEN') AS "openExceptions"
    FROM latest l JOIN LATERAL (
      SELECT g.*,s.source_snapshot_at FROM migration_evidence_generations g
      JOIN migration_source_evidence_snapshots s ON s.snapshot_id=g.snapshot_id
      WHERE g.child_run_id=l.run_id AND g.state='COMPLETE' AND g.contract_version=${F42_FIELD_EVIDENCE_CONTRACT}
        AND s.state='COMPLETE' AND s.provenance_kind='exporter_sidecar' AND s.summary->>'sidecarVersion'='3'
        AND g.summary->>'registryHash'=${QC_FIELD_REGISTRY_HASH} AND g.digest IS NOT NULL
      ORDER BY g.completed_at DESC,g.generation_id DESC LIMIT 1
    ) g ON true`);
  for (const row of records) {
    const counts = Object.fromEntries(FIELD_STATUSES.map(key => [key, row.counts?.[key] ?? 0])) as FieldCounts;
    result.set(row.store, { ...row, counts });
  }
  return result;
}

export async function readFieldEvidence(store: string, scope: 'commerce' | 'settings', page: number, status: FieldStatus | 'all'): Promise<FieldEvidenceResult> {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  if (!await isF42SchemaReady(db, F42_WEBSITE_CATALOG_SCHEMA)) throw new F42SourceUnavailableError();
  const binding = await readWebsiteCatalogScope(payload);
  const summary = (await readFieldSummaries([store], scope, binding)).get(store) ?? null;
  if (!summary) return { summary: null, rows: [], total: 0, page };
  const filter = sql`generation_id=${summary.generationId}::uuid AND (source_entity || '.' || source_field) IN (${sql.join(keys(scope).map(key => sql`${key}`), sql`,`)}) AND (${status}='all' OR comparison_status=${status})`;
  const [count] = await rows<{ total: number }>(db, sql`SELECT count(*)::integer total FROM migration_field_evidence WHERE ${filter}`);
  const fields = await rows<{ key: string; record: string; status: FieldStatus; reason: string; source: string | null; target: string | null; disposition: string }>(db, sql`
    SELECT (source_entity || '.' || source_field) AS key,
      (source_id || ':' || source_record_no || ':' || element_key) AS record,
      comparison_status AS status,reason_code AS reason,source_display AS source,target_display AS target,source_disposition AS disposition
    FROM migration_field_evidence WHERE ${filter}
    ORDER BY source_entity,source_id,source_record_no,source_field,element_key LIMIT 100 OFFSET ${(page - 1) * 100}`);
  return { summary, total: count.total, page, rows: fields.map(field => ({
    ...field,
    // Raw PII, fingerprints, credentials and unreviewed display fields never leave this API.
    record: /^\d+(?::[\w.-]*)*$/.test(field.record) ? field.record : 'Đã ẩn định danh',
    source: publicKeys.has(field.key) ? field.source?.slice(0, 240) ?? null : null,
    target: publicKeys.has(field.key) ? field.target?.slice(0, 240) ?? null : null,
  })) };
}
