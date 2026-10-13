-- Durable QA reports shared by the migration runner and Studio F40.
CREATE TABLE IF NOT EXISTS pw1_migration_qa_audits (
  source_store_id text NOT NULL REFERENCES pw1_migration_stores(source_store_id),
  input_hash text NOT NULL,
  attempt_id uuid NOT NULL REFERENCES pw1_migration_attempts(id),
  checked_at timestamptz NOT NULL,
  base_url text NOT NULL,
  report jsonb NOT NULL,
  PRIMARY KEY (source_store_id, input_hash, attempt_id)
);
CREATE INDEX IF NOT EXISTS pw1_migration_commits_store_hash_time_idx
  ON pw1_migration_commits(source_store_id, input_hash, committed_at DESC);
CREATE INDEX IF NOT EXISTS pw1_migration_attempts_batch_store_idx
  ON pw1_migration_attempts(batch_id, source_store_id);

