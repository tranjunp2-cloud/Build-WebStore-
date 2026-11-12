/**
 * Re-enables COD on sites whose website was already generated (#2179).
 *
 * The exporter writes `tenant.payments.payment_cod` and `site.paymentConfig.enableCod` from the same value
 * (PW1 COD AND tenant active). A tenant suspended at import got both `false`. When a later delta reactivates
 * the tenant it rewrites the tenant, but never a site whose website was generated (`SITE_WEBSITE_GENERATED`),
 * so the site keeps `enableCod=false` and checkout hides COD. This module finds those sites and flips only
 * that one field, and only when `false` is still the value the migration wrote (no PW2 edit).
 * The migration ledgers are read only: the delta's behaviour on later runs does not change.
 */
import type { PayloadRequest } from 'payload'
import type { QueryClient } from '../pw1-json/runtime'
import { DeltaError } from './delta-options'
import type { DeltaRuntime } from './delta-runtime'

export type CodRepairScope = { all: true } | { all: false; stores: string[] }
export type CodRepairDecision = 'PATCH' | 'SKIP_PW2_EDITED' | 'SKIP_NO_PROJECTION'

/** A generated site with tenant active + `payment_cod=true` and live `enableCod=false`. */
export interface CodRepairRow {
  storeId: string; tenantId: number; siteId: number; slug: string
  /** `paymentConfig.enableCod` last written by the delta / by the import; undefined when not recorded. */
  deltaCod?: unknown; importCod?: unknown
}

/** Why a store passed with `--store` is not a candidate (reported, never silently dropped). */
export type NotSelectedReason = 'NOT_GENERATED' | 'NOT_COMPLETED' | 'TENANT_NOT_ACTIVE' | 'TENANT_COD_OFF' | 'ALREADY_ENABLED'

export interface NotSelectedRow {
  storeId: string; generationStatus?: string | null; tenantStatus?: string | null; tenantCod?: boolean | null; siteCod?: boolean | null
}

export interface CodRepairOutcome {
  storeId: string; tenantId: number; siteId: number; slug: string; decision: CodRepairDecision
  before: boolean; after?: boolean; result?: 'written' | 'changed-since-check' | 'failed'; error?: string
}

/** `--store` and `--all` are mutually exclusive and one of them is required: no implicit "every store". */
export function parseCodRepairScope(store: string | undefined, all: boolean): CodRepairScope {
  if (all && store !== undefined) throw new DeltaError('SCOPE_CONFLICT', 'use either --store or --all')
  if (all) return { all: true }
  if (store === undefined) throw new DeltaError('SCOPE_REQUIRED', 'pass --store <ids> or --all')
  const stores = store.split(',').map(id => id.trim()).filter(Boolean)
  const invalid = stores.filter(id => !/^[1-9]\d*$/.test(id))
  if (!stores.length || invalid.length) throw new DeltaError('STORE_ID_INVALID', invalid.join(',') || '(empty)')
  return { all: false, stores: [...new Set(stores)] }
}

/**
 * The delta's own projection wins over the import's (same order as `priorProjection`). Only a recorded
 * `false` proves the live `false` came from the migration; a recorded `true` means PW2 changed it since.
 */
export function classifyCodRepair(row: Pick<CodRepairRow, 'deltaCod' | 'importCod'>): CodRepairDecision {
  const recorded = typeof row.deltaCod === 'boolean' ? row.deltaCod : row.importCod
  if (typeof recorded !== 'boolean') return 'SKIP_NO_PROJECTION'
  return recorded === false ? 'PATCH' : 'SKIP_PW2_EDITED'
}

/** Full existing group + `enableCod: true`, so sibling fields (QR code, bank details…) are kept. */
export function codRepairPatch(paymentConfig: unknown): { paymentConfig: Record<string, unknown> } {
  const current = paymentConfig && typeof paymentConfig === 'object' && !Array.isArray(paymentConfig) ? paymentConfig as Record<string, unknown> : {}
  return { paymentConfig: { ...current, enableCod: true } }
}

/** Resolved through search_path, like the unqualified table names in the queries below. */
async function tableExists(client: QueryClient, table: string): Promise<boolean> {
  const { rows } = await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [table])
  return rows[0]?.ok === true
}

/** Sites in the inconsistent state, with the recorded projection of the same target site. */
export async function findCodRepairCandidates(client: QueryClient, sourceInstance: string, scope: CodRepairScope): Promise<CodRepairRow[]> {
  if (!(await tableExists(client, 'pw1_migration_stores'))) return []
  // A database that never ran a delta has no delta ledger: only the import projection is available.
  const delta = await tableExists(client, 'pw1_delta_map')
  const { rows } = await client.query(`
    SELECT ps.source_store_id AS store_id, ps.tenant_id, ps.site_id, t.slug,
           ${delta ? `dm.projection->'paymentConfig'->'enableCod'` : 'NULL::jsonb'} AS delta_cod,
           em.detail->'projection'->'paymentConfig'->'enableCod' AS import_cod
      FROM pw1_migration_stores ps
      JOIN tenants t ON t.id = ps.tenant_id
      JOIN sites s ON s.id = ps.site_id
      ${delta ? `LEFT JOIN pw1_delta_map dm ON dm.source_entity = 'sites' AND dm.source_id = ps.source_store_id
             AND dm.target_collection = 'sites' AND dm.target_id = ps.site_id::text` : ''}
      LEFT JOIN migration_entity_map em ON em.source_system = 'pw1' AND em.source_instance_id = $1
             AND em.source_entity = 'sites' AND em.source_id = ps.source_store_id AND em.claim_active AND em.action = 'CREATE'
             AND em.target_id = ps.site_id::text
     WHERE ps.status = 'completed' AND t.status = 'active' AND t.payments_payment_cod IS TRUE
       AND s.payment_config_enable_cod IS FALSE
       AND ($2::text[] IS NULL OR ps.source_store_id = ANY($2::text[]))
     ORDER BY ps.source_store_id::bigint`, [sourceInstance, scope.all ? null : scope.stores])
  return rows.map(row => ({
    storeId: String(row.store_id), tenantId: Number(row.tenant_id), siteId: Number(row.site_id), slug: String(row.slug ?? ''),
    deltaCod: row.delta_cod ?? undefined, importCod: row.import_cod ?? undefined,
  }))
}

/**
 * NOT_GENERATED: no generated website (the delta itself writes those sites). TENANT_NOT_ACTIVE: tenant not
 * reactivated (e.g. banned store 1327, or the delta has not run yet). ALREADY_ENABLED: COD already on (or NULL,
 * which checkout treats as on).
 */
export function notSelectedReason(row: NotSelectedRow): NotSelectedReason {
  if (!row.generationStatus) return 'NOT_GENERATED'
  if (row.generationStatus !== 'completed') return 'NOT_COMPLETED'
  if (row.tenantStatus !== 'active') return 'TENANT_NOT_ACTIVE'
  if (row.tenantCod !== true) return 'TENANT_COD_OFF'
  return 'ALREADY_ENABLED'
}

/** Requested stores that are not candidates, with their current state. */
export async function findNotSelected(client: QueryClient, stores: string[], selected: Set<string>): Promise<(NotSelectedRow & { reason: NotSelectedReason })[]> {
  const rest = stores.filter(store => !selected.has(store))
  if (!rest.length) return []
  const generated = await tableExists(client, 'pw1_migration_stores')
  const { rows } = await client.query(generated ? `
    SELECT req.id AS store_id, ps.status AS generation_status, t.status AS tenant_status,
           t.payments_payment_cod AS tenant_cod, s.payment_config_enable_cod AS site_cod
      FROM unnest($1::text[]) AS req(id)
      LEFT JOIN pw1_migration_stores ps ON ps.source_store_id = req.id
      LEFT JOIN tenants t ON t.id = ps.tenant_id
      LEFT JOIN sites s ON s.id = ps.site_id
     ORDER BY req.id::bigint` : `SELECT req.id AS store_id FROM unnest($1::text[]) AS req(id) ORDER BY req.id::bigint`, [rest])
  return rows.map(row => {
    const state: NotSelectedRow = { storeId: String(row.store_id), generationStatus: row.generation_status as string | null | undefined,
      tenantStatus: row.tenant_status as string | null | undefined, tenantCod: row.tenant_cod as boolean | null | undefined, siteCod: row.site_cod as boolean | null | undefined }
    return { ...state, reason: notSelectedReason(state) }
  })
}

export function planCodRepair(rows: CodRepairRow[]): CodRepairOutcome[] {
  return rows.map(({ storeId, tenantId, siteId, slug, ...recorded }) => ({ storeId, tenantId, siteId, slug, decision: classifyCodRepair(recorded), before: false }))
}

async function liveCod(runtime: DeltaRuntime, req: Partial<PayloadRequest>, siteId: number): Promise<{ paymentConfig?: unknown } | null> {
  return await runtime.payload.findByID({ collection: 'sites', id: siteId, depth: 0, overrideAccess: true, disableErrors: true, req }) as { paymentConfig?: unknown } | null
}

const enableCodOf = (doc: { paymentConfig?: unknown } | null) => (doc?.paymentConfig as { enableCod?: unknown } | undefined)?.enableCod

/** One transaction per site; the live value is re-read inside it so a concurrent edit is never overwritten. */
export async function applyCodRepair(runtime: DeltaRuntime, planned: CodRepairOutcome[]): Promise<CodRepairOutcome[]> {
  const results: CodRepairOutcome[] = []
  for (const outcome of planned) {
    if (outcome.decision !== 'PATCH') { results.push(outcome); continue }
    try {
      const result = await runtime.transaction(async (req, client) => {
        // Row lock: an admin save between the re-read and the update cannot be overwritten.
        await client.query(`SELECT 1 FROM sites WHERE id = $1 FOR UPDATE`, [outcome.siteId])
        const live = await liveCod(runtime, req, outcome.siteId)
        if (enableCodOf(live) !== false) return { ...outcome, result: 'changed-since-check' as const }
        await runtime.payload.update({ collection: 'sites', id: outcome.siteId, data: codRepairPatch(live?.paymentConfig) as never,
          depth: 0, overrideAccess: true, req, context: req.context })
        const after = enableCodOf(await liveCod(runtime, req, outcome.siteId))
        if (after !== true) throw new Error(`enableCod is ${String(after)} after update`)
        return { ...outcome, after: true, result: 'written' as const }
      })
      results.push(result)
    } catch (error) {
      results.push({ ...outcome, result: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
}
