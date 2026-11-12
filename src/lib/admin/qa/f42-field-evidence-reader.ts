import { sql } from 'drizzle-orm';
import { getPayload } from 'payload';
import config from '@payload-config';
import { QC_FIELD_REGISTRY, QC_FIELD_REGISTRY_HASH, QC_PRIVATE_DISPLAY_KEYS, F42_FIELD_EVIDENCE_CONTRACT } from './f42-reader-contract';
import { F42_FIELD_SCHEMA, F42_WEBSITE_CATALOG_SCHEMA, F42SourceUnavailableError } from './f42-source-contract';
import { isF42SchemaReady } from './f42-source-readiness';
import { readWebsiteCatalogScope } from './website-migration-catalog';
import { FIELD_STATUSES, type FieldCounts, type FieldEvidenceResult, type FieldEvidenceSummary, type FieldStatus, type RecordFieldEvidenceResult } from './field-evidence-summary';
import type { ReconciliationEntity } from './migration-reconciliation';

type Db = Awaited<ReturnType<typeof getPayload>>['db']['drizzle'];
export class F42EvidenceVersionConflict extends Error {
  constructor() { super('F42_EVIDENCE_VERSION_CONFLICT'); }
}
export type EvidenceVersion = { generationId: string; digest: string };
function assertEvidenceVersion(actual: EvidenceVersion | null, expected?: EvidenceVersion) {
  if (expected && (!actual || actual.generationId !== expected.generationId || actual.digest !== expected.digest)) {
    throw new F42EvidenceVersionConflict();
  }
}
async function rows<T>(db: Db, query: ReturnType<typeof sql>) {
  return (await db.execute(query) as { rows: T[] }).rows;
}
const isCommerce = (group: string) => ['Product', 'SKU', 'Order', 'Order item', 'Customer', 'Discount'].includes(group);
// This API is Super Admin-only. F42 decides which source/target values are
// persisted as display evidence; never derive missing values from fingerprints.
const publicKeys = new Set<string>(QC_FIELD_REGISTRY
  .filter(row => isCommerce(row.group) && !QC_PRIVATE_DISPLAY_KEYS.has(row.key))
  .map(row => row.key));
export type CommerceEntity = 'all' | 'products' | 'orders' | 'discounts' | 'customers';
const commerceGroups: Record<Exclude<CommerceEntity, 'all'>, readonly string[]> = {
  products: ['Product', 'SKU'], orders: ['Order', 'Order item'],
  discounts: ['Discount'], customers: ['Customer'],
};
function keys(scope?: string, entity: CommerceEntity = 'all') {
  return QC_FIELD_REGISTRY.filter(row =>
    (!scope || isCommerce(row.group) === (scope === 'commerce')) &&
    (entity === 'all' || commerceGroups[entity].includes(row.group))
  ).map(row => row.key);
}
async function schemaAvailable(db: Db) {
  return isF42SchemaReady(db, F42_FIELD_SCHEMA);
}

/** Read the selected VERIFIED run, or the latest VERIFIED run when none is selected. */
export async function readFieldSummaries(storeIds: string[], scope?: 'commerce' | 'settings', binding?: { sourceInstance: string; targetInstance: string }, runId?: string, expectedVersion?: EvidenceVersion): Promise<Map<string, FieldEvidenceSummary>> {
  const result = new Map<string, FieldEvidenceSummary>();
  if (!storeIds.length || !binding) {
    assertEvidenceVersion(null, expectedVersion);
    return result;
  }
  const { db: { drizzle: db } } = await getPayload({ config });
  if (!await schemaAvailable(db)) {
    assertEvidenceVersion(null, expectedVersion);
    return result;
  }
  const records = await rows<{ store: string; generationId: string; snapshotId: string; runId: string; digest: string; verifiedAt: string; sourceSnapshotAt: string | null; sourceSnapshotId: string | null; sourceInstance: string; targetInstance: string; registryVersion: string | null; targetDriftCheck: string | null; counts: FieldCounts | null; outsideScope: number; outsideComparison: number; openExceptions: number }>(db, sql`
    WITH latest AS (
      SELECT DISTINCT ON (r.source_store_id) r.source_store_id,r.run_id,r.source_instance_id,r.target_instance_id
      FROM migration_runs r JOIN migration_import_stores i ON i.run_id=r.run_id AND i.source_store_id=r.source_store_id
      WHERE r.source_store_id IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)}) AND r.state='VERIFIED' AND i.state='VERIFIED'
        AND r.source_system='pw1' AND r.source_instance_id=${binding.sourceInstance} AND r.target_instance_id=${binding.targetInstance}
        AND (${runId ?? null}::uuid IS NULL OR r.run_id=${runId ?? null}::uuid)
      ORDER BY r.source_store_id,r.updated_at DESC,r.run_id DESC
    )
    SELECT l.source_store_id AS store,g.generation_id::text AS "generationId",g.snapshot_id::text AS "snapshotId",l.run_id::text AS "runId",g.digest,
      g.verified_at::text AS "verifiedAt",g.source_snapshot_at::text AS "sourceSnapshotAt",
      g.source_snapshot_id AS "sourceSnapshotId",l.source_instance_id AS "sourceInstance",l.target_instance_id AS "targetInstance",
      g.summary->>'registryVersion' AS "registryVersion",g.summary->>'targetDriftCheck' AS "targetDriftCheck",
      GREATEST(COALESCE((g.summary->>'sourceFieldsOutsideRunComparison')::integer,0),0) AS "outsideComparison",
      (SELECT jsonb_object_agg(c.comparison_status,c.n) FROM (
        SELECT f.comparison_status,count(*)::integer n FROM migration_field_evidence f
        WHERE f.generation_id=g.generation_id AND (f.source_entity || '.' || f.source_field) IN (${sql.join(keys(scope).map(key => sql`${key}`), sql`,`)})
        GROUP BY f.comparison_status) c) AS counts,
      (SELECT count(*)::integer FROM migration_field_evidence f WHERE f.generation_id=g.generation_id AND (f.source_entity || '.' || f.source_field) NOT IN (${sql.join(keys().map(key => sql`${key}`), sql`,`)})) AS "outsideScope",
      (SELECT count(*)::integer FROM migration_exceptions e WHERE e.run_id=l.run_id AND e.state='OPEN') AS "openExceptions"
    FROM latest l JOIN LATERAL (
      SELECT g.*,s.source_snapshot_at,s.source_snapshot_id FROM migration_evidence_generations g
      JOIN migration_source_evidence_snapshots s ON s.snapshot_id=g.snapshot_id
      WHERE g.child_run_id=l.run_id AND g.state='COMPLETE' AND g.contract_version=${F42_FIELD_EVIDENCE_CONTRACT}
        AND g.target_instance_id=${binding.targetInstance}
        AND s.source_instance_id=${binding.sourceInstance}
        AND s.state='COMPLETE' AND s.provenance_kind='exporter_sidecar' AND s.summary->>'sidecarVersion'='3'
        AND g.summary->>'registryHash'=${QC_FIELD_REGISTRY_HASH} AND g.digest IS NOT NULL
      ORDER BY g.completed_at DESC,g.generation_id DESC LIMIT 1
    ) g ON true`);
  for (const row of records) {
    const counts = Object.fromEntries(FIELD_STATUSES.map(key => [key, row.counts?.[key] ?? 0])) as FieldCounts;
    result.set(row.store, { ...row, counts });
  }
  if (expectedVersion) {
    const selected = storeIds.length === 1 ? result.get(storeIds[0]) ?? null : null;
    assertEvidenceVersion(selected, expectedVersion);
  }
  return result;
}

export async function readFieldEvidence(store: string, scope: 'commerce' | 'settings', page: number, status: FieldStatus | 'all', entity: CommerceEntity = 'all', runId?: string, expectedVersion?: EvidenceVersion): Promise<FieldEvidenceResult> {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  if (!await isF42SchemaReady(db, F42_WEBSITE_CATALOG_SCHEMA)) throw new F42SourceUnavailableError();
  const binding = await readWebsiteCatalogScope(payload);
  const summary = (await readFieldSummaries([store], scope, binding, runId, expectedVersion)).get(store) ?? null;
  if (!summary) return { summary: null, rows: [], total: 0, page };
  if (!summary.snapshotId) throw new F42SourceUnavailableError();
  const entityTotals = scope === 'commerce' ? await rows<{ entity: Exclude<CommerceEntity, 'all'>; status: FieldStatus; total: number }>(db, sql`
    SELECT CASE WHEN f.source_entity IN ('products','product_skus') THEN 'products'
      WHEN f.source_entity IN ('orders','order_details') THEN 'orders'
      WHEN f.source_entity IN ('promotions','promotion_codes') THEN 'discounts'
      WHEN f.source_entity='customers' THEN 'customers' END AS entity,
      f.comparison_status AS status,count(*)::integer AS total
    FROM migration_field_evidence f
    WHERE f.generation_id=${summary.generationId}::uuid
      AND (f.source_entity || '.' || f.source_field) IN (${sql.join(keys('commerce').map(key => sql`${key}`), sql`,`)})
    GROUP BY 1,2
  `) : [];
  const byEntity: NonNullable<FieldEvidenceResult['byEntity']> = {};
  for (const row of entityTotals) {
    if (!row.entity) continue;
    byEntity[row.entity] ??= Object.fromEntries(FIELD_STATUSES.map(key => [key, 0])) as FieldCounts;
    byEntity[row.entity]![row.status] = Number(row.total);
  }
  const filter = sql`f.generation_id=${summary.generationId}::uuid AND (f.source_entity || '.' || f.source_field) IN (${sql.join(keys(scope, entity).map(key => sql`${key}`), sql`,`)}) AND (${status}='all' OR f.comparison_status=${status})`;
  const [count] = await rows<{ total: number }>(db, sql`SELECT count(*)::integer total FROM migration_field_evidence f WHERE ${filter}`);
  const fields = await rows<{ key: string; record: string; status: FieldStatus; reason: string; source: string | null; target: string | null; sourcePresence: 'absent' | 'null' | 'empty' | 'value' | null; disposition: string }>(db, sql`
    SELECT (f.source_entity || '.' || f.source_field) AS key,
      (f.source_id || ':' || f.source_record_no) AS record,
      f.comparison_status AS status,f.reason_code AS reason,
      COALESCE(r.fields->f.source_field->>'display', f.source_display) AS source,f.target_display AS target,
      r.fields->f.source_field->>'presence' AS "sourcePresence",f.source_disposition AS disposition
    FROM migration_field_evidence f
    LEFT JOIN migration_source_evidence_rows r ON r.snapshot_id=${summary.snapshotId}::uuid
      AND r.source_store_id=${store}
      AND r.source_entity=f.source_entity AND r.source_id=f.source_id AND r.record_no=f.source_record_no
    WHERE ${filter}
    ORDER BY f.source_entity,f.source_id,f.source_record_no,f.source_field,f.element_key LIMIT 100 OFFSET ${(page - 1) * 100}`);
  return { summary, byEntity, total: count.total, page, rows: fields.map(field => ({
    ...field,
    // Display values are limited to reviewed Commerce keys and Super Admin callers;
    // fingerprints, credentials and unreviewed fields never leave this API.
    // element_key is intentionally not exposed: it can embed private values.
    record: /^\d+(?::[\w.-]*)*$/.test(field.record) ? field.record : 'Đã ẩn định danh',
    source: publicKeys.has(field.key) ? field.source?.slice(0, 240) ?? null : null,
    target: publicKeys.has(field.key) ? field.target?.slice(0, 240) ?? null : null,
  })) };
}

export type CommerceRecordPreview = { label: string; pw1: string | null; pw2: string | null; status: FieldStatus; explanation?: string };
export type CommerceRecordPreviews = { version: EvidenceVersion | null; previews: Map<string, CommerceRecordPreview> };

function formatMinorUnitsAsMyr(value: string | null): string | null {
  if (!value || !/^-?\d+$/.test(value)) return null;
  const amount = BigInt(value);
  const absolute = amount < BigInt(0) ? -amount : amount;
  return `${amount < BigInt(0) ? '-' : ''}RM ${(absolute / BigInt(100)).toString()}.${(absolute % BigInt(100)).toString().padStart(2, '0')}`;
}

/** One bounded read for business values already approved in the bound F42 generation. */
export async function readCommerceRecordPreviews(storeId: string, runId: string): Promise<CommerceRecordPreviews> {
  const previews = new Map<string, CommerceRecordPreview>();
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  if (!await schemaAvailable(db) || !await isF42SchemaReady(db, F42_WEBSITE_CATALOG_SCHEMA)) return { version: null, previews };
  const binding = await readWebsiteCatalogScope(payload);
  if (!binding) return { version: null, previews };
  const [generation] = await rows<{ generationId: string; snapshotId: string; digest: string }>(db, sql`
    SELECT g.generation_id::text AS "generationId",g.snapshot_id::text AS "snapshotId",g.digest
    FROM migration_runs r
    JOIN migration_import_stores i ON i.run_id=r.run_id AND i.source_store_id=r.source_store_id
    JOIN migration_evidence_generations g ON g.child_run_id=r.run_id
    JOIN migration_source_evidence_snapshots s ON s.snapshot_id=g.snapshot_id
    WHERE r.run_id=${runId}::uuid AND r.source_store_id=${storeId}
      AND r.state='VERIFIED' AND i.state='VERIFIED' AND r.source_system='pw1'
      AND r.source_instance_id=${binding.sourceInstance} AND r.target_instance_id=${binding.targetInstance}
      AND g.target_instance_id=${binding.targetInstance} AND g.state='COMPLETE'
      AND g.contract_version=${F42_FIELD_EVIDENCE_CONTRACT} AND g.digest IS NOT NULL
      AND g.summary->>'registryHash'=${QC_FIELD_REGISTRY_HASH}
      AND s.source_instance_id=${binding.sourceInstance} AND s.state='COMPLETE'
      AND s.provenance_kind='exporter_sidecar' AND s.summary->>'sidecarVersion'='3'
    ORDER BY g.completed_at DESC,g.generation_id DESC LIMIT 1
  `);
  if (!generation) return { version: null, previews };
  const records = await rows<{
    entity: string; sourceId: string; key: string; source: string | null; target: string | null; status: FieldStatus; discountType: string | null;
  }>(db, sql`
    WITH mapped AS (
      SELECT DISTINCT m.source_entity,m.source_id FROM migration_entity_map m
      WHERE m.run_id=${runId}::uuid AND m.source_system='pw1'
        AND m.source_entity IN ('products','orders','customers','promotion_codes')
    ), candidate AS (
      SELECT m.source_entity AS entity,m.source_id AS "sourceId",
        (f.source_entity || '.' || f.source_field) AS key,
        COALESCE(r.fields->f.source_field->>'display', f.source_display) AS source,
        f.target_display AS target,f.comparison_status AS status,NULL::text AS "discountType"
      FROM mapped m JOIN migration_source_evidence_rows r
        ON r.snapshot_id=${generation.snapshotId}::uuid AND r.source_store_id=${storeId}
        AND r.source_entity=m.source_entity AND r.source_id=m.source_id
      JOIN migration_field_evidence f ON f.generation_id=${generation.generationId}::uuid
        AND f.source_entity=r.source_entity AND f.source_id=r.source_id AND f.source_record_no=r.record_no
      WHERE (m.source_entity='products' AND f.source_field='name')
        OR (m.source_entity='orders' AND f.source_field='total')
        OR (m.source_entity='customers' AND f.source_field='address_count')
      UNION ALL
      SELECT m.source_entity AS entity,m.source_id AS "sourceId",
        (f.source_entity || '.' || f.source_field) AS key,
        COALESCE(promotion.fields->f.source_field->>'display', f.source_display) AS source,
        f.target_display AS target,f.comparison_status AS status,
        promotion.fields->'discount_type_id'->>'display' AS "discountType"
      FROM mapped m JOIN migration_source_evidence_rows code
        ON code.snapshot_id=${generation.snapshotId}::uuid AND code.source_store_id=${storeId}
        AND code.source_entity='promotion_codes' AND code.source_id=m.source_id
      JOIN migration_source_evidence_rows promotion
        ON promotion.snapshot_id=code.snapshot_id AND promotion.source_store_id=code.source_store_id
        AND promotion.source_entity='promotions'
        AND promotion.source_id=code.fields->'promotion_id'->>'display'
      JOIN migration_field_evidence f ON f.generation_id=${generation.generationId}::uuid
        AND f.source_entity='promotions' AND f.source_id=promotion.source_id
        AND f.source_record_no=promotion.record_no AND f.source_field='discount_value'
      WHERE m.source_entity='promotion_codes'
    ) SELECT DISTINCT ON (entity,"sourceId") entity,"sourceId",key,source,target,status,"discountType"
      FROM candidate ORDER BY entity,"sourceId",key,status LIMIT 5000
  `);
  const labels: Record<string, string> = {
    'products.name': 'Tên sản phẩm', 'orders.total': 'Tổng tiền',
    'customers.address_count': 'Số địa chỉ', 'promotions.discount_value': 'Giá trị giảm giá',
  };
  for (const row of records) {
    if (!publicKeys.has(row.key) || !FIELD_STATUSES.includes(row.status)) continue;
    const fixedDiscount = row.key === 'promotions.discount_value' && row.discountType === '2';
    const formattedTarget = fixedDiscount ? formatMinorUnitsAsMyr(row.target) : null;
    previews.set(`${row.entity}\0${row.sourceId}`, {
      label: labels[row.key] ?? row.key,
      pw1: fixedDiscount && row.source !== null ? `RM ${row.source.slice(0, 240)}` : row.source?.slice(0, 240) ?? null,
      pw2: formattedTarget ?? row.target?.slice(0, 240) ?? null,
      status: row.status,
      ...(fixedDiscount ? { explanation: formattedTarget
        ? 'PW2 lưu số sen; hai bên được hiển thị theo RM.'
        : 'PW2 lưu số sen; mở chi tiết để xem quy tắc đối chiếu.' } : {}),
    });
  }
  return { version: { generationId: generation.generationId, digest: generation.digest }, previews };
}

/** Read one ledger record's import-time field proof from the same verified child run. */
export async function readRecordFieldEvidence(input: {
  storeId: string;
  runId: string;
  entity: ReconciliationEntity;
  sourceId: string;
  targetIds: string[];
  page: number;
  status: FieldStatus | 'all';
  expectedVersion: EvidenceVersion;
}): Promise<RecordFieldEvidenceResult> {
  const unavailable = (reason: string): RecordFieldEvidenceResult => ({
    state: 'unavailable', reason, runId: input.runId, generationId: null, snapshotId: null,
    sourceSnapshotAt: null, verifiedAt: null,
    counts: Object.fromEntries(FIELD_STATUSES.map(status => [status, 0])) as FieldCounts,
    total: 0, page: input.page, rows: [],
  });
  const rootEntity: Partial<Record<ReconciliationEntity, string>> = {
    products: 'products', orders: 'orders', discounts: 'promotion_codes', customers: 'customers',
  };
  const sourceEntity = rootEntity[input.entity];
  if (!sourceEntity) return unavailable('Nhóm bản ghi chưa có đối soát Commerce.');
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  if (!await schemaAvailable(db) || !await isF42SchemaReady(db, F42_WEBSITE_CATALOG_SCHEMA)) throw new F42SourceUnavailableError();
  const binding = await readWebsiteCatalogScope(payload);
  if (!binding) return unavailable('Chưa có binding nguồn/đích F42 được xác minh.');
  const [generation] = await rows<{
    generationId: string; snapshotId: string; sourceSnapshotAt: string | null; verifiedAt: string; digest: string;
  }>(db, sql`
    SELECT g.generation_id::text AS "generationId",g.snapshot_id::text AS "snapshotId",
      s.source_snapshot_at::text AS "sourceSnapshotAt",g.verified_at::text AS "verifiedAt",g.digest
    FROM migration_runs r
    JOIN migration_import_stores i ON i.run_id=r.run_id AND i.source_store_id=r.source_store_id
    JOIN migration_evidence_generations g ON g.child_run_id=r.run_id
    JOIN migration_source_evidence_snapshots s ON s.snapshot_id=g.snapshot_id
    WHERE r.run_id=${input.runId}::uuid AND r.source_store_id=${input.storeId}
      AND r.state='VERIFIED' AND i.state='VERIFIED' AND r.source_system='pw1'
      AND r.source_instance_id=${binding.sourceInstance} AND r.target_instance_id=${binding.targetInstance}
      AND g.target_instance_id=${binding.targetInstance} AND g.state='COMPLETE'
      AND g.contract_version=${F42_FIELD_EVIDENCE_CONTRACT} AND g.digest IS NOT NULL
      AND g.summary->>'registryHash'=${QC_FIELD_REGISTRY_HASH}
      AND s.source_instance_id=${binding.sourceInstance} AND s.state='COMPLETE'
      AND s.provenance_kind='exporter_sidecar' AND s.summary->>'sidecarVersion'='3'
    ORDER BY g.completed_at DESC,g.generation_id DESC LIMIT 1
  `);
  assertEvidenceVersion(generation ?? null, input.expectedVersion);
  if (!generation) return unavailable('Run này chưa có generation field evidence hợp lệ.');
  const [root] = await rows<{ present: boolean }>(db, sql`
    SELECT EXISTS (SELECT 1 FROM migration_source_evidence_rows r
      WHERE r.snapshot_id=${generation.snapshotId}::uuid AND r.source_store_id=${input.storeId}
        AND r.source_entity=${sourceEntity} AND r.source_id=${input.sourceId}) AS present
  `);
  if (!root?.present) return unavailable('Bản ghi nguồn không thuộc snapshot đã gắn với run này.');

  const children = input.entity === 'products'
    ? sql`OR (r.source_entity='product_skus' AND r.fields->'product_id'->>'display'=${input.sourceId})`
    : input.entity === 'orders'
      ? sql`OR (r.source_entity='order_details' AND r.fields->'order_id'->>'display'=${input.sourceId})`
      : input.entity === 'discounts'
        ? sql`OR (r.source_entity='promotions' AND EXISTS (
            SELECT 1 FROM migration_source_evidence_rows code
            WHERE code.snapshot_id=r.snapshot_id AND code.source_store_id=r.source_store_id
              AND code.source_entity='promotion_codes' AND code.source_id=${input.sourceId}
              AND code.fields->'promotion_id'->>'display'=r.source_id))`
        : sql``;
  const related = sql`
    SELECT r.source_entity,r.source_id,r.record_no FROM migration_source_evidence_rows r
    WHERE r.snapshot_id=${generation.snapshotId}::uuid AND r.source_store_id=${input.storeId}
      AND ((r.source_entity=${sourceEntity} AND r.source_id=${input.sourceId}) ${children})
  `;
  const fieldFilter = sql`(f.source_entity || '.' || f.source_field) IN (${sql.join(keys('commerce').map(key => sql`${key}`), sql`,`)})`;
  const counts = Object.fromEntries(FIELD_STATUSES.map(status => [status, 0])) as FieldCounts;
  const countRows = await rows<{ status: FieldStatus; total: number }>(db, sql`
    WITH related AS (${related})
    SELECT f.comparison_status AS status,count(*)::integer AS total
    FROM related r JOIN migration_field_evidence f
      ON f.generation_id=${generation.generationId}::uuid
      AND f.source_entity=r.source_entity AND f.source_id=r.source_id AND f.source_record_no=r.record_no
    WHERE ${fieldFilter} GROUP BY f.comparison_status
  `);
  for (const row of countRows) if (FIELD_STATUSES.includes(row.status)) counts[row.status] = Number(row.total);
  const total = input.status === 'all'
    ? FIELD_STATUSES.reduce((sum, status) => sum + counts[status], 0)
    : counts[input.status];
  const fieldRows = await rows<{
    entity: string; sourceId: string; sourceField: string; targetField: string | null;
    elementKey: string; source: string | null; target: string | null;
    sourcePresence: 'absent' | 'null' | 'empty' | 'value' | null;
    status: FieldStatus; reason: string; transform: string; disposition: string; targetId: string | null;
  }>(db, sql`
    WITH related AS (${related})
    SELECT f.source_entity AS entity,f.source_id AS "sourceId",f.source_field AS "sourceField",
      f.target_field AS "targetField",f.element_key AS "elementKey",
      COALESCE(r2.fields->f.source_field->>'display', f.source_display) AS source,
      f.target_display AS target,
      r2.fields->f.source_field->>'presence' AS "sourcePresence",
      f.comparison_status AS status,f.reason_code AS reason,f.transform_code AS transform,
      f.source_disposition AS disposition,f.target_id AS "targetId"
    FROM related r JOIN migration_field_evidence f
      ON f.generation_id=${generation.generationId}::uuid
      AND f.source_entity=r.source_entity AND f.source_id=r.source_id AND f.source_record_no=r.record_no
    LEFT JOIN migration_source_evidence_rows r2
      ON r2.snapshot_id=${generation.snapshotId}::uuid AND r2.source_store_id=${input.storeId}
      AND r2.source_entity=r.source_entity
      AND r2.source_id=r.source_id AND r2.record_no=r.record_no
    WHERE ${fieldFilter} AND (${input.status}='all' OR f.comparison_status=${input.status})
    ORDER BY CASE WHEN f.source_entity=${sourceEntity} THEN 0 ELSE 1 END,
      f.source_entity,f.source_id,f.source_record_no,f.source_field,f.element_key
    LIMIT 100 OFFSET ${(input.page - 1) * 100}
  `);
  return {
    state: 'complete', reason: total ? null : input.status === 'all'
      ? 'Chưa có field evidence trong registry QC cho bản ghi này.'
      : 'Không có trường ở trạng thái đang lọc.',
    runId: input.runId, generationId: generation.generationId, snapshotId: generation.snapshotId,
    sourceSnapshotAt: generation.sourceSnapshotAt, verifiedAt: generation.verifiedAt,
    counts, total, page: input.page,
    rows: fieldRows.map(row => {
      const key = `${row.entity}.${row.sourceField}`;
      return {
        entity: row.entity,
        sourceRecord: /^\d{1,19}$/.test(row.sourceId) ? `${row.entity} #${row.sourceId}` : 'Bản ghi đã chọn',
        // Element keys can contain source fingerprints or private values. An ordinal
        // remains sufficient to distinguish repeated field evidence in this view.
        key, targetKey: row.targetField, elementKey: '',
        source: publicKeys.has(key) ? row.source?.slice(0, 240) ?? null : null,
        target: publicKeys.has(key) ? row.target?.slice(0, 240) ?? null : null,
        displayAllowed: publicKeys.has(key),
        sourcePresence: row.sourcePresence, status: row.status, reason: row.reason,
        transform: row.transform, disposition: row.disposition,
        targetIdentityMatchesLedger: row.entity === sourceEntity && row.targetId
          ? input.targetIds.includes(row.targetId) : null,
      };
    }),
  };
}
