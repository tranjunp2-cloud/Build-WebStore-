/**
 * Applies classified changes store by store. Each store is one transaction: business writes and the
 * delta ledger rows commit together, a failing store rolls back alone and the run continues.
 */
import type { CollectionSlug, PayloadRequest, SanitizedCollectionConfig } from 'payload'
import { checksum, resolveData, targetProjectionMatches, type Entity } from '../pw1-json/projection'
import type { SourceCredential } from '../pw1-json/types'
import { compareStoreIds } from '../pw1-json/selectors'
import { priorProjection, upsertMap, type MapEntry } from './delta-ledger'
import type { DeltaRuntime } from './delta-runtime'
import { createDocument, DeltaWriteError, RETIRE_PATCH, retireDocument, updateDocument } from './delta-writer'
import type { EntityChange } from './entity-diff'
import { RETIRED_CHECKSUM } from './entity-diff'
import { storeEntities, type Log, type PreparedSide } from './source-pipeline'
import type { TargetResolver } from './delta-targets'

/** Reported only in the 28/10 scope; never written. */
const CONFLICTS = new Set(['PW2_EDITED_CONFLICT', 'SITE_WEBSITE_GENERATED', 'TARGET_MISSING', 'PROJECTION_MISSING'])

export const REPORT_ONLY = new Set(['discounts', 'discount_usage_history', 'plan-subscription-usages', 'email-template-settings'])

export interface ApplyOutcome {
  storeId: string; ref: string; collection: string; kind: EntityChange['kind']
  outcome: 'written' | 'report-only' | 'conflict' | 'failed'; targetId?: number; code?: string; passwordResetRequired?: boolean
}

interface ApplyContext {
  runtime: DeltaRuntime; runId: string; sourceInstance: string; next: PreparedSide; configs: Record<string, SanitizedCollectionConfig>
  resolver: TargetResolver; credentials: Map<string, SourceCredential>; websiteStores: ReadonlySet<string>; log: Log
}

function errorCode(error: unknown): string {
  if (error instanceof DeltaWriteError) return error.code
  const message = error instanceof Error ? error.message : String(error)
  return message.split(/[:\s]/)[0] || 'WRITE_FAILED'
}

/** The given keys of the live document (depth 0, same read as the edit guard). */
async function liveProjection(runtime: DeltaRuntime, req: Partial<PayloadRequest>, collection: string, id: number, keys: string[]): Promise<Record<string, unknown> | null> {
  const doc = await runtime.payload.findByID({ collection: collection as CollectionSlug, id, depth: 0, overrideAccess: true, disableErrors: true, req, showHiddenFields: false }) as Record<string, unknown> | null
  if (!doc) return null
  return Object.fromEntries([...new Set(keys)].filter(key => key in doc).map(key => [key, doc[key]]))
}

async function applyStore(context: ApplyContext, storeId: string, changes: EntityChange[], clock: string): Promise<ApplyOutcome[]> {
  const { runtime, resolver } = context
  const byRef = new Map(changes.map(change => [change.ref, change]))
  const outcomes: ApplyOutcome[] = []
  const pending = new Map<string, number>()
  const written: { entity: Entity | null; entry: MapEntry; keys?: string[]; fallback?: Record<string, unknown> | null }[] = []
  await runtime.transaction(async (req, client) => {
    const deferred: { entity: Entity; id: number }[] = []
    // A store with only vanished documents (possibly 'unknown') needs no rebuilt entities.
    const entities = changes.some(change => change.kind !== 'GONE') ? await storeEntities(context.next, storeId, context.configs) : []
    for (const entity of entities) {
      const change = byRef.get(entity.ref)
      if (!change || change.kind === 'GONE') continue
      if (REPORT_ONLY.has(entity.collection)) { outcomes.push({ storeId, ref: entity.ref, collection: entity.collection, kind: change.kind, outcome: 'report-only' }); continue }
      if (change.kind === 'NEW') {
        const result = await createDocument(runtime, req, client, entity, resolver.targetsFor(entity, pending), context.credentials, clock)
        pending.set(entity.ref, result.id)
        if (result.deferred) deferred.push({ entity, id: result.id })
        outcomes.push({ storeId, ref: entity.ref, collection: entity.collection, kind: 'NEW', outcome: 'written', targetId: result.id,
          ...(result.passwordResetRequired === undefined ? {} : { passwordResetRequired: result.passwordResetRequired }) })
        written.push({ entity, entry: { sourceEntity: entity.sourceEntity, sourceId: entity.sourceId, storeId, targetCollection: entity.collection, targetId: String(result.id), sourceChecksum: entity.sourceChecksum, targetChecksum: '', action: 'CREATE', projection: null } })
        continue
      }
      const id = Number(change.target!.id)
      try {
        if (entity.collection === 'sites' && context.websiteStores.has(storeId)) throw new DeltaWriteError('SITE_WEBSITE_GENERATED', `store ${storeId}`)
        // Edit guard: the live document must still equal what the import (or a previous delta) wrote.
        const previous = await priorProjection(client, context.sourceInstance, change.target!.origin, entity.sourceEntity, entity.sourceId)
        // Without a recorded projection the guard cannot tell a PW2 edit apart, so nothing is overwritten.
        if (!previous) throw new DeltaWriteError('PROJECTION_MISSING', entity.ref)
        const result = await updateDocument(runtime, req, client, entity, id, resolver.targetsFor(entity, pending), previous)
        if (result.deferred) deferred.push({ entity, id })
      } catch (error) {
        // Conflicts are detected by reads before any write, so the transaction is still usable.
        if (!(error instanceof DeltaWriteError) || !CONFLICTS.has(error.code)) throw error
        outcomes.push({ storeId, ref: entity.ref, collection: entity.collection, kind: 'CHANGED', outcome: 'conflict', targetId: id, code: error.code })
        continue
      }
      outcomes.push({ storeId, ref: entity.ref, collection: entity.collection, kind: 'CHANGED', outcome: 'written', targetId: id })
      written.push({ entity, entry: { sourceEntity: entity.sourceEntity, sourceId: entity.sourceId, storeId, targetCollection: entity.collection, targetId: String(id), sourceChecksum: entity.sourceChecksum, targetChecksum: '', action: 'UPDATE', projection: null } })
    }
    // Relationships to documents created later in this store are completed once every create exists.
    for (const item of deferred) await updateDocument(runtime, req, client, item.entity, item.id, resolver.targetsFor(item.entity, pending), null, false)
    for (const change of changes.filter(row => row.kind === 'GONE')) {
      if (!change.target) continue
      const targetId = Number(change.target.id)
      const prior = await priorProjection(client, context.sourceInstance, change.target.origin, change.sourceEntity, change.sourceId)
      const base = { storeId, ref: change.ref, collection: change.collection, kind: 'GONE' as const, targetId }
      // Recorded either way (RETIRED checksum) so later runs do not list it again; the projection stays the
      // pre-removal baseline, so a PW2 edit is still detected if the document comes back in PW1.
      const entry = { sourceEntity: change.sourceEntity, sourceId: change.sourceId, storeId, targetCollection: change.collection, targetId: change.target.id, sourceChecksum: RETIRED_CHECKSUM }
      const patch = RETIRE_PATCH[change.collection]
      let code: string | undefined
      if (patch) {
        const live = prior ? await liveProjection(runtime, req, change.collection, targetId, Object.keys(prior)) : null
        if (!prior) code = 'PROJECTION_MISSING'
        else if (!live) code = 'TARGET_MISSING'
        else if (!targetProjectionMatches(prior, live)) code = 'PW2_EDITED_CONFLICT'
      }
      if (!patch || code) {
        outcomes.push({ ...base, outcome: code ? 'conflict' : 'report-only', ...(code ? { code } : {}) })
        written.push({ entity: null, entry: { ...entry, targetChecksum: prior ? checksum(prior) : '', action: 'REPORTED', projection: null }, keys: [], fallback: prior })
        continue
      }
      await retireDocument(runtime, req, change.collection, targetId)
      outcomes.push({ ...base, outcome: 'written' })
      written.push({ entity: null, entry: { ...entry, targetChecksum: checksum(patch), action: 'RETIRE', projection: null },
        keys: [...Object.keys(prior ?? {}), ...Object.keys(patch)], fallback: prior })
    }
    for (const { entity, entry, keys, fallback } of written) {
      // The projection is read back from the live document after every write (hooks, timestamps, deferred
      // relationships included), so the edit guard of a later run compares like with like.
      const projected = keys ?? (entity ? Object.keys(resolveData(entity, resolver.targetsFor(entity, pending), true).data) : [])
      const projection = projected.length ? await liveProjection(runtime, req, entry.targetCollection, Number(entry.targetId), projected) : fallback ?? null
      await upsertMap(client, context.runId, { ...entry, targetChecksum: projection ? checksum(projection) : entry.targetChecksum, projection })
    }
  })
  for (const [ref, id] of pending) resolver.created.set(ref, id)
  return outcomes
}

export async function applyChanges(context: ApplyContext, changes: EntityChange[]): Promise<ApplyOutcome[]> {
  const clock = new Date().toISOString()
  const byStore = new Map<string, EntityChange[]>()
  for (const change of changes) byStore.set(change.storeId, [...(byStore.get(change.storeId) ?? []), change])
  // Numeric PW1 store ids in order; documents whose store could not be resolved ('unknown') go last.
  const numeric = (id: string) => /^\d+$/.test(id)
  const stores = [...byStore.keys()].sort((a, b) => numeric(a) && numeric(b) ? compareStoreIds(a, b) : Number(numeric(b)) - Number(numeric(a)) || a.localeCompare(b))
  const outcomes: ApplyOutcome[] = []
  for (const [index, storeId] of stores.entries()) {
    const storeChanges = byStore.get(storeId)!
    try {
      outcomes.push(...await applyStore(context, storeId, storeChanges, clock))
    } catch (error) {
      const code = errorCode(error)
      for (const change of storeChanges) outcomes.push({ storeId, ref: change.ref, collection: change.collection, kind: change.kind,
        outcome: 'failed', code })
      context.log(`  store ${storeId}: rolled back (${code})`)
    }
    if ((index + 1) % 50 === 0 || index + 1 === stores.length) context.log(`  applied ${index + 1}/${stores.length} stores`)
  }
  return outcomes
}
