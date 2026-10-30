/**
 * DB side of the prod-seed cleanup. One transaction: classify, delete, count,
 * verify provenance untouched, then COMMIT (--apply) or ROLLBACK (dry run).
 * Classification and SQL planning live in sibling pure modules.
 */
import type { ClientBase } from 'pg'
import {
  count,
  discoverWipeTables,
  loadFks,
  loadProvenance,
  loadTenants,
  loadUsers,
  provenanceCounts,
  tableExists,
} from './prod-seed-clean-qc-data-queries'
import {
  classifyTenant,
  classifyUser,
  type ClassifyOptions,
  maskEmail,
  type Verdict,
} from './prod-seed-clean-qc-data-classify'
import {
  blockingEdges,
  mapOnDelete,
  orderChildrenFirst,
  planTenantDeletes,
  planUserDeletes,
  quoteIdent,
  wipeEscapes,
  type FkEdge,
  type PlannedDelete,
} from './prod-seed-clean-qc-data-plan'

export type Phase = 'delete' | 'truncate' | 'keep' | 'review'
export interface ReportRow { phase: Phase; table: string; count: number; note: string }
export interface CleanupReport {
  applied: boolean
  rows: ReportRow[]
  remainingSuperAdmins: { id: number; email: string }[]
  warnings: string[]
}

const KEEP_REPORT_TABLES: readonly string[] = [
  'tenants', 'users', 'sites', 'pages', 'products', 'categories', 'orders', 'customers', 'media',
  'blogs', 'subscriptions', 'plan_subscriptions', 'templates', 'plan_features',
  'email_template_settings', 'block_catalog_entries', 'block_variants', 'content_packs',
]
const REQUIRED_TABLES: readonly string[] = [
  'tenants', 'users', 'users_roles', 'users_tenants', 'sites', 'migration_entity_map',
]

async function runPlan(c: ClientBase, plan: readonly PlannedDelete[], phase: Phase, tally: Map<string, number>): Promise<void> {
  for (const step of plan) {
    const r = await c.query(step.sql)
    tally.set(`${phase}:${step.table}`, (tally.get(`${phase}:${step.table}`) ?? 0) + (r.rowCount ?? 0))
  }
}

export async function runCleanup(c: ClientBase, apply: boolean, opts: ClassifyOptions = { deleteReview: false }): Promise<CleanupReport> {
  const warnings: string[] = []
  const rows: ReportRow[] = []
  const tally = new Map<string, number>()
  await c.query('BEGIN')
  try {
    await c.query(`SET LOCAL lock_timeout = '10s'`)
    await c.query(`SET LOCAL statement_timeout = '20min'`)
    for (const t of REQUIRED_TABLES) {
      if (!(await tableExists(c, t))) throw new Error(`Required table missing: ${t} (cannot determine provenance safely)`)
    }
    const { fks, skippedComposite } = await loadFks(c)
    if (skippedComposite > 0) warnings.push(`${skippedComposite} composite FK(s) ignored by planner; DB will error if one blocks a delete`)
    await loadProvenance(c)
    const provBefore = await provenanceCounts(c)

    // Classification
    const users = await loadUsers(c)
    const userVerdicts = new Map<number, Verdict>()
    const userReasons = new Map<number, string>()
    for (const u of users) { const v = classifyUser(u, opts); userVerdicts.set(u.id, v.verdict); userReasons.set(u.id, v.reason) }
    const tenants = await loadTenants(c)
    const tenantVerdicts = new Map<number, Verdict>()
    for (const t of tenants) tenantVerdicts.set(t.id, classifyTenant(t, userVerdicts, opts).verdict)

    await c.query(`CREATE TEMP TABLE _del_tenants (id integer PRIMARY KEY) ON COMMIT DROP`)
    await c.query(`CREATE TEMP TABLE _del_users (id integer PRIMARY KEY) ON COMMIT DROP`)
    const delTenants = tenants.filter((t) => tenantVerdicts.get(t.id) === 'delete').map((t) => t.id)
    const delUsers = users.filter((u) => userVerdicts.get(u.id) === 'delete').map((u) => u.id)
    if (delTenants.length) await c.query(`INSERT INTO _del_tenants SELECT unnest($1::int[])`, [delTenants])
    if (delUsers.length) await c.query(`INSERT INTO _del_users SELECT unnest($1::int[])`, [delUsers])

    // Phase 1: ephemeral wipe (DELETE, so FK actions are honoured and counts are exact).
    const wipe = await discoverWipeTables(c)
    const escapes = wipeEscapes(fks, new Set(wipe))
    if (escapes.length) {
      throw new Error(`Wipe set escapes via FK: ${escapes.map((e) => `${e.childTable}.${e.childColumn}->${e.parentTable} (${e.onDelete})`).join(', ')}`)
    }
    const wipePlan = orderChildrenFirst(wipe, fks).map((table) => ({ table, sql: `DELETE FROM ${quoteIdent(table)}` }))
    await runPlan(c, wipePlan, 'truncate', tally)

    // Phase 2: tenant-scoped data, then tenants.
    await runPlan(c, planTenantDeletes(fks), 'delete', tally)

    // Phase 3: users. A QC user still referenced through RESTRICT / NO ACTION is demoted to review.
    const demoted = new Set<number>()
    for (const edge of blockingEdges(fks, 'users')) {
      const r = await c.query<{ v: number }>(
        `SELECT DISTINCT ${quoteIdent(edge.childColumn)} AS v FROM ${quoteIdent(edge.childTable)}
         WHERE ${quoteIdent(edge.childColumn)} IN (SELECT id FROM _del_users)`)
      for (const { v } of r.rows) demoted.add(Number(v))
    }
    if (demoted.size) {
      await c.query(`DELETE FROM _del_users WHERE id = ANY($1::int[])`, [[...demoted]])
      warnings.push(`${demoted.size} QC user(s) demoted to REVIEW: referenced via RESTRICT/NO ACTION FK`)
    }
    await runPlan(c, planUserDeletes(fks), 'delete', tally)

    // Provenance must be untouched.
    const provAfter = await provenanceCounts(c)
    for (const [coll, before] of provBefore) {
      const after = provAfter.get(coll) ?? 0
      if (after !== before) throw new Error(`Provenance violated: ${coll} ledger-backed rows ${before} -> ${after}; aborting`)
    }

    // Report assembly
    for (const [key, n] of tally) {
      const [phase, table] = key.split(':') as [Phase, string]
      if (n > 0) rows.push({ phase, table, count: n, note: phase === 'truncate' ? 'ephemeral/queue' : 'qc or scoped to qc tenant/user' })
    }
    for (const t of KEEP_REPORT_TABLES) {
      if (await tableExists(c, t)) rows.push({ phase: 'keep', table: t, count: await count(c, t), note: 'rows remaining after cleanup' })
    }
    const keptReviewTenants = tenants.filter((t) => tenantVerdicts.get(t.id) === 'review')
    if (keptReviewTenants.length) {
      rows.push({ phase: 'review', table: 'tenants', count: keptReviewTenants.length, note: keptReviewTenants.map((t) => `#${t.id}:${t.slug}`).slice(0, 50).join(' ') })
    }
    const reviewUsers = users.filter((u) => userVerdicts.get(u.id) === 'review' || demoted.has(u.id))
    if (reviewUsers.length) {
      rows.push({ phase: 'review', table: 'users', count: reviewUsers.length, note: reviewUsers.map((u) => `#${u.id}:${maskEmail(u.email)}`).slice(0, 50).join(' ') })
    }
    const keptTenantIds = new Set(tenants.filter((t) => tenantVerdicts.get(t.id) !== 'delete').map((t) => t.id))
    const qcInKept = tenants.filter((t) => keptTenantIds.has(t.id) && t.memberUserIds.some((id) => userVerdicts.get(id) === 'delete'))
    if (qcInKept.length) {
      rows.push({ phase: 'review', table: 'users_tenants', count: qcInKept.length, note: `kept tenants that had QC members (memberships removed): ${qcInKept.map((t) => `#${t.id}`).slice(0, 30).join(' ')}` })
    }
    for (const fk of fks.filter((f) => f.parentTable === 'tenants' && f.parentColumn === 'id')) {
      const n = await count(c, fk.childTable, `${quoteIdent(fk.childColumn)} IS NULL`)
      if (n > 0) rows.push({ phase: 'review', table: fk.childTable, count: n, note: `rows with NULL ${fk.childColumn} (orphans, kept)` })
    }
    if (await tableExists(c, 'orders')) {
      const n = await count(c, 'orders', `status = 'pending'`)
      if (n > 0) rows.push({ phase: 'review', table: 'orders', count: n, note: `pending orders in kept tenants: payment-expiry / reconcile-orders crons will act on them` })
    }
    if (await tableExists(c, 'migration_import_stores')) {
      const n = await count(c, 'migration_import_stores', `state <> 'VERIFIED'`)
      if (n > 0) warnings.push(`${n} migration_import_stores row(s) not VERIFIED: import may be incomplete`)
    }
    const admins = await c.query<{ id: number; email: string }>(`
      SELECT DISTINCT u.id, u.email FROM users u JOIN users_roles r ON r.parent_id = u.id
      WHERE r.value::text = 'super-admin' ORDER BY u.id`)

    await c.query(apply ? 'COMMIT' : 'ROLLBACK')
    return { applied: apply, rows, remainingSuperAdmins: admins.rows.map((a) => ({ id: Number(a.id), email: a.email })), warnings }
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined)
    throw err
  }
}
