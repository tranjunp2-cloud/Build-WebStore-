import type { Pool } from "pg";

/**
 * Idempotent schema for the ai_platform database. Append-only list: never
 * edit a shipped statement, add a new one. Every table is organization-scoped
 * and every repository query filters by organization_id (RLS lands with the
 * Phase 3 policy work).
 */
export const MIGRATIONS: readonly { name: string; sql: string }[] = [
	{
		name: "001_ai_runs",
		sql: `CREATE TABLE IF NOT EXISTS ai_runs (
			id text PRIMARY KEY,
			organization_id text NOT NULL,
			tenant_id text,
			user_id text NOT NULL,
			surface text NOT NULL DEFAULT 'merchant',
			domain text NOT NULL,
			status text NOT NULL,
			run jsonb NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_runs_org_created_idx ON ai_runs (organization_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS ai_runs_user_created_idx ON ai_runs (user_id, created_at DESC);`,
	},
	{
		name: "002_ai_change_sets",
		sql: `CREATE TABLE IF NOT EXISTS ai_change_sets (
			id text PRIMARY KEY,
			run_id text NOT NULL REFERENCES ai_runs (id),
			organization_id text NOT NULL,
			status text NOT NULL,
			action_kind text,
			change_set jsonb NOT NULL,
			claimed_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_change_sets_org_status_idx ON ai_change_sets (organization_id, status, created_at DESC);`,
	},
	{
		name: "003_ai_usage_events",
		sql: `CREATE TABLE IF NOT EXISTS ai_usage_events (
			id bigserial PRIMARY KEY,
			organization_id text NOT NULL,
			user_id text,
			surface text NOT NULL,
			task text NOT NULL,
			run_id text,
			provider text,
			model text,
			input_tokens integer,
			output_tokens integer,
			cached_input_tokens integer,
			cost_usd_micros bigint,
			latency_ms integer,
			outcome text NOT NULL,
			error_code text,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_usage_events_org_created_idx ON ai_usage_events (organization_id, created_at DESC);`,
	},
	{
		// Private per-user copilot threads; retention counts from updated_at (last activity).
		name: "004_ai_threads",
		sql: `CREATE TABLE IF NOT EXISTS ai_threads (
			id text PRIMARY KEY,
			organization_id text NOT NULL,
			tenant_id text,
			user_id text NOT NULL,
			title text NOT NULL,
			preview text,
			run_count integer NOT NULL DEFAULT 0,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_threads_org_user_updated_idx ON ai_threads (organization_id, user_id, updated_at DESC);
		CREATE INDEX IF NOT EXISTS ai_threads_updated_idx ON ai_threads (updated_at);
		ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS thread_id text;
		ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS user_message text;
		CREATE INDEX IF NOT EXISTS ai_runs_thread_created_idx ON ai_runs (thread_id, created_at);
		CREATE INDEX IF NOT EXISTS ai_change_sets_run_idx ON ai_change_sets (run_id);`,
	},
	{
		// Paused runs (ask_user) keep their model messages + question flow; files the
		// merchant attached (bytes stay here, private to the uploader); decision-model
		// answers cached per question fingerprint (L2, shared across processes).
		name: "005_ai_agent_ask_attachments_decisions",
		sql: `ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS state jsonb;
		CREATE TABLE IF NOT EXISTS ai_attachments (
			id text PRIMARY KEY,
			organization_id text NOT NULL,
			user_id text NOT NULL,
			thread_id text,
			kind text NOT NULL,
			origin text NOT NULL,
			ref text,
			name text NOT NULL,
			mime text NOT NULL,
			size integer NOT NULL,
			content bytea NOT NULL,
			text_content text,
			credit text,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_attachments_owner_idx ON ai_attachments (organization_id, user_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS ai_attachments_thread_idx ON ai_attachments (thread_id);
		CREATE INDEX IF NOT EXISTS ai_attachments_created_idx ON ai_attachments (created_at);
		CREATE TABLE IF NOT EXISTS ai_decisions (
			organization_id text NOT NULL,
			fingerprint text NOT NULL,
			stage text NOT NULL,
			provider text NOT NULL,
			model text NOT NULL,
			choice text,
			confidence real NOT NULL,
			probabilities jsonb NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (organization_id, fingerprint)
		);
		CREATE INDEX IF NOT EXISTS ai_decisions_created_idx ON ai_decisions (created_at);`,
	},
	{
		// auto titles follow the chat (draft names); a merchant's own rename is never overwritten
		name: "006_ai_threads_title_source",
		sql: `ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS title_source text NOT NULL DEFAULT 'auto';`,
	},
	{
		// the record a chat was started on (product, blog post): returning to it offers the chat
		name: "007_ai_threads_entity",
		sql: `ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS entity_kind text;
		ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS entity_id text;
		ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS entity_label text;
		CREATE INDEX IF NOT EXISTS ai_threads_entity_idx ON ai_threads (organization_id, user_id, entity_kind, entity_id, updated_at DESC) WHERE entity_id IS NOT NULL;`,
	},
	{
		// a chat started from a to-do item is that task's chat (title_source 'task': never retitled)
		name: "008_ai_threads_task_key",
		sql: `ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS task_key text;
		CREATE INDEX IF NOT EXISTS ai_threads_task_idx ON ai_threads (organization_id, user_id, task_key) WHERE task_key IS NOT NULL;`,
	},
	{
		// the merchant's choices about a to-do item (Later, Don't remind me), per user; items themselves are computed
		name: "009_ai_work_state",
		sql: `CREATE TABLE IF NOT EXISTS ai_work_state (
			organization_id text NOT NULL,
			user_id text NOT NULL,
			key text NOT NULL,
			snoozed_until timestamptz,
			dismissed_fp text,
			last_raised_at timestamptz,
			updated_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (organization_id, user_id, key)
		);`,
	},
	{
		// run-start quota: one row per start, written with the check under a per-org lock; never
		// deleted with a chat (deleting must not give quota back), pruned after 2 days by retention.
		// The partial index serves the stale-run sweeps, which now run every minute.
		name: "010_ai_run_starts",
		sql: `CREATE TABLE IF NOT EXISTS ai_run_starts (
			run_id text PRIMARY KEY,
			organization_id text NOT NULL,
			user_id text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_run_starts_org_created_idx ON ai_run_starts (organization_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS ai_run_starts_user_created_idx ON ai_run_starts (organization_id, user_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS ai_run_starts_created_idx ON ai_run_starts (created_at);
		CREATE INDEX IF NOT EXISTS ai_runs_in_flight_idx ON ai_runs (updated_at) WHERE status IN ('planning', 'running');`,
	},
	{
		// picture quota: a generation reserves its pictures under a per-org lock before the provider
		// is called, so parallel requests cannot pass the daily cap; failed calls that reached the
		// provider stay counted. Each org's rows older than 2 days are pruned on its next reserve.
		name: "011_ai_image_reservations",
		sql: `CREATE TABLE IF NOT EXISTS ai_image_reservations (
			id text PRIMARY KEY,
			organization_id text NOT NULL,
			user_id text NOT NULL,
			pictures integer NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS ai_image_reservations_org_created_idx ON ai_image_reservations (organization_id, created_at DESC);`,
	},
	{
		// open questions (GET /agent/work on every read): a user's paused runs without scanning their history
		name: "012_ai_runs_awaiting_input_idx",
		sql: `CREATE INDEX IF NOT EXISTS ai_runs_awaiting_input_idx ON ai_runs (organization_id, user_id) WHERE status = 'awaiting_input';`,
	},
	{
		// the daily spend guard (AI_DAILY_BUDGET_USD): today's cost across every org as an index-only range scan
		name: "013_ai_usage_events_created_cost_idx",
		sql: `CREATE INDEX IF NOT EXISTS ai_usage_events_created_cost_idx ON ai_usage_events (created_at) INCLUDE (cost_usd_micros);`,
	},
	{
		// the copilot queue: a start beyond the shop's / person's working cap waits (FIFO) instead of a 429;
		// one active run per chat; a start sent twice (same client id) attaches to the first. Partial indexes
		// keep the per-org working / queued reads (every queue check) and the queued stale sweep small.
		name: "014_ai_run_queue",
		sql: `ALTER TABLE ai_run_starts ADD COLUMN IF NOT EXISTS queued boolean NOT NULL DEFAULT false;
		ALTER TABLE ai_run_starts ADD COLUMN IF NOT EXISTS thread_id text;
		ALTER TABLE ai_run_starts ADD COLUMN IF NOT EXISTS client_request_id text;
		ALTER TABLE ai_run_starts ADD COLUMN IF NOT EXISTS user_name text;
		CREATE INDEX IF NOT EXISTS ai_run_starts_client_request_idx ON ai_run_starts (organization_id, user_id, client_request_id) WHERE client_request_id IS NOT NULL;
		CREATE INDEX IF NOT EXISTS ai_runs_working_org_idx ON ai_runs (organization_id, updated_at) WHERE status IN ('planning', 'running', 'applying');
		CREATE INDEX IF NOT EXISTS ai_runs_queued_idx ON ai_runs (organization_id, updated_at) WHERE status = 'queued';`,
	},
];

/** Session lock taken around every migration run: two builds / deploys migrating at once take turns. */
export const MIGRATION_LOCK_SQL = "SELECT pg_advisory_lock(hashtext('ai_platform_migrations'))";
export const MIGRATION_UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('ai_platform_migrations'))";

/**
 * Applies the migrations not applied yet, on one dedicated connection holding a session advisory lock: a
 * second runner waits, then re-reads what was applied under the lock and finds nothing left to do (no
 * collision on `CREATE INDEX IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`).
 */
export async function runMigrations(pool: Pool, log: (line: string) => void = () => undefined): Promise<void> {
	const client = await pool.connect();
	let broken = false;
	try {
		await client.query(MIGRATION_LOCK_SQL);
		try {
			await client.query(`CREATE TABLE IF NOT EXISTS ai_platform_migrations (
				name text PRIMARY KEY,
				applied_at timestamptz NOT NULL DEFAULT now()
			)`);
			const applied = await client.query<{ name: string }>("SELECT name FROM ai_platform_migrations");
			const done = new Set(applied.rows.map((row) => row.name));
			for (const migration of MIGRATIONS) {
				if (done.has(migration.name)) continue;
				try {
					await client.query("BEGIN");
					await client.query(migration.sql);
					await client.query("INSERT INTO ai_platform_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [migration.name]);
					await client.query("COMMIT");
					log(`[ai-platform] applied migration ${migration.name}`);
				} catch (error) {
					await client.query("ROLLBACK");
					throw error;
				}
			}
		} finally {
			// a connection that cannot unlock is dropped instead (closing the session frees its lock)
			await client.query(MIGRATION_UNLOCK_SQL).catch(() => {
				broken = true;
			});
		}
	} finally {
		client.release(broken);
	}
}
