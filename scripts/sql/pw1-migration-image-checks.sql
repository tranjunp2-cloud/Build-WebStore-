CREATE TABLE IF NOT EXISTS pw1_migration_qa_image_checks (
  cache_key text PRIMARY KEY,
  media_id integer NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL
);
