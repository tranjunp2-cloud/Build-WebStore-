/**
 * Walks every store once and classifies changes. Stores are read one at a time from the spooled
 * artifacts to bound memory.
 * - Default (new snapshot only): new entities are compared with the ledger checksums.
 * - With the old snapshot: the old side is first checked against the ledger (parity gate), then old vs new.
 */
import type { SanitizedCollectionConfig } from 'payload'
import { compareStoreIds } from '../pw1-json/selectors'
import type { CsvFix } from './csv-normalize'
import { diffStore, ledgerGone, reconcileMoves, type EntityChange } from './entity-diff'
import { ledgerKey, type LedgerClaim } from './ledger-lookup'
import { isQuoteFixed, ParityGate, quoteFixedRows } from './parity-gate'
import { storeEntities, type Log, type PreparedSide } from './source-pipeline'

/** Above this share of claimed documents the run stops: a truncated export or a code drift is likelier than real edits. */
export const MASS_CHANGE_RATIO = 0.05
/** Removals get a tighter limit: a truncated export shows up as many vanished documents. */
export const MASS_GONE_RATIO = 0.01

export interface CompareResult {
  changes: EntityChange[]
  unchanged: number
  storesCompared: number
  storesOnlyOld: string[]
  storesOnlyNew: string[]
  /** null when the old snapshot was not given. */
  parity: ReturnType<ParityGate['result']> | null
}

export async function compareSnapshots(options: {
  old: PreparedSide | null; next: PreparedSide; configs: Record<string, SanitizedCollectionConfig>
  claims: ReadonlyMap<string, LedgerClaim>; excluded: ReadonlySet<string>; oldFixes: CsvFix[]; newFixes: CsvFix[]; log: Log
}): Promise<CompareResult> {
  const { old, next, configs, claims, excluded, log } = options
  const oldIds = new Set(old?.artifact.storeIds ?? []), newIds = new Set(next.artifact.storeIds)
  const storeIds = [...new Set([...oldIds, ...newIds])].sort(compareStoreIds)
  const gate = old ? new ParityGate(claims, options.oldFixes) : null
  const fixedRows = quoteFixedRows(options.newFixes)
  const seen = new Set<string>()
  const changes: EntityChange[] = []
  let unchanged = 0
  for (const [index, storeId] of storeIds.entries()) {
    const oldEntities = old ? await storeEntities(old, storeId, configs) : null
    if (gate && oldEntities) gate.check(storeId, oldEntities)
    const newEntities = await storeEntities(next, storeId, configs)
    for (const entity of newEntities) seen.add(ledgerKey(entity.sourceEntity, entity.sourceId))
    const result = diffStore(storeId, oldEntities, newEntities, claims, excluded)
    for (const change of result.changes)
      changes.push(change.kind === 'CHANGED' && change.target?.origin === 'import' && isQuoteFixed(fixedRows, change) ? { ...change, quoteFix: true } : change)
    unchanged += result.unchanged
    if ((index + 1) % 250 === 0 || index + 1 === storeIds.length) log(`  compared ${index + 1}/${storeIds.length} stores`)
  }
  const reconciled = finalizeChanges(changes, claims, seen, old !== null)
  return {
    changes: reconciled, unchanged, storesCompared: storeIds.length,
    storesOnlyOld: storeIds.filter(id => !newIds.has(id)), storesOnlyNew: old ? storeIds.filter(id => !oldIds.has(id)) : [],
    parity: gate?.result() ?? null,
  }
}

/**
 * Adds removals found from the ledger and pairs store moves. Without --old every claim is checked; with
 * --old the old snapshot finds removed imported documents, but documents created by a delta run are not in
 * it, so their claims are checked too. A document still produced by the new snapshot (in any store) is never
 * removed: a move already applied by an earlier run leaves only a stale GONE in the old store.
 */
export function finalizeChanges(changes: EntityChange[], claims: ReadonlyMap<string, LedgerClaim>, seen: ReadonlySet<string>, withOld: boolean): EntityChange[] {
  const goneKeys = new Set(changes.filter(change => change.kind === 'GONE').map(change => ledgerKey(change.sourceEntity, change.sourceId)))
  const ledgerClaims = withOld ? new Map([...claims].filter(([key, claim]) => claim.origin === 'delta' && !goneKeys.has(key))) : claims
  return reconcileMoves([...changes, ...ledgerGone(ledgerClaims, seen)])
    .filter(change => change.kind !== 'GONE' || !seen.has(ledgerKey(change.sourceEntity, change.sourceId)))
}

/** Changes that are not only the known quote-prefix fix, compared with the number of claimed documents. */
export function massChange(changes: EntityChange[], claimCount: number) {
  const count = changes.filter(change => !change.quoteFix).length
  const limit = Math.floor(claimCount * MASS_CHANGE_RATIO)
  const gone = changes.filter(change => change.kind === 'GONE').length
  const goneLimit = Math.floor(claimCount * MASS_GONE_RATIO)
  return { count, limit, gone, goneLimit, exceeded: count > limit || gone > goneLimit }
}

/** collection → kind → count, used by the console summary and summary.md. */
export function countChanges(changes: EntityChange[]): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {}
  for (const change of changes) {
    const row = (counts[change.collection] ??= {})
    const kind = change.recovered ? 'NEW (recovered)' : change.quoteFix ? 'CHANGED (quote fix)' : change.kind
    row[kind] = (row[kind] ?? 0) + 1
  }
  return counts
}
