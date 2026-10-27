/**
 * Ledger of the PW1 delta migration (`migrate:pw1:delta`). Separate from the original import ledger
 * (`migration_*`), which the delta only reads. Idempotent: CREATE ... IF NOT EXISTS only.
 */
const PW1_DELTA_MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS pw1_delta_runs (
    run_id varchar PRIMARY KEY,
    as_of timestamptz NOT NULL,
    snapshot_id varchar NOT NULL,
    state varchar NOT NULL,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS pw1_delta_map (
    source_entity varchar NOT NULL,
    source_id varchar NOT NULL,
    store_id varchar NOT NULL,
    target_collection varchar NOT NULL,
    target_id varchar NOT NULL,
    source_checksum varchar NOT NULL,
    target_checksum varchar NOT NULL,
    action varchar NOT NULL,
    projection jsonb,
    run_id varchar NOT NULL REFERENCES pw1_delta_runs(run_id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_entity, source_id)
  )`,
  // Projection written by the delta: compared with the live document before a later update (edit guard).
  `ALTER TABLE pw1_delta_map ADD COLUMN IF NOT EXISTS projection jsonb`,
  // PW1 credentials already carried to PW2 (fingerprint only, never the secret) and the salt written,
  // so a later run neither repeats the sync nor overwrites a password changed in PW2.
  `CREATE TABLE IF NOT EXISTS pw1_delta_credentials (
    source_user_id varchar PRIMARY KEY,
    target_id varchar NOT NULL,
    fingerprint varchar NOT NULL,
    salt varchar NOT NULL,
    run_id varchar NOT NULL REFERENCES pw1_delta_runs(run_id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pw1_delta_map_store_idx ON pw1_delta_map (store_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS pw1_delta_map_target_idx ON pw1_delta_map (target_collection, target_id)`,
]

async function runPw1DeltaMigrationSchema(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of PW1_DELTA_MIGRATION_SQL) await client.query(statement)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { PW1_DELTA_MIGRATION_SQL, runPw1DeltaMigrationSchema }
