import { createMappedSourceAudit } from './mapped-source-audit'
import type { ClassificationRow } from './classification'
import type { UserActors } from './creator-bindings'
import { MigrationError } from './errors'
import type { ImportDiagnostic, ImportStore } from './types'

const key = (table: string, id: string) => JSON.stringify([table, id])
const unresolved = (row: ClassificationRow) => row.disposition === 'unresolved' || row.disposition === 'partial' || Object.values(row.fields).includes('unresolved')
const codes = new Set(['SOURCE_OWNERSHIP_UNRESOLVED', 'SOURCE_FIELDS_UNRESOLVED', 'REPORT_ROW_UNRESOLVED'])

/** Prove an orphan source row cannot affect the selected master dependency graph.
 * Unknown/global diagnostics without row evidence remain blocking.
 */
export function createSelectedSourceScope(actors?: UserActors, defaultShipping = false, delegateRawPageContent = false, delegateRawModelSettings = false) {
  const mappedAudit = createMappedSourceAudit(defaultShipping)
  const actorParents = new Map(actors?.actors.map(actor => [actor._ref, actor.createdBy]))
  const stores = new Set<string>(), dependencies = new Set<string>()
  const candidates = new Map<string, { table: string; parentTable: string; parentId: string; contributes: boolean }>()
  const totals = new Map<string, number>(), excluded = new Map<string, number>()
  const outside = new Set<string>()
  let bytes = 0, finished = false
  const charge = (value: string) => {
    bytes += 96 + Buffer.byteLength(value) * 2
    if (bytes > 64 * 1024 * 1024 || dependencies.size + candidates.size > 1_000_000) throw new MigrationError('SOURCE_SCOPE_MEMORY_LIMIT')
  }
  const reference = (initial: string): void => {
    let value: string | undefined = initial
    while (value) {
      const match = /^@[^:]+:([^:]+):([^:]+)$/.exec(value)
      if (!match) return
      const identity = key(match[1], match[2])
      if (dependencies.has(identity)) return
      charge(identity); dependencies.add(identity)
      value = actorParents.get(value)
    }
  }
  const visit = (value: unknown): void => {
    if (typeof value === 'string') reference(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  return {
    addStore(store: ImportStore): void {
      if (finished) throw new MigrationError('SOURCE_SCOPE_ALREADY_FINISHED')
      mappedAudit.addStore(store)
      stores.add(store.storeId)
      for (const [collection, documents] of Object.entries(store.collections)) {
        if (collection === 'pages') continue
        for (const document of documents) {
          // These Site archives are also excluded by the operational projection.
          if (collection === 'sites') {
            const { pw1_source: _archive, menus: _menus, ...operational } = document
            if(delegateRawPageContent)delete operational.raw_frontend_template
            if(delegateRawModelSettings)delete operational.raw_model_settings
            visit(operational)
          } else visit(document)
        }
      }
    },
    addRow(row: ClassificationRow): void {
      if (finished) throw new MigrationError('SOURCE_SCOPE_ALREADY_FINISHED')
      mappedAudit.addRow(row)
      const identity = key(row.table, row.sourceId)
      if (row.storeId !== null || !unresolved(row)) return
      totals.set(row.table, (totals.get(row.table) ?? 0) + 1)
      const owner = row.ownership
      if (owner.rule !== 'OWNERSHIP_PARENT_UNVERIFIED' || !owner.parentTable || !owner.parentId) return
      charge(identity + owner.parentTable + owner.parentId)
      // Only orphan candidates need contribution membership. A present parent
      // is already protected by sourceExists, so retaining every contributing
      // source row duplicates the full report without strengthening the proof.
      candidates.set(identity, { table: row.table, parentTable: owner.parentTable, parentId: owner.parentId,
        contributes: row.contributions.some(contribution => Boolean(contribution.storeId && stores.has(contribution.storeId))) })
    },
    finish(sourceExists: (table: string, id: string) => boolean): void {
      if (finished) throw new MigrationError('SOURCE_SCOPE_ALREADY_FINISHED')
      finished = true
      for (const [identity, row] of candidates) {
        if (row.contributes || sourceExists(row.parentTable, row.parentId) || dependencies.has(identity) || dependencies.has(key(row.parentTable, row.parentId))) continue
        outside.add(identity)
        excluded.set(row.table, (excluded.get(row.table) ?? 0) + 1)
      }
      candidates.clear(); dependencies.clear(); actorParents.clear(); stores.clear()
    },
    disposition(d: ImportDiagnostic): 'OUT_OF_SCOPE' | undefined {
      if (finished) { const mapped = mappedAudit.disposition(d); if (mapped) return mapped }
      if (!finished || d.storeId || !d.table || d.field !== undefined || d.severity !== 'blocker' || !codes.has(d.code)) return undefined
      if (d.code === 'SOURCE_OWNERSHIP_UNRESOLVED' ? d.reason !== 'OWNERSHIP_PARENT_UNVERIFIED' : d.reason !== undefined) return undefined
      if (d.sourceId) return outside.has(key(d.table, d.sourceId)) ? 'OUT_OF_SCOPE' : undefined
      // A table summary is excluded only if every underlying unresolved row is proven unrelated.
      if (d.code !== 'SOURCE_OWNERSHIP_UNRESOLVED' && (totals.get(d.table) ?? 0) > 0 && excluded.get(d.table) === totals.get(d.table)) return 'OUT_OF_SCOPE'
      return undefined
    },
  }
}
