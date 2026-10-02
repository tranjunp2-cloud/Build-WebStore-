CREATE TABLE IF NOT EXISTS pw1_migration_qa_reviews (
  id uuid PRIMARY KEY,
  source_store_id text NOT NULL REFERENCES pw1_migration_stores(source_store_id),
  input_hash text NOT NULL,
  attempt_id uuid NOT NULL REFERENCES pw1_migration_attempts(id),
  evidence_version text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('passed','warning','failed')),
  note text NOT NULL,
  checks jsonb NOT NULL,
  reviewer_id integer NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pw1_migration_qa_reviews_store_idx
  ON pw1_migration_qa_reviews(source_store_id, reviewed_at DESC);
