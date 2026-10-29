/**
 * Pure comparison of the entities built from the imported snapshot (old) and the latest snapshot (new).
 * Entities are matched by their source ref; the ledger only supplies the PW2 target of each match.
 */
import { canonical, type Entity } from '../pw1-json/projection'
import { ledgerKey, type LedgerClaim } from './ledger-lookup'

export type ChangeKind = 'NEW' | 'CHANGED' | 'GONE'

/** Delta-ledger checksum marking a document already retired because it left PW1. */
export const RETIRED_CHECKSUM = 'RETIRED'

export interface EntityChange {
  kind: ChangeKind
  storeId: string
  collection: string
  ref: string
  sourceEntity: string
  sourceId: string
  oldChecksum: string | null
  newChecksum: string | null
  fields: string[]
  target: { collection: string; id: string; origin: LedgerClaim['origin'] } | null
  recovered?: true
  movedFrom?: string
  /** Built from a CSV row whose spreadsheet quote prefix was stripped; the change may be only that fix. */
  quoteFix?: true
}

/** Top-level data keys whose canonical value differs; enough for a human-readable report. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(key => canonical(before[key] ?? null) !== canonical(after[key] ?? null)).sort()
}

function target(claim: LedgerClaim | undefined): EntityChange['target'] {
  return claim ? { collection: claim.targetCollection, id: claim.targetId, origin: claim.origin } : null
}

/**
 * Diffs one store against the ledger checksums. `oldEntities` (the rebuilt imported snapshot, with --old)
 * adds the changed field names and finds vanished documents; with `null`, vanished documents are found by
 * `ledgerGone`. The parity gate proved both references agree except for quote-prefix fixes.
 */
export function diffStore(
  storeId: string, oldEntities: Entity[] | null, newEntities: Entity[],
  claims: ReadonlyMap<string, LedgerClaim>, excluded: ReadonlySet<string>,
): { changes: EntityChange[]; unchanged: number } {
  const before = new Map((oldEntities ?? []).map(entity => [entity.ref, entity]))
  const changes: EntityChange[] = []
  let unchanged = 0
  for (const entity of newEntities) {
    const prior = before.get(entity.ref)
    before.delete(entity.ref)
    const key = ledgerKey(entity.sourceEntity, entity.sourceId)
    const claim = claims.get(key)
    // The ledger is the reference for every claimed document (import or a previous delta), with or without
    // --old: a document whose imported value had a spreadsheet quote prefix differs from the ledger and is
    // corrected, even though old and new rebuilds (both normalized) are equal. Unclaimed ones compare old vs new.
    const unchangedSince = claim ? claim.sourceChecksum === entity.sourceChecksum : prior?.sourceChecksum === entity.sourceChecksum
    if (unchangedSince) { unchanged++; continue }
    const base = { storeId, collection: entity.collection, ref: entity.ref, sourceEntity: entity.sourceEntity, sourceId: entity.sourceId, newChecksum: entity.sourceChecksum }
    if (prior && claim) {
      changes.push({ ...base, kind: 'CHANGED', oldChecksum: prior.sourceChecksum, fields: changedFields(prior.data, entity.data), target: target(claim) })
    } else if (claim) {
      // Present in PW2 but not built from the old snapshot (e.g. moved from another store); reconciled later.
      changes.push({ ...base, kind: 'CHANGED', oldChecksum: claim.sourceChecksum, fields: [], target: target(claim) })
    } else {
      changes.push({ ...base, kind: 'NEW', oldChecksum: null, fields: [], target: null, ...(excluded.has(key) ? { recovered: true as const } : {}) })
    }
  }
  for (const entity of before.values()) {
    const claim = claims.get(ledgerKey(entity.sourceEntity, entity.sourceId))
    if (claim?.origin === 'delta' && claim.sourceChecksum === RETIRED_CHECKSUM) { unchanged++; continue }
    changes.push({ kind: 'GONE', storeId, collection: entity.collection, ref: entity.ref, sourceEntity: entity.sourceEntity,
      sourceId: entity.sourceId, oldChecksum: entity.sourceChecksum, newChecksum: null, fields: [], target: target(claim) })
  }
  return { changes, unchanged }
}

/**
 * Ledger-only mode: claimed documents that the new snapshot no longer produces at all.
 * Documents a delta run already retired are skipped. `storeId` is the delta-ledger store or '' (unknown).
 */
export function ledgerGone(claims: ReadonlyMap<string, LedgerClaim>, seen: ReadonlySet<string>): EntityChange[] {
  const gone: EntityChange[] = []
  for (const [key, claim] of claims) {
    if (seen.has(key) || claim.sourceChecksum === RETIRED_CHECKSUM) continue
    const [sourceEntity, sourceId] = key.split('\u0000')
    const ownStore = ['stores', 'sites', 'store_logo', 'store_favicon'].includes(sourceEntity) ? sourceId : ''
    gone.push({ kind: 'GONE', storeId: claim.storeId ?? ownStore, collection: claim.targetCollection, ref: `@${claim.targetCollection}:${sourceEntity}:${sourceId}`,
      sourceEntity, sourceId, oldChecksum: claim.sourceChecksum, newChecksum: null, fields: [], target: target(claim) })
  }
  return gone
}

/**
 * An entity that left one store and appeared in another is an update of the same PW2 document,
 * not a delete plus a create.
 */
export function reconcileMoves(changes: EntityChange[]): EntityChange[] {
  const gone = new Map(changes.filter(change => change.kind === 'GONE').map(change => [change.ref, change]))
  const moved = new Set<string>()
  const result: EntityChange[] = []
  for (const change of changes) {
    if (change.kind === 'GONE') continue
    const from = gone.get(change.ref)
    if (from && from.storeId !== change.storeId && change.kind !== 'CHANGED') {
      moved.add(change.ref)
      result.push({ ...change, kind: from.target ? 'CHANGED' : 'NEW', oldChecksum: from.oldChecksum, target: from.target, movedFrom: from.storeId })
    } else {
      if (from && from.storeId !== change.storeId) moved.add(change.ref)
      result.push(from && from.storeId !== change.storeId ? { ...change, movedFrom: from.storeId } : change)
    }
  }
  for (const change of gone.values()) if (!moved.has(change.ref)) result.push(change)
  return result
}
