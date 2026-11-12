/** Read-only schema contracts. F40 never creates or repairs the F42 source. */
export type F42SchemaContract = Readonly<Record<string, readonly string[]>>;
export type F42SchemaColumn = { table_name: string; column_name: string };

export const F42_SOURCE_UNAVAILABLE = {
  code: 'F42_SOURCE_UNAVAILABLE',
  error: 'Nguồn F42 chưa sẵn sàng. Nhờ team F42 triển khai schema/evidence tương ứng rồi làm mới.',
} as const;

export const F42_CATALOG_SCOPE_UNAVAILABLE = {
  code: 'F42_CATALOG_SCOPE_UNAVAILABLE',
  error: 'Chưa xác minh được phạm vi nguồn F42 và liên kết website legacy. Cần đối chiếu bằng chứng định danh trước khi hiển thị tổng website.',
} as const;

export const F42_WEBSITE_SCHEMA: F42SchemaContract = {
  pw1_migration_batches: ['id', 'status', 'started_at', 'finished_at', 'limits', 'results'],
  pw1_migration_stores: ['source_store_id', 'site_id', 'tenant_id', 'status', 'input_hash', 'updated_at'],
  pw1_migration_attempts: ['id', 'source_store_id', 'batch_id', 'artifacts'],
  pw1_migration_commits: ['source_store_id', 'input_hash', 'attempt_id', 'committed_at'],
  pw1_migration_qa_audits: ['source_store_id', 'input_hash', 'attempt_id', 'report', 'checked_at', 'base_url'],
  pw1_migration_qa_reviews: ['id', 'source_store_id', 'input_hash', 'attempt_id', 'evidence_version', 'verdict', 'note', 'reviewer_id', 'checks', 'reviewed_at'],
  sites: ['id', 'name', 'tenant_id', 'status', 'updated_at'],
  tenants: ['id', 'slug'],
  pages: ['id', 'site_id', 'slug', 'deleted_at', 'updated_at'],
};

export const F42_IMAGE_REVIEW_SCHEMA: F42SchemaContract = {
  ...F42_WEBSITE_SCHEMA,
  pw1_migration_qa_image_reviews: ['source_store_id', 'evidence_version', 'page_id', 'block_id', 'field_name', 'image_path', 'reviewer_id', 'reviewed_at'],
};

export const F42_WEBSITE_CATALOG_SCHEMA: F42SchemaContract = {
  ...F42_WEBSITE_SCHEMA,
  migration_import_batches: ['batch_id', 'profile_version', 'binding', 'selected_store_ids', 'created_at'],
  migration_import_stores: ['batch_id', 'source_store_id', 'run_id'],
  migration_runs: ['run_id', 'batch_id', 'source_system', 'source_instance_id', 'source_store_id', 'target_instance_id'],
  migration_entity_map: ['run_id', 'source_system', 'source_instance_id', 'source_entity', 'source_id', 'target_collection', 'target_id', 'claim_active', 'state'],
};

export const F42_IMAGE_CHECK_SCHEMA: F42SchemaContract = {
  ...F42_WEBSITE_SCHEMA,
  pw1_migration_media: ['media_id', 'tenant_id'],
  pw1_migration_qa_image_checks: ['cache_key', 'media_id', 'result', 'checked_at'],
  media: ['id', 'filename'],
};

export const F42_FIELD_SCHEMA: F42SchemaContract = {
  migration_runs: ['run_id', 'source_store_id', 'state', 'updated_at'],
  migration_import_stores: ['run_id', 'source_store_id', 'state'],
  migration_exceptions: ['run_id', 'state'],
  migration_evidence_generations: ['generation_id', 'child_run_id', 'snapshot_id', 'state', 'contract_version', 'summary', 'digest', 'completed_at', 'verified_at'],
  migration_source_evidence_snapshots: ['snapshot_id', 'source_snapshot_at', 'state', 'provenance_kind', 'summary'],
  migration_source_evidence_rows: ['snapshot_id', 'source_entity', 'source_id', 'record_no', 'fields'],
  migration_field_evidence: ['generation_id', 'source_entity', 'source_field', 'comparison_status', 'source_id', 'source_record_no', 'element_key', 'reason_code', 'source_display', 'target_display', 'source_disposition'],
};

export const F42_SOURCE_COVERAGE_SCHEMA: F42SchemaContract = {
  migration_source_evidence_snapshots: ['snapshot_id', 'source_instance_id', 'source_snapshot_id', 'source_snapshot_at', 'manifest_sha256', 'sidecar_sha256', 'state', 'provenance_kind', 'summary', 'completed_at'],
  migration_source_evidence_rows: ['snapshot_id', 'source_store_id', 'source_entity', 'source_id', 'record_no', 'disposition', 'redacted_field_count', 'fields'],
  migration_import_batches: ['batch_id', 'profile_version', 'binding'],
};

export function missingF42SchemaColumns(columns: readonly F42SchemaColumn[], required: F42SchemaContract): string[] {
  const present = new Set(columns.map(column => `${column.table_name}.${column.column_name}`));
  return Object.entries(required).flatMap(([table, fields]) => fields
    .filter(field => !present.has(`${table}.${field}`))
    .map(field => `${table}.${field}`));
}

export class F42SourceUnavailableError extends Error {
  readonly code = F42_SOURCE_UNAVAILABLE.code;
  constructor() {
    super(F42_SOURCE_UNAVAILABLE.error);
    this.name = 'F42SourceUnavailableError';
  }
}

export class F42CatalogScopeError extends F42SourceUnavailableError {
  constructor(readonly reason: 'AMBIGUOUS_BINDING' | 'INVALID_BINDING' | 'INVALID_CATALOG' | 'UNPROVEN_LEGACY_IDENTITY' | 'SCOPE_CHANGED') {
    super();
    this.name = 'F42CatalogScopeError';
  }
}

/** Drizzle can wrap PostgreSQL errors; tolerate a schema change after preflight.
 * Never expose the underlying query, database names or values in the response.
 */
export function isF42SourceUnavailable(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const record = current as { code?: unknown; cause?: unknown };
    if (record.code === F42_SOURCE_UNAVAILABLE.code || record.code === '42P01' || record.code === '42703') return true;
    current = record.cause;
  }
  return false;
}
