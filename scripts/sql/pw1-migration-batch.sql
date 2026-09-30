CREATE TABLE IF NOT EXISTS pw1_migration_accounts (
  source_user_id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  user_id integer NOT NULL UNIQUE REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pw1_migration_stores (
  source_store_id text PRIMARY KEY,
  source_user_id text NOT NULL REFERENCES pw1_migration_accounts(source_user_id),
  tenant_id integer NOT NULL UNIQUE REFERENCES tenants(id),
  site_id integer NOT NULL UNIQUE REFERENCES sites(id),
  input_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pw1_migration_attempts (
  id uuid PRIMARY KEY,
  source_store_id text NOT NULL REFERENCES pw1_migration_stores(source_store_id),
  input_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS pw1_migration_attempts_store_idx ON pw1_migration_attempts(source_store_id, started_at);
CREATE TABLE IF NOT EXISTS pw1_migration_batches (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES pw1_migration_batches(id);
ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'prepare';
ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false;
ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pw1_migration_attempts ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;
ALTER TABLE pw1_migration_stores ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pw1_migration_attempts_batch_idx ON pw1_migration_attempts(batch_id);
CREATE TABLE IF NOT EXISTS pw1_migration_commits (
  attempt_id uuid PRIMARY KEY REFERENCES pw1_migration_attempts(id),
  source_store_id text NOT NULL REFERENCES pw1_migration_stores(source_store_id),
  input_hash text NOT NULL,
  summary jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pw1_migration_media (
  tenant_id integer NOT NULL REFERENCES tenants(id),
  source_hash text NOT NULL,
  media_id integer NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, source_hash)
);

ALTER TABLE pw1_migration_batches ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE pw1_migration_media ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();
