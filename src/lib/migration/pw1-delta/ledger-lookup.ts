/**
 * Read-only access to the original import ledger (SELECT only) plus the delta's own ledger when it exists.
 * The ledger links a PW1 source key to the PW2 document created for it and stores the checksums used
 * for the parity gate and for detecting edits made in PW2 after the import.
 */
import { Pool } from 'pg'
import { DeltaError } from './delta-options'

export interface LedgerClaim {
  targetCollection: string
  targetId: string
  sourceChecksum: string
  targetChecksum: string | null
  origin: 'import' | 'delta'
  /** Known only for claims written by the delta (the import ledger has no store column). */
  storeId?: string
}

export const ledgerKey = (sourceEntity: string, sourceId: string) => `${sourceEntity}\u0000${sourceId}`

/**
 * Neon's pooled endpoint (`-pooler` host) runs PgBouncer in transaction mode: the session advisory lock
 * that keeps one delta at a time may not hold there, so only the direct endpoint is accepted.
 */
export function assertDirectConnection(uri: string): void {
  let host: string
  try { host = new URL(uri).hostname } catch { return } // pg reports an unparseable URI itself
  if (host.includes('-pooler')) throw new DeltaError('POOLED_DATABASE_URI', `${host}: use the direct (non -pooler) connection string`)
}

export function readOnlyPool(uri: string | undefined): Pool {
  if (!uri) throw new DeltaError('DATABASE_URI_REQUIRED')
  assertDirectConnection(uri)
  return new Pool({ connectionString: uri, max: 2, connectionTimeoutMillis: 10_000,
    options: '-c default_transaction_read_only=on -c statement_timeout=120000' })
}

/** The snapshot id of the original import; it is part of every child-row id, so it must be reused exactly. */
export async function importedSnapshot(pool: Pool): Promise<{ sourceInstance: string; snapshotId: string }> {
  const { rows } = await pool.query<{ source_instance_id: string; source_snapshot_id: string }>(
    `SELECT DISTINCT source_instance_id, source_snapshot_id FROM migration_runs WHERE source_system='pw1'`)
  if (rows.length !== 1) throw new DeltaError('SNAPSHOT_ID_AMBIGUOUS', `${rows.length} imported snapshots found in migration_runs`)
  return { sourceInstance: rows[0].source_instance_id, snapshotId: rows[0].source_snapshot_id }
}

/** Active claims of the original import, overlaid with claims written by earlier delta runs. */
export async function loadClaims(pool: Pool, sourceInstance: string): Promise<Map<string, LedgerClaim>> {
  const claims = new Map<string, LedgerClaim>()
  // A store whose import stopped half way would make its documents look NEW and get created twice.
  const pending = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM migration_entity_map
      WHERE source_system='pw1' AND source_instance_id=$1 AND claim_active=true AND action='CREATE' AND state<>'VERIFIED'`, [sourceInstance])
  if (Number(pending.rows[0]?.count ?? 0) > 0) throw new DeltaError('IMPORT_NOT_VERIFIED', `${pending.rows[0].count} imported documents are not VERIFIED; finish or repair the import first`)
  const imported = await pool.query<{ source_entity: string; source_id: string; target_collection: string; target_id: string; source_checksum: string; target_checksum: string | null }>(
    `SELECT source_entity, source_id, target_collection, target_id, source_checksum, target_checksum
       FROM migration_entity_map
      WHERE source_system='pw1' AND source_instance_id=$1 AND claim_active=true AND action='CREATE' AND state='VERIFIED'`,
    [sourceInstance])
  for (const row of imported.rows) claims.set(ledgerKey(row.source_entity, row.source_id), {
    targetCollection: row.target_collection, targetId: row.target_id, sourceChecksum: row.source_checksum,
    targetChecksum: row.target_checksum, origin: 'import',
  })
  const { rows: [exists] } = await pool.query<{ ok: boolean }>(`SELECT to_regclass('public.pw1_delta_map') IS NOT NULL AS ok`)
  if (exists?.ok) {
    const delta = await pool.query<{ source_entity: string; source_id: string; store_id: string; target_collection: string; target_id: string; source_checksum: string; target_checksum: string }>(
      `SELECT source_entity, source_id, store_id, target_collection, target_id, source_checksum, target_checksum FROM pw1_delta_map`)
    for (const row of delta.rows) claims.set(ledgerKey(row.source_entity, row.source_id), {
      targetCollection: row.target_collection, targetId: row.target_id, sourceChecksum: row.source_checksum,
      targetChecksum: row.target_checksum, origin: 'delta', storeId: row.store_id,
    })
  }
  return claims
}

/** Source rows the original import kept out on purpose (policy or soft-deleted); used only to label NEW rows. */
export async function previouslyExcluded(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ source_entity: string; source_id: string }>(
    `SELECT DISTINCT source_entity, source_id FROM migration_source_evidence_rows WHERE disposition IN ('retained-source','excluded')`)
  return new Set(rows.map(row => ledgerKey(row.source_entity, row.source_id)))
}

/**
 * Store of each claimed document that vanished from the new snapshot, read from its PW2 tenant
 * (`tenant_id` column → tenant claim → PW1 store id). Read-only; documents without a tenant stay unknown.
 */
export async function goneDocumentStores(pool: Pool, gone: { collection: string; targetId: string }[],
  claims: ReadonlyMap<string, LedgerClaim>): Promise<Map<string, string>> {
  const storeOfTenant = new Map<string, string>()
  for (const [key, claim] of claims) if (claim.targetCollection === 'tenants') storeOfTenant.set(claim.targetId, key.split('\u0000')[1])
  const result = new Map<string, string>()
  const byCollection = new Map<string, string[]>()
  for (const row of gone) byCollection.set(row.collection, [...(byCollection.get(row.collection) ?? []), row.targetId])
  for (const [collection, ids] of byCollection) {
    const table = collection.replaceAll('-', '_')
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) continue
    const { rows: [column] } = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='tenant_id'`, [table])
    if (!column) continue
    const { rows } = await pool.query<{ id: string; tenant_id: string | null }>(`SELECT id::text, tenant_id::text FROM "${table}" WHERE id = ANY($1::int[])`, [ids.map(Number)])
    for (const row of rows) { const store = row.tenant_id ? storeOfTenant.get(row.tenant_id) : undefined; if (store) result.set(`${collection}:${row.id}`, store) }
  }
  return result
}
