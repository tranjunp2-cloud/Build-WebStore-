/** Internal ledger only. Business schema changes remain in db-setup. */
const PW1_JSON_MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS migration_import_batches (
    batch_id uuid PRIMARY KEY, profile_version varchar NOT NULL DEFAULT 'pw1-json-v1',
    binding jsonb NOT NULL, selected_store_ids jsonb NOT NULL,
    state varchar NOT NULL DEFAULT 'PLANNED' CHECK (state IN ('PLANNED','APPLYING','PAUSED','VERIFIED')),
    lease_owner uuid, lease_expires_at timestamptz, fencing_token bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(selected_store_ids) = 'array' AND jsonb_array_length(selected_store_ids) > 0)
  )`,
  `CREATE TABLE IF NOT EXISTS migration_import_stores (
    batch_id uuid NOT NULL REFERENCES migration_import_batches(batch_id) ON DELETE RESTRICT,
    source_store_id varchar NOT NULL, run_id uuid NOT NULL UNIQUE REFERENCES migration_runs(run_id),
    state varchar NOT NULL DEFAULT 'PLANNED' CHECK (state IN ('PLANNED','APPLYING','VERIFIED')),
    PRIMARY KEY (batch_id, source_store_id)
  )`,
  `ALTER TABLE migration_runs ADD COLUMN IF NOT EXISTS importer_profile varchar NOT NULL DEFAULT 'legacy'`,
  `ALTER TABLE migration_runs ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES migration_import_batches(batch_id)`,
  `ALTER TABLE migration_runs ALTER COLUMN pw1_app_key_fingerprint DROP NOT NULL`,
  `ALTER TABLE migration_runs ALTER COLUMN source_schema_fingerprint DROP NOT NULL`,
  `ALTER TABLE migration_runs ALTER COLUMN source_database DROP NOT NULL`,
  `DO $$ DECLARE existing text; old_expression text; v2_expression text; new_expression text; BEGIN
    old_expression := 'CHECKimporter_profile=''legacy''ANDpw1_app_key_fingerprintISNOTNULLANDsource_schema_fingerprintISNOTNULLANDsource_databaseISNOTNULLORimporter_profile=''pw1-json-v1''ANDbatch_idISNOTNULL';
    v2_expression := old_expression || 'ORimporter_profile=''pw1-json-v2''ANDbatch_idISNOTNULL';
    new_expression := v2_expression || 'ORimporter_profile=''pw1-json-v3''ANDbatch_idISNOTNULL';
    SELECT regexp_replace(replace(pg_get_constraintdef(oid),'::text',''),'[()[:space:]]','','g') INTO existing
      FROM pg_constraint WHERE conname='migration_runs_profile_metadata_check' AND conrelid='migration_runs'::regclass AND contype='c' AND convalidated;
    IF existing IS NOT NULL AND existing NOT IN (old_expression,v2_expression,new_expression) THEN
      RAISE EXCEPTION 'JSON_IMPORT_PROFILE_CONSTRAINT_UNREVIEWED';
    END IF;
    IF existing IN (old_expression,v2_expression) THEN
      ALTER TABLE migration_runs DROP CONSTRAINT migration_runs_profile_metadata_check;
      existing := NULL;
    END IF;
    IF existing IS NULL THEN
      ALTER TABLE migration_runs ADD CONSTRAINT migration_runs_profile_metadata_check CHECK
      ((importer_profile='legacy' AND pw1_app_key_fingerprint IS NOT NULL AND source_schema_fingerprint IS NOT NULL AND source_database IS NOT NULL)
        OR (importer_profile='pw1-json-v1' AND batch_id IS NOT NULL)
        OR (importer_profile='pw1-json-v2' AND batch_id IS NOT NULL)
        OR (importer_profile='pw1-json-v3' AND batch_id IS NOT NULL));
    END IF;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS migration_runs_json_batch_store_uniq ON migration_runs(batch_id,source_store_id) WHERE batch_id IS NOT NULL`,
  `ALTER TABLE migration_entity_map ADD COLUMN IF NOT EXISTS depends_on_entity_map_id bigint REFERENCES migration_entity_map(id) ON DELETE RESTRICT`,
  `CREATE OR REPLACE FUNCTION guard_pw1_json_legacy_rollback() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM migration_import_batches) THEN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'JSON_IMPORT_LEGACY_ROLLBACK_BLOCKED'; END IF;
        IF OLD.claim_active AND (NOT NEW.claim_active OR NEW.state='ROLLED_BACK') THEN
          RAISE EXCEPTION 'JSON_IMPORT_LEGACY_ROLLBACK_BLOCKED';
        END IF;
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='pw1_json_legacy_rollback_guard' AND tgrelid='migration_entity_map'::regclass) THEN
    CREATE TRIGGER pw1_json_legacy_rollback_guard BEFORE UPDATE OR DELETE ON migration_entity_map
    FOR EACH ROW EXECUTE FUNCTION guard_pw1_json_legacy_rollback(); END IF; END $$`,
]

async function runPw1JsonMigrationSchema(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of PW1_JSON_MIGRATION_SQL) await client.query(statement)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { PW1_JSON_MIGRATION_SQL, runPw1JsonMigrationSchema }
