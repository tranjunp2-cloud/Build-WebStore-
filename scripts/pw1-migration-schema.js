"use strict";

const PW1_MIGRATION_SCHEMA_ERROR = "PW1_MIGRATION_SCHEMA_FAILED";

const PW1_MIGRATION_SCHEMA_REQUIREMENTS = Object.freeze({
  columns: Object.freeze({
    migration_target_guard: Object.freeze([
      "singleton",
      "target_instance_id",
      "s3_endpoint_origin",
      "s3_bucket",
      "s3_public_endpoint_origin",
      "created_at",
    ]),
    migration_runs: Object.freeze([
      "run_id",
      "source_system",
      "source_instance_id",
      "source_database",
      "source_store_id",
      "source_snapshot_id",
      "source_snapshot_checksum",
      "source_schema_fingerprint",
      "mapping_version",
      "target_environment",
      "target_instance_id",
      "credential_fingerprint_set_checksum",
      "pw1_app_key_fingerprint",
      "state",
      "lease_owner",
      "lease_expires_at",
      "fencing_token",
      "confirmation_nonce_hash",
      "confirmation_consumed_at",
      "summary",
      "operator_reference",
      "created_at",
      "updated_at",
    ]),
    migration_entity_map: Object.freeze([
      "id",
      "run_id",
      "source_system",
      "source_instance_id",
      "source_entity",
      "source_id",
      "source_email_ciphertext",
      "source_email_iv",
      "source_email_auth_tag",
      "source_email_key_version",
      "target_collection",
      "target_id",
      "action",
      "state",
      "claim_active",
      "source_checksum",
      "transformed_checksum",
      "target_checksum",
      "target_updated_at",
      "detail",
      "created_at",
      "updated_at",
    ]),
    migration_exceptions: Object.freeze([
      "id",
      "run_id",
      "source_entity",
      "source_id",
      "masked_identity",
      "severity",
      "error_code",
      "detail",
      "state",
      "resolution",
      "created_at",
      "updated_at",
    ]),
    migration_storage_objects: Object.freeze([
      "id",
      "run_id",
      "tenant_id",
      "media_id",
      "bucket",
      "object_key",
      "sha256",
      "byte_size",
      "state",
      "created_by_run",
      "object_claim_active",
      "provider_version_id",
      "last_error_code",
      "created_at",
      "updated_at",
    ]),
    media: Object.freeze(["tenant_id", "prefix", "sha256"]),
    users: Object.freeze(["email"]),
  }),
  columnTypes: Object.freeze({ "users.email": "citext" }),
  indexes: Object.freeze([
    "migration_runs_active_source_store_uniq",
    "migration_runs_lease_idx",
    "migration_entity_map_active_source_uniq",
    "migration_entity_map_target_idx",
    "migration_exceptions_run_idx",
    "migration_storage_objects_active_key_uniq",
    "migration_storage_objects_run_state_idx",
    "media_tenant_id_idx",
    "media_sha256_idx",
    "media_tenant_storage_identity_idx",
    "users_email_lookup_key_unique",
  ]),
  constraints: Object.freeze([
    "migration_target_guard_pkey",
    "migration_target_guard_singleton_check",
    "migration_runs_pkey",
    "migration_runs_state_check",
    "migration_entity_map_pkey",
    "migration_entity_map_run_id_fkey",
    "migration_entity_map_action_check",
    "migration_entity_map_state_check",
    "migration_entity_map_run_source_uniq",
    "migration_exceptions_pkey",
    "migration_exceptions_run_id_fkey",
    "migration_exceptions_severity_check",
    "migration_exceptions_state_check",
    "migration_storage_objects_pkey",
    "migration_storage_objects_run_id_fkey",
    "migration_storage_objects_state_check",
    "migration_storage_objects_planned_unowned_check",
    "migration_storage_objects_run_key_uniq",
    "media_tenant_id_tenants_id_fk",
  ]),
  indexDefinitions: Object.freeze({
    migration_runs_active_source_store_uniq: Object.freeze({
      table: "migration_runs",
      definition: "CREATE UNIQUE INDEX migration_runs_active_source_store_uniq ON public.migration_runs USING btree (source_system, source_instance_id, source_store_id, target_instance_id) WHERE ((state)::text = ANY ((ARRAY['APPLYING'::character varying, 'PAUSED'::character varying, 'VERIFYING'::character varying, 'ROLLBACK_PENDING'::character varying])::text[]))",
    }),
    migration_runs_lease_idx: Object.freeze({
      table: "migration_runs",
      definition: "CREATE INDEX migration_runs_lease_idx ON public.migration_runs USING btree (lease_expires_at) WHERE (lease_owner IS NOT NULL)",
    }),
    migration_entity_map_active_source_uniq: Object.freeze({
      table: "migration_entity_map",
      definition: "CREATE UNIQUE INDEX migration_entity_map_active_source_uniq ON public.migration_entity_map USING btree (source_system, source_instance_id, source_entity, source_id) WHERE (claim_active = true)",
    }),
    migration_entity_map_target_idx: Object.freeze({
      table: "migration_entity_map",
      definition: "CREATE INDEX migration_entity_map_target_idx ON public.migration_entity_map USING btree (target_collection, target_id)",
    }),
    migration_exceptions_run_idx: Object.freeze({
      table: "migration_exceptions",
      definition: "CREATE INDEX migration_exceptions_run_idx ON public.migration_exceptions USING btree (run_id, state)",
    }),
    migration_storage_objects_active_key_uniq: Object.freeze({
      table: "migration_storage_objects",
      definition: "CREATE UNIQUE INDEX migration_storage_objects_active_key_uniq ON public.migration_storage_objects USING btree (bucket, object_key) WHERE (object_claim_active = true)",
    }),
    migration_storage_objects_run_state_idx: Object.freeze({
      table: "migration_storage_objects",
      definition: "CREATE INDEX migration_storage_objects_run_state_idx ON public.migration_storage_objects USING btree (run_id, state)",
    }),
    media_tenant_id_idx: Object.freeze({
      table: "media",
      definition: "CREATE INDEX media_tenant_id_idx ON public.media USING btree (tenant_id)",
    }),
    media_sha256_idx: Object.freeze({
      table: "media",
      definition: "CREATE INDEX media_sha256_idx ON public.media USING btree (sha256)",
    }),
    media_tenant_storage_identity_idx: Object.freeze({
      table: "media",
      definition: "CREATE INDEX media_tenant_storage_identity_idx ON public.media USING btree (tenant_id, prefix, filename)",
    }),
    users_email_lookup_key_unique: Object.freeze({
      table: "users",
      definition: "CREATE UNIQUE INDEX users_email_lookup_key_unique ON public.users USING btree (lower(btrim((email)::text)))",
    }),
  }),
  constraintDefinitions: Object.freeze({
    migration_target_guard_pkey: Object.freeze({ table: "migration_target_guard", type: "p", definition: "PRIMARY KEY (singleton)" }),
    migration_target_guard_singleton_check: Object.freeze({ table: "migration_target_guard", type: "c", definition: "CHECK (singleton = true)" }),
    migration_runs_pkey: Object.freeze({ table: "migration_runs", type: "p", definition: "PRIMARY KEY (run_id)" }),
    migration_runs_state_check: Object.freeze({ table: "migration_runs", type: "c", definition: "CHECK (state::text = ANY (ARRAY['PREFLIGHT_PASSED'::character varying, 'APPLYING'::character varying, 'PAUSED'::character varying, 'VERIFYING'::character varying, 'VERIFIED'::character varying, 'ROLLBACK_PENDING'::character varying, 'ROLLED_BACK'::character varying, 'MANUAL_INTERVENTION'::character varying, 'FAILED'::character varying]::text[]))" }),
    migration_entity_map_pkey: Object.freeze({ table: "migration_entity_map", type: "p", definition: "PRIMARY KEY (id)" }),
    migration_entity_map_run_id_fkey: Object.freeze({ table: "migration_entity_map", type: "f", definition: "FOREIGN KEY (run_id) REFERENCES migration_runs(run_id) ON DELETE RESTRICT" }),
    migration_entity_map_action_check: Object.freeze({ table: "migration_entity_map", type: "c", definition: "CHECK (action::text = ANY (ARRAY['CREATE'::character varying, 'SKIP'::character varying, 'EXCLUDE'::character varying, 'DEFER'::character varying, 'BLOCK'::character varying]::text[]))" }),
    migration_entity_map_state_check: Object.freeze({ table: "migration_entity_map", type: "c", definition: "CHECK (state::text = ANY (ARRAY['PENDING'::character varying, 'CREATED'::character varying, 'SKIPPED'::character varying, 'EXCLUDED'::character varying, 'VERIFIED'::character varying, 'FAILED'::character varying, 'ROLLED_BACK'::character varying]::text[]))" }),
    migration_entity_map_run_source_uniq: Object.freeze({ table: "migration_entity_map", type: "u", definition: "UNIQUE (run_id, source_system, source_instance_id, source_entity, source_id)" }),
    migration_exceptions_pkey: Object.freeze({ table: "migration_exceptions", type: "p", definition: "PRIMARY KEY (id)" }),
    migration_exceptions_run_id_fkey: Object.freeze({ table: "migration_exceptions", type: "f", definition: "FOREIGN KEY (run_id) REFERENCES migration_runs(run_id) ON DELETE RESTRICT" }),
    migration_exceptions_severity_check: Object.freeze({ table: "migration_exceptions", type: "c", definition: "CHECK (severity::text = ANY (ARRAY['WARNING'::character varying, 'BLOCKER'::character varying]::text[]))" }),
    migration_exceptions_state_check: Object.freeze({ table: "migration_exceptions", type: "c", definition: "CHECK (state::text = ANY (ARRAY['OPEN'::character varying, 'RESOLVED'::character varying, 'IGNORED'::character varying]::text[]))" }),
    migration_storage_objects_pkey: Object.freeze({ table: "migration_storage_objects", type: "p", definition: "PRIMARY KEY (id)" }),
    migration_storage_objects_run_id_fkey: Object.freeze({ table: "migration_storage_objects", type: "f", definition: "FOREIGN KEY (run_id) REFERENCES migration_runs(run_id) ON DELETE RESTRICT" }),
    migration_storage_objects_state_check: Object.freeze({ table: "migration_storage_objects", type: "c", definition: "CHECK (state::text = ANY (ARRAY['PLANNED'::character varying, 'UPLOADED'::character varying, 'LINKED'::character varying, 'DELETE_PENDING'::character varying, 'DELETED'::character varying, 'CONFLICT'::character varying]::text[]))" }),
    migration_storage_objects_run_key_uniq: Object.freeze({ table: "migration_storage_objects", type: "u", definition: "UNIQUE (run_id, bucket, object_key)" }),
    media_tenant_id_tenants_id_fk: Object.freeze({ table: "media", type: "f", definition: "FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL" }),
  }),
});

function normalizeSqlDefinition(value) {
  const normalized = value
    // PostgreSQL versions deparse varchar CHECK arrays with either array-level
    // text casts or per-element text casts. Normalize only literal text arrays.
    .replace(/\('([^']*)'::character varying\)::text/g, "'$1'")
    .replace(/'([^']*)'::character varying(?:::text)?/g, "'$1'")
    .replace(/\(ARRAY\[((?:'[^']*'[, ]*)+)\]\)::text\[\]/g, 'ARRAY[$1]')
    .replace(/\s+/g, " ").trim().toLowerCase();
  const enumCheck = normalized.replace(/[()]/g, '').replace(/\]::text\[\]/g, ']');
  if (/^check [a-z_]+::text = any array\[(?:'[^']*'[, ]*)+\]$/.test(enumCheck)) return enumCheck;
  return normalized;
}

function schemaError(message, cause) {
  const error = new Error(`[F42] ${message}`, cause ? { cause } : undefined);
  error.code = PW1_MIGRATION_SCHEMA_ERROR;
  return error;
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS migration_target_guard (
    singleton boolean PRIMARY KEY DEFAULT true,
    target_instance_id varchar NOT NULL,
    s3_endpoint_origin varchar NOT NULL,
    s3_bucket varchar NOT NULL,
    s3_public_endpoint_origin varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_target_guard_singleton_check CHECK (singleton = true)
  )`,
  `CREATE EXTENSION IF NOT EXISTS citext`,
  `ALTER TABLE users ALTER COLUMN email TYPE citext USING email::citext`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lookup_key_unique
    ON users (lower(btrim(email::text)))`,
  `CREATE TABLE IF NOT EXISTS migration_runs (
    run_id uuid PRIMARY KEY,
    source_system varchar NOT NULL DEFAULT 'pw1', source_instance_id varchar NOT NULL,
    source_database varchar NOT NULL, source_store_id varchar NOT NULL,
    source_snapshot_id varchar NOT NULL, source_snapshot_checksum varchar NOT NULL,
    source_schema_fingerprint varchar NOT NULL, mapping_version varchar NOT NULL,
    target_environment varchar NOT NULL, target_instance_id varchar NOT NULL,
    credential_fingerprint_set_checksum varchar, pw1_app_key_fingerprint varchar NOT NULL,
    state varchar NOT NULL, lease_owner varchar, lease_expires_at timestamptz,
    fencing_token bigint NOT NULL DEFAULT 0, confirmation_nonce_hash varchar,
    confirmation_consumed_at timestamptz, summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    operator_reference varchar, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_runs_state_check CHECK (state IN
      ('PREFLIGHT_PASSED','APPLYING','PAUSED','VERIFYING','VERIFIED','ROLLBACK_PENDING','ROLLED_BACK','MANUAL_INTERVENTION','FAILED'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS migration_runs_active_source_store_uniq
    ON migration_runs (source_system, source_instance_id, source_store_id, target_instance_id)
    WHERE state IN ('APPLYING','PAUSED','VERIFYING','ROLLBACK_PENDING')`,
  `CREATE INDEX IF NOT EXISTS migration_runs_lease_idx
    ON migration_runs (lease_expires_at) WHERE lease_owner IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS migration_entity_map (
    id bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES migration_runs(run_id) ON DELETE RESTRICT,
    source_system varchar NOT NULL DEFAULT 'pw1', source_instance_id varchar NOT NULL,
    source_entity varchar NOT NULL, source_id varchar NOT NULL,
    source_email_ciphertext text, source_email_iv varchar, source_email_auth_tag varchar,
    source_email_key_version integer, target_collection varchar, target_id varchar,
    action varchar NOT NULL, state varchar NOT NULL, claim_active boolean NOT NULL DEFAULT true,
    source_checksum varchar NOT NULL, transformed_checksum varchar, target_checksum varchar, target_updated_at timestamptz,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_entity_map_action_check CHECK (action IN ('CREATE','SKIP','EXCLUDE','DEFER','BLOCK')),
    CONSTRAINT migration_entity_map_state_check CHECK (state IN ('PENDING','CREATED','SKIPPED','EXCLUDED','VERIFIED','FAILED','ROLLED_BACK')),
    CONSTRAINT migration_entity_map_run_source_uniq UNIQUE
      (run_id, source_system, source_instance_id, source_entity, source_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS migration_entity_map_active_source_uniq
    ON migration_entity_map (source_system, source_instance_id, source_entity, source_id)
    WHERE claim_active = true`,
  `CREATE INDEX IF NOT EXISTS migration_entity_map_target_idx
    ON migration_entity_map (target_collection, target_id)`,
  `CREATE TABLE IF NOT EXISTS migration_exceptions (
    id bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES migration_runs(run_id) ON DELETE RESTRICT,
    source_entity varchar NOT NULL, source_id varchar, masked_identity varchar,
    severity varchar NOT NULL, error_code varchar NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    state varchar NOT NULL DEFAULT 'OPEN', resolution varchar,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_exceptions_severity_check CHECK (severity IN ('WARNING','BLOCKER')),
    CONSTRAINT migration_exceptions_state_check CHECK (state IN ('OPEN','RESOLVED','IGNORED'))
  )`,
  `CREATE INDEX IF NOT EXISTS migration_exceptions_run_idx ON migration_exceptions (run_id, state)`,
  `CREATE TABLE IF NOT EXISTS migration_storage_objects (
    id bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES migration_runs(run_id) ON DELETE RESTRICT,
    tenant_id integer NOT NULL, media_id integer, bucket varchar NOT NULL, object_key text NOT NULL,
    sha256 varchar NOT NULL, byte_size bigint NOT NULL, state varchar NOT NULL,
    created_by_run boolean NOT NULL DEFAULT false, object_claim_active boolean NOT NULL DEFAULT true,
    provider_version_id varchar, last_error_code varchar,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT migration_storage_objects_state_check CHECK
      (state IN ('PLANNED','UPLOADED','LINKED','DELETE_PENDING','DELETED','CONFLICT')),
    CONSTRAINT migration_storage_objects_planned_unowned_check CHECK
      (state <> 'PLANNED' OR created_by_run = false),
    CONSTRAINT migration_storage_objects_run_key_uniq UNIQUE (run_id, bucket, object_key)
  )`,
  `ALTER TABLE migration_storage_objects ALTER COLUMN created_by_run SET DEFAULT false`,
  `DO $$ BEGIN ALTER TABLE migration_storage_objects
    ADD CONSTRAINT migration_storage_objects_planned_unowned_check
    CHECK (state <> 'PLANNED' OR created_by_run = false);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS migration_storage_objects_active_key_uniq
    ON migration_storage_objects (bucket, object_key) WHERE object_claim_active = true`,
  `CREATE INDEX IF NOT EXISTS migration_storage_objects_run_state_idx
    ON migration_storage_objects (run_id, state)`,
  `ALTER TABLE migration_entity_map ADD COLUMN IF NOT EXISTS transformed_checksum varchar`,
  `ALTER TABLE media ADD COLUMN IF NOT EXISTS tenant_id integer`,
  `ALTER TABLE media ADD COLUMN IF NOT EXISTS prefix varchar`,
  `ALTER TABLE media ADD COLUMN IF NOT EXISTS sha256 varchar`,
  `DO $$ BEGIN ALTER TABLE media ADD CONSTRAINT media_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS media_tenant_id_idx ON media (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS media_sha256_idx ON media (sha256)`,
  `CREATE INDEX IF NOT EXISTS media_tenant_storage_identity_idx ON media (tenant_id, prefix, filename)`,
];

function configuredTargetGuard(env = process.env) {
  const targetInstanceId = env.PW2_MIGRATION_TARGET_ID?.trim();
  const s3Endpoint = env.S3_ENDPOINT?.trim();
  const s3Bucket = env.S3_BUCKET?.trim();
  const s3PublicEndpoint = env.NEXT_PUBLIC_S3_ENDPOINT?.trim() || s3Endpoint;
  if (!targetInstanceId || !s3Endpoint || !s3Bucket || !s3PublicEndpoint) {
    return null;
  }
  try {
    return {
      targetInstanceId,
      s3EndpointOrigin: new URL(s3Endpoint).origin.toLowerCase(),
      s3Bucket,
      s3PublicEndpointOrigin: new URL(s3PublicEndpoint).origin.toLowerCase(),
    };
  } catch (cause) {
    throw schemaError(
      "target guard environment contains an invalid URL",
      cause,
    );
  }
}

async function initializeTargetGuard(client) {
  const configured = configuredTargetGuard();
  if (!configured) return;
  await client.query(
    `INSERT INTO migration_target_guard (
       singleton, target_instance_id, s3_endpoint_origin, s3_bucket,
       s3_public_endpoint_origin
     ) VALUES (true, $1, $2, $3, $4)
     ON CONFLICT (singleton) DO NOTHING`,
    [
      configured.targetInstanceId,
      configured.s3EndpointOrigin,
      configured.s3Bucket,
      configured.s3PublicEndpointOrigin,
    ],
  );
  const result = await client.query(
    `SELECT target_instance_id, s3_endpoint_origin, s3_bucket,
            s3_public_endpoint_origin
       FROM migration_target_guard WHERE singleton = true`,
  );
  const actual = result.rows[0];
  if (
    !actual ||
    actual.target_instance_id !== configured.targetInstanceId ||
    actual.s3_endpoint_origin !== configured.s3EndpointOrigin ||
    actual.s3_bucket !== configured.s3Bucket ||
    actual.s3_public_endpoint_origin !== configured.s3PublicEndpointOrigin
  ) {
    throw schemaError(
      "configured migration target does not match the immutable database guard",
    );
  }
}

async function runPw1MigrationSchema(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of STATEMENTS) await client.query(statement);
    await initializeTargetGuard(client);
    await client.query("COMMIT");
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => {});
    throw schemaError("strict migration schema setup failed", cause);
  } finally {
    client.release();
  }
  await verifyPw1MigrationSchema(pool);
}

async function verifyPw1MigrationSchema(pool) {
  const requiredColumns = PW1_MIGRATION_SCHEMA_REQUIREMENTS.columns;
  const rows = await pool.query(
    `SELECT table_name, column_name, udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredColumns)],
  );
  const actual = new Map();
  const actualTypes = new Map();
  for (const row of rows.rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name).add(row.column_name);
    actualTypes.set(`${row.table_name}.${row.column_name}`, row.udt_name);
  }
  const missing = [];
  for (const [table, columns] of Object.entries(requiredColumns)) {
    for (const column of columns)
      if (!actual.get(table)?.has(column)) missing.push(`${table}.${column}`);
  }
  for (const [column, udtName] of Object.entries(
    PW1_MIGRATION_SCHEMA_REQUIREMENTS.columnTypes,
  )) {
    if (actualTypes.get(column) !== udtName)
      missing.push(`type:${column}=${udtName}`);
  }
  const requiredIndexes = PW1_MIGRATION_SCHEMA_REQUIREMENTS.indexes;
  const indexRows = await pool.query(
    `SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [requiredIndexes],
  );
  const indexes = new Set(indexRows.rows.map((row) => row.indexname));
  for (const index of requiredIndexes)
    if (!indexes.has(index)) missing.push(`index:${index}`);
  for (const [name, requirement] of Object.entries(PW1_MIGRATION_SCHEMA_REQUIREMENTS.indexDefinitions)) {
    const actualIndex = indexRows.rows.find((row) => row.indexname === name);
    if (
      !actualIndex ||
      actualIndex.tablename !== requirement.table ||
      normalizeSqlDefinition(actualIndex.indexdef) !== normalizeSqlDefinition(requirement.definition)
    ) {
      missing.push(`index-definition:${name}`);
    }
  }
  const requiredConstraints = PW1_MIGRATION_SCHEMA_REQUIREMENTS.constraints;
  const constraintRows = await pool.query(
    `SELECT constraint_row.conname, table_row.relname AS table_name,
            constraint_row.contype, pg_get_constraintdef(constraint_row.oid, true) AS definition
       FROM pg_constraint constraint_row
       JOIN pg_namespace namespace_row ON namespace_row.oid = constraint_row.connamespace
       JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      WHERE namespace_row.nspname = 'public' AND constraint_row.conname = ANY($1::text[])`,
    [requiredConstraints],
  );
  const constraints = new Set(constraintRows.rows.map((row) => row.conname));
  for (const constraint of requiredConstraints)
    if (!constraints.has(constraint)) missing.push(`constraint:${constraint}`);
  for (const [name, requirement] of Object.entries(PW1_MIGRATION_SCHEMA_REQUIREMENTS.constraintDefinitions)) {
    const actualConstraint = constraintRows.rows.find((row) => row.conname === name);
    if (
      !actualConstraint ||
      actualConstraint.table_name !== requirement.table ||
      actualConstraint.contype !== requirement.type ||
      normalizeSqlDefinition(actualConstraint.definition) !== normalizeSqlDefinition(requirement.definition)
    ) {
      missing.push(`constraint-definition:${name}`);
    }
  }
  if (missing.length)
    throw schemaError(`schema verification failed: ${missing.join(", ")}`);
  console.log("[db-setup] ✅ F42 strict migration schema verified");
}

module.exports = {
  PW1_MIGRATION_SCHEMA_ERROR,
  PW1_MIGRATION_SCHEMA_REQUIREMENTS,
  runPw1MigrationSchema,
  verifyPw1MigrationSchema,
};
