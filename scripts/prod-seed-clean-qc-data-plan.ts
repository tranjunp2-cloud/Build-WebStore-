/**
 * Pure FK-aware delete planning for the prod-seed cleanup.
 *
 * Payload/Drizzle tables reference `tenants` with ON DELETE SET NULL, so
 * deleting a tenant alone would leave orphaned rows behind. The planner turns
 * the live FK catalog into explicit, children-first DELETE statements.
 * Identifiers come from pg_catalog but are still validated before quoting.
 */

export type OnDelete = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION'

export interface FkEdge {
  childTable: string
  childColumn: string
  parentTable: string
  parentColumn: string
  onDelete: OnDelete
}

export interface PlannedDelete {
  table: string
  sql: string
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_DEPTH = 10

export function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`)
  return `"${name}"`
}

export function mapOnDelete(code: string): OnDelete {
  switch (code) {
    case 'c': return 'CASCADE'
    case 'n': return 'SET NULL'
    case 'd': return 'SET DEFAULT'
    case 'r': return 'RESTRICT'
    case 'a': return 'NO ACTION'
    default: throw new Error(`Unknown confdeltype: ${code}`)
  }
}

/**
 * ON DELETE SET NULL on a NOT NULL column raises instead of nulling (e.g.
 * orders.site_id), so for planning it behaves like NO ACTION: the child row
 * must be deleted first (tenant tree) or blocks the parent delete (users).
 */
export function effectiveOnDelete(onDelete: OnDelete, childNotNull: boolean): OnDelete {
  return onDelete === 'SET NULL' && childNotNull ? 'NO ACTION' : onDelete
}

/**
 * Children-first DELETE statements removing `table` rows matching `whereSql`
 * plus every row that depends on them through an edge whose action is in
 * `traverse`. SET NULL edges are never traversed (the child survives).
 */
export function planTreeDelete(
  fks: readonly FkEdge[],
  table: string,
  whereSql: string,
  traverse: ReadonlySet<OnDelete>,
  path: readonly string[] = [],
): PlannedDelete[] {
  if (path.length >= MAX_DEPTH || path.includes(table)) return []
  const out: PlannedDelete[] = []
  for (const fk of fks) {
    if (fk.parentTable !== table || !traverse.has(fk.onDelete)) continue
    const childWhere =
      `${quoteIdent(fk.childColumn)} IN (SELECT ${quoteIdent(fk.parentColumn)} ` +
      `FROM ${quoteIdent(table)} WHERE ${whereSql})`
    out.push(...planTreeDelete(fks, fk.childTable, childWhere, traverse, [...path, table]))
  }
  out.push({ table, sql: `DELETE FROM ${quoteIdent(table)} WHERE ${whereSql}` })
  return out
}

/** Drop repeated identical statements (same table reached through several paths). */
export function dedupePlan(plan: readonly PlannedDelete[]): PlannedDelete[] {
  const seen = new Set<string>()
  return plan.filter((p) => (seen.has(p.sql) ? false : (seen.add(p.sql), true)))
}

export const TENANT_TRAVERSE: ReadonlySet<OnDelete> = new Set<OnDelete>([
  'CASCADE',
  'RESTRICT',
  'NO ACTION',
])
export const USER_TRAVERSE: ReadonlySet<OnDelete> = new Set<OnDelete>(['CASCADE'])

/**
 * Delete plan for tenants listed in temp table `_del_tenants(id)`: every table
 * holding a tenant FK is cleaned first (any action), then the tenants.
 */
export function planTenantDeletes(fks: readonly FkEdge[]): PlannedDelete[] {
  const plan: PlannedDelete[] = []
  const scoped = fks.filter((fk) => fk.parentTable === 'tenants' && fk.parentColumn === 'id')
  for (const fk of scoped) {
    plan.push(
      ...planTreeDelete(
        fks,
        fk.childTable,
        `${quoteIdent(fk.childColumn)} IN (SELECT id FROM _del_tenants)`,
        TENANT_TRAVERSE,
      ),
    )
  }
  plan.push(...planTreeDelete(fks, 'tenants', 'id IN (SELECT id FROM _del_tenants)', TENANT_TRAVERSE))
  return dedupePlan(plan)
}

/** Delete plan for users in temp table `_del_users(id)`; only CASCADE children follow. */
export function planUserDeletes(fks: readonly FkEdge[]): PlannedDelete[] {
  return dedupePlan(planTreeDelete(fks, 'users', 'id IN (SELECT id FROM _del_users)', USER_TRAVERSE))
}

/** FKs that would make deleting a `parentTable` row fail (RESTRICT / NO ACTION). */
export function blockingEdges(fks: readonly FkEdge[], parentTable: string): FkEdge[] {
  return fks.filter(
    (fk) => fk.parentTable === parentTable && (fk.onDelete === 'RESTRICT' || fk.onDelete === 'NO ACTION'),
  )
}

/**
 * Whole-table wipe safety. `DELETE FROM t` also cascades into / is blocked by
 * referencing tables; return the edges that leave the wipe set so the caller
 * can refuse instead of silently destroying other data.
 */
export function wipeEscapes(fks: readonly FkEdge[], wipe: ReadonlySet<string>): FkEdge[] {
  return fks.filter(
    (fk) => wipe.has(fk.parentTable) && !wipe.has(fk.childTable) && fk.onDelete !== 'SET NULL' && fk.onDelete !== 'SET DEFAULT',
  )
}

/** Order wipe tables so referencing tables come before the tables they reference. */
export function orderChildrenFirst(tables: readonly string[], fks: readonly FkEdge[]): string[] {
  const set = new Set(tables)
  const ordered: string[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (t: string): void => {
    if (state.get(t)) return
    state.set(t, 'visiting')
    for (const fk of fks) {
      if (fk.parentTable === t && set.has(fk.childTable) && fk.childTable !== t) visit(fk.childTable)
    }
    state.set(t, 'done')
    ordered.push(t)
  }
  for (const t of [...tables].sort()) visit(t)
  return ordered
}
