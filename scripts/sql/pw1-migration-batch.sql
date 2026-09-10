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
