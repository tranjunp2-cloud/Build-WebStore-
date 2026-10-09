"use strict";

/** Additive QC evidence schema. Executed after the F42 importer ledger schema. */
const STATEMENTS = [
  `ALTER TABLE migration_runs ADD COLUMN IF NOT EXISTS evidence_verified_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS migration_qc_import_authorizations (
    target_instance_id varchar PRIMARY KEY,
    target_hash varchar NOT NULL,
    database_name varchar NOT NULL,
    allowed_store_ids jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    approved_by varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_qc_import_authorizations_store_array CHECK (jsonb_typeof(allowed_store_ids) = 'array')
  )`,
  `CREATE TABLE IF NOT EXISTS migration_source_evidence_snapshots (
    snapshot_id uuid PRIMARY KEY,
    source_instance_id varchar NOT NULL,
    source_snapshot_id varchar NOT NULL,
    source_snapshot_at timestamptz,
    manifest_sha256 varchar NOT NULL,
    sidecar_sha256 varchar NOT NULL,
    pii_comparable boolean NOT NULL,
    hmac_key_id varchar,
    provenance_kind varchar NOT NULL DEFAULT 'exporter_sidecar' CHECK (provenance_kind IN ('exporter_sidecar','synthetic_fixture')),
    state varchar NOT NULL CHECK (state IN ('BUILDING','COMPLETE')),
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT migration_source_evidence_snapshot_unique UNIQUE (source_instance_id, source_snapshot_id, sidecar_sha256)
  )`,
  `ALTER TABLE migration_source_evidence_snapshots ADD COLUMN IF NOT EXISTS provenance_kind varchar NOT NULL DEFAULT 'exporter_sidecar'`,
  `ALTER TABLE migration_source_evidence_snapshots ADD COLUMN IF NOT EXISTS source_snapshot_at timestamptz`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='migration_source_evidence_provenance_kind_check'
    ) THEN
      ALTER TABLE migration_source_evidence_snapshots
        ADD CONSTRAINT migration_source_evidence_provenance_kind_check
        CHECK (provenance_kind IN ('exporter_sidecar','synthetic_fixture'));
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS migration_source_evidence_rows (
    snapshot_id uuid NOT NULL REFERENCES migration_source_evidence_snapshots(snapshot_id) ON DELETE RESTRICT,
    source_store_id varchar,
    source_entity varchar NOT NULL,
    source_id varchar NOT NULL,
    record_no integer NOT NULL,
    disposition varchar NOT NULL CHECK (disposition IN ('mapped','partial','retained-source','excluded','unresolved')),
    target_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
    redacted_field_count integer NOT NULL DEFAULT 0,
    fields jsonb NOT NULL,
    PRIMARY KEY (snapshot_id, source_entity, source_id, record_no)
  )`,
  `CREATE INDEX IF NOT EXISTS migration_source_evidence_store_idx
    ON migration_source_evidence_rows (snapshot_id, source_store_id, source_entity, source_id)`,
  `CREATE INDEX IF NOT EXISTS migration_source_evidence_page_idx
    ON migration_source_evidence_rows (snapshot_id, source_store_id, source_entity, source_id, record_no)`,
  `CREATE TABLE IF NOT EXISTS migration_target_absence_proofs (
    snapshot_id uuid NOT NULL REFERENCES migration_source_evidence_snapshots(snapshot_id) ON DELETE RESTRICT,
    source_store_id varchar NOT NULL,
    source_entity varchar NOT NULL,
    source_id varchar NOT NULL,
    target_collection varchar NOT NULL,
    proof_kind varchar NOT NULL CHECK (proof_kind IN ('target_read','synthetic_fixture')),
    read_at timestamptz NOT NULL,
    PRIMARY KEY (snapshot_id,source_entity,source_id,target_collection)
  )`,
  `CREATE INDEX IF NOT EXISTS migration_target_absence_store_idx
    ON migration_target_absence_proofs (snapshot_id,source_store_id)`,
  `CREATE TABLE IF NOT EXISTS migration_evidence_generations (
    generation_id uuid PRIMARY KEY,
    child_run_id uuid NOT NULL REFERENCES migration_runs(run_id) ON DELETE RESTRICT,
    snapshot_id uuid NOT NULL REFERENCES migration_source_evidence_snapshots(snapshot_id) ON DELETE RESTRICT,
    contract_version varchar NOT NULL,
    mapping_version varchar NOT NULL,
    target_instance_id varchar NOT NULL,
    state varchar NOT NULL CHECK (state IN ('BUILDING','COMPLETE','PARTIAL','UNAVAILABLE')),
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    digest varchar,
    verified_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT migration_evidence_generation_unique UNIQUE (child_run_id, snapshot_id, contract_version)
  )`,
  `CREATE TABLE IF NOT EXISTS migration_field_evidence (
    generation_id uuid NOT NULL REFERENCES migration_evidence_generations(generation_id) ON DELETE RESTRICT,
    source_entity varchar NOT NULL,
    source_id varchar NOT NULL,
    source_record_no integer NOT NULL,
    source_disposition varchar NOT NULL CHECK (source_disposition IN ('mapped','partial','retained-source','excluded','unresolved')),
    source_field varchar NOT NULL,
    element_key varchar NOT NULL DEFAULT '',
    target_collection varchar,
    target_id varchar,
    target_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
    target_field varchar,
    comparison_status varchar NOT NULL CHECK (comparison_status IN ('match','mismatch','missing','duplicate','unsupported','unverified')),
    reason_code varchar NOT NULL,
    source_display varchar,
    target_display varchar,
    source_normalized varchar,
    target_normalized varchar,
    source_fingerprint varchar,
    target_fingerprint varchar,
    target_projection_checksum varchar,
    transform_code varchar NOT NULL,
    verified_at timestamptz NOT NULL,
    PRIMARY KEY (generation_id, source_entity, source_id, source_record_no, source_field, element_key)
  )`,
  `CREATE INDEX IF NOT EXISTS migration_field_evidence_status_idx
    ON migration_field_evidence (generation_id, comparison_status, source_entity, source_id)`,
  `ALTER TABLE migration_field_evidence ADD COLUMN IF NOT EXISTS target_claims jsonb NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE migration_field_evidence ADD COLUMN IF NOT EXISTS source_disposition varchar NOT NULL DEFAULT 'mapped'`,
  `ALTER TABLE migration_field_evidence ADD COLUMN IF NOT EXISTS target_projection_checksum varchar`,
  `ALTER TABLE migration_field_evidence ADD COLUMN IF NOT EXISTS source_normalized varchar`,
  `ALTER TABLE migration_field_evidence ADD COLUMN IF NOT EXISTS target_normalized varchar`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='migration_field_source_disposition_check') THEN
      ALTER TABLE migration_field_evidence ADD CONSTRAINT migration_field_source_disposition_check
        CHECK (source_disposition IN ('mapped','partial','retained-source','excluded','unresolved'));
    END IF;
  END $$`,
];

const REQUIRED_TABLES = Object.freeze({
  migration_runs: ['run_id','evidence_verified_at'],
  migration_qc_import_authorizations: ['target_instance_id','target_hash','database_name','allowed_store_ids','expires_at','approved_by','created_at'],
  migration_source_evidence_snapshots: ['snapshot_id','source_instance_id','source_snapshot_id','source_snapshot_at','manifest_sha256','sidecar_sha256','pii_comparable','hmac_key_id','provenance_kind','state','summary','created_at','completed_at'],
  migration_source_evidence_rows: ['snapshot_id','source_store_id','source_entity','source_id','record_no','disposition','target_paths','redacted_field_count','fields'],
  migration_target_absence_proofs: ['snapshot_id','source_store_id','source_entity','source_id','target_collection','proof_kind','read_at'],
  migration_evidence_generations: ['generation_id','child_run_id','snapshot_id','contract_version','mapping_version','target_instance_id','state','summary','digest','verified_at','created_at','completed_at'],
  migration_field_evidence: ['generation_id','source_entity','source_id','source_record_no','source_disposition','source_field','element_key','target_collection','target_id','target_claims','target_field','comparison_status','reason_code','source_display','target_display','source_normalized','target_normalized','source_fingerprint','target_fingerprint','target_projection_checksum','transform_code','verified_at'],
});

async function verifyPw1EvidenceSchema(pool) {
  const tables = Object.keys(REQUIRED_TABLES);
  const result = await pool.query(
    `SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[])`, [tables],
  );
  const columns = new Map();
  for (const row of result.rows) {
    const set = columns.get(row.table_name) || new Set();
    set.add(row.column_name);
    columns.set(row.table_name, set);
  }
  const missing = [];
  for (const [table, names] of Object.entries(REQUIRED_TABLES)) {
    for (const name of names) if (!columns.get(table)?.has(name)) missing.push(`${table}.${name}`);
  }
  const indexes = await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])`, [[
    'migration_source_evidence_store_idx','migration_source_evidence_page_idx','migration_target_absence_store_idx','migration_field_evidence_status_idx',
  ]]);
  const foundIndexes = new Set(indexes.rows.map(row => row.indexname));
  for (const name of ['migration_source_evidence_store_idx','migration_source_evidence_page_idx','migration_target_absence_store_idx','migration_field_evidence_status_idx']) {
    if (!foundIndexes.has(name)) missing.push(`index:${name}`);
  }
  if (missing.length) throw new Error(`PW1_EVIDENCE_SCHEMA_INVALID:${missing.join(',')}`);
}

async function runPw1EvidenceSchema(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of STATEMENTS) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await verifyPw1EvidenceSchema(pool);
}

module.exports = { STATEMENTS, REQUIRED_TABLES, runPw1EvidenceSchema, verifyPw1EvidenceSchema };
