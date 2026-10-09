import type {
  Row,
  MappingContext,
  SourceConfig,
  StoreOutput,
  Diagnostic,
  Contribution,
} from './contracts'
import { live } from './contracts'
import { ExportError, compareIds } from './primitives'
export class SourceIndex {
  readonly byId = new Map<string, Map<string, Row>>()
  readonly byStore = new Map<string, Map<string, Row[]>>()
  constructor(readonly tables: Record<string, Row[]>) {
    for (const [table, rows] of Object.entries(tables)) {
      const ids = new Map<string, Row>(),
        stores = new Map<string, Row[]>()
      for (const row of rows) {
        if (Object.hasOwn(row, 'id')) {
          if (!row.id || ids.has(row.id))
            throw new ExportError('DUPLICATE_OR_EMPTY_SOURCE_ID')
          ids.set(row.id, row)
        }
        if (row.store_id) {
          const group = stores.get(row.store_id) ?? []
          group.push(row)
          stores.set(row.store_id, group)
        }
      }
      // Known no-PK Spatie pivots use explicit composite identity.
      const keys =
        table === 'model_has_roles'
          ? ['model_type', 'model_id', 'role_id']
          : table === 'model_has_permissions'
            ? ['model_type', 'model_id', 'permission_id']
            : table === 'role_has_permissions'
              ? ['role_id', 'permission_id']
              : null
      if (keys) {
        const seen = new Set<string>()
        for (const row of rows) {
          if (keys.some((k) => !row[k]))
            throw new ExportError('EMPTY_COMPOSITE_KEY')
          const key = JSON.stringify(keys.map((k) => row[k]))
          if (seen.has(key)) throw new ExportError('DUPLICATE_COMPOSITE_KEY')
          seen.add(key)
        }
      }
      this.byId.set(table, ids)
      this.byStore.set(table, stores)
    }
  }
  context(
    config: SourceConfig,
    storeId: string,
    output: StoreOutput,
    diagnostics: Diagnostic[],
    contributions: Contribution[],
  ): MappingContext {
    return {
      config,
      tables: this.tables,
      storeId,
      output,
      diagnostics,
      contributions,
      rows: (table, includeDeleted = false) =>
        (this.byStore.get(table)?.get(storeId) ?? [])
          .filter((r) => includeDeleted || live(r))
          .slice()
          .sort((a, b) => compareIds(a.id ?? '', b.id ?? '')),
      find: (table, id) => (id ? this.byId.get(table)?.get(id) : undefined),
      issue: (code, table, sourceId, field, severity = 'blocker', reason) => {
        diagnostics.push({
          code,
          severity,
          storeId,
          ...(table ? { table } : {}),
          ...(sourceId ? { sourceId } : {}),
          ...(field ? { field } : {}),
          ...(reason ? { reason } : {}),
        })
      },
      contribute: (table, row, fields, targetPath, rule) => {
        contributions.push({
          storeId,
          table,
          sourceId:
            row.id ?? `record:${(this.tables[table] ?? []).indexOf(row) + 1}`,
          fields,
          targetPath,
          rule,
        })
      },
    }
  }
}
