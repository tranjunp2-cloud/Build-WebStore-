/**
 * Read-only catalog / ledger queries for the prod-seed cleanup. Everything
 * here runs inside the caller's transaction (temp table `_prov` is created
 * with ON COMMIT DROP).
 */
import type { ClientBase } from 'pg'
import type { TenantRow, UserRow } from './prod-seed-clean-qc-data-classify'
import { effectiveOnDelete, mapOnDelete, quoteIdent, type FkEdge } from './prod-seed-clean-qc-data-plan'

const LEDGER_OK_STATES = `'CREATED','VERIFIED','SKIPPED'`

/** Tables discovered by name; ledger tables are never matched. */
const PROTECTED_TABLE = /^(migration_|pw1_|payload_migrations$)/

/** Tables whose rows are runtime state (sessions, locks, queues), never merchant data. */
const EPHEMERAL_TABLES: readonly string[] = [
  'users_sessions',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'generation_recovery_jobs',
  'sso_step_events',
  'push_subscriptions',
]
type Row = Record<string, unknown>

export async function tableExists(c: ClientBase, name: string): Promise<boolean> {
  const r = await c.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${quoteIdent(name)}`])
  return r.rows[0]?.ok === true
}

export async function count(c: ClientBase, table: string, where = 'TRUE'): Promise<number> {
  const r = await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${quoteIdent(table)} WHERE ${where}`)
  return Number(r.rows[0]?.n ?? 0)
}

export async function loadFks(c: ClientBase): Promise<{ fks: FkEdge[]; skippedComposite: number }> {
  const r = await c.query<Row>(`
    SELECT cr.relname AS child_table, ca.attname AS child_column, pr.relname AS parent_table,
           pa.attname AS parent_column, k.confdeltype AS on_delete, array_length(k.conkey, 1) AS ncols,
           ca.attnotnull AS child_not_null
    FROM pg_constraint k
    JOIN pg_class cr ON cr.oid = k.conrelid
    JOIN pg_class pr ON pr.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = k.connamespace AND n.nspname = 'public'
    JOIN pg_attribute ca ON ca.attrelid = k.conrelid AND ca.attnum = k.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = k.confrelid AND pa.attnum = k.confkey[1]
    WHERE k.contype = 'f'`)
  const fks: FkEdge[] = []
  let skippedComposite = 0
  for (const row of r.rows) {
    if (Number(row.ncols) > 1) { skippedComposite++; continue }
    fks.push({
      childTable: String(row.child_table), childColumn: String(row.child_column),
      parentTable: String(row.parent_table), parentColumn: String(row.parent_column),
      onDelete: effectiveOnDelete(mapOnDelete(String(row.on_delete)), row.child_not_null === true),
    })
  }
  return { fks, skippedComposite }
}

/** Ledger targets (PW1 import + delta) as temp table `_prov(coll, id)`. */
export async function loadProvenance(c: ClientBase): Promise<void> {
  await c.query(`CREATE TEMP TABLE _prov (coll text NOT NULL, id text NOT NULL, PRIMARY KEY (coll, id)) ON COMMIT DROP`)
  await c.query(`INSERT INTO _prov SELECT replace(target_collection, '-', '_'), target_id FROM migration_entity_map
    WHERE target_collection IS NOT NULL AND target_id IS NOT NULL AND state IN (${LEDGER_OK_STATES})
    ON CONFLICT DO NOTHING`)
  if (await tableExists(c, 'pw1_delta_map')) {
    await c.query(`INSERT INTO _prov SELECT replace(target_collection, '-', '_'), target_id FROM pw1_delta_map ON CONFLICT DO NOTHING`)
  }
  if (await tableExists(c, 'pw1_delta_credentials')) {
    await c.query(`INSERT INTO _prov SELECT 'users', target_id FROM pw1_delta_credentials ON CONFLICT DO NOTHING`)
  }
}

export async function provenanceCounts(c: ClientBase): Promise<Map<string, number>> {
  const colls = await c.query<{ coll: string }>(`SELECT DISTINCT coll FROM _prov`)
  const out = new Map<string, number>()
  for (const { coll } of colls.rows) {
    if (!(await tableExists(c, coll))) continue
    const r = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${quoteIdent(coll)} t JOIN _prov p ON p.coll = $1 AND p.id = t.id::text`, [coll])
    out.set(coll, Number(r.rows[0]?.n ?? 0))
  }
  return out
}

export async function loadUsers(c: ClientBase): Promise<UserRow[]> {
  const r = await c.query<Row>(`
    SELECT u.id, u.email,
      COALESCE((SELECT array_agg(r.value::text) FROM users_roles r WHERE r.parent_id = u.id), '{}') AS roles,
      EXISTS (SELECT 1 FROM _prov p WHERE p.coll = 'users' AND p.id = u.id::text) AS has_prov
    FROM users u`)
  return r.rows.map((x) => ({
    id: Number(x.id), email: String(x.email), roles: (x.roles as string[]) ?? [], hasProvenance: x.has_prov === true,
  }))
}

export async function loadTenants(c: ClientBase): Promise<TenantRow[]> {
  const r = await c.query<Row>(`
    SELECT t.id, t.slug, t.name,
      (EXISTS (SELECT 1 FROM _prov p WHERE p.coll = 'tenants' AND p.id = t.id::text)
       OR EXISTS (SELECT 1 FROM sites s JOIN _prov p ON p.coll = 'sites' AND p.id = s.id::text WHERE s.tenant_id = t.id)
      ) AS has_prov,
      COALESCE((SELECT array_agg(ut._parent_id) FROM users_tenants ut WHERE ut.tenant_id = t.id), '{}') AS member_ids
    FROM tenants t`)
  return r.rows.map((x) => ({
    id: Number(x.id), slug: String(x.slug ?? ''), name: String(x.name ?? ''), hasProvenance: x.has_prov === true,
    memberUserIds: ((x.member_ids as number[]) ?? []).map(Number),
  }))
}

export async function discoverWipeTables(c: ClientBase): Promise<string[]> {
  const r = await c.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND (table_name LIKE 'qa\\_%' OR table_name ~ '(outbox|queue)')`)
  const found = r.rows.map((x) => x.table_name)
  const fixed: string[] = []
  for (const t of EPHEMERAL_TABLES) if (await tableExists(c, t)) fixed.push(t)
  return [...new Set([...fixed, ...found])].filter((t) => !PROTECTED_TABLE.test(t))
}

