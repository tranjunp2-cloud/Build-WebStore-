import type { Row } from '../contracts'

// CSV tables are immutable for one export. Keep source Row references, never mapped
// documents: mapping still records each Store/path's diagnostics and contributions.
const indexes = new WeakMap<Row[], Map<string, Map<string | null, Row[]>>>()

export function matchingRows(rows: Row[], field: string, value: string): Row[] {
  let fields = indexes.get(rows)
  if (!fields) {
    fields = new Map()
    indexes.set(rows, fields)
  }
  let groups = fields.get(field)
  if (!groups) {
    groups = new Map()
    for (const row of rows) {
      const key = row[field]
      // Missing columns cannot match a string lookup; null stays distinct from ''.
      if (key === undefined) continue
      const group = groups.get(key)
      if (group) group.push(row)
      else groups.set(key, [row])
    }
    fields.set(field, groups)
  }
  // Callers sort matches; never expose the cached grouping array to mutation.
  return (groups.get(value) ?? []).slice()
}

// Stable per-model groups make the second index reusable across parent lookups.
const settingsIndexes = new WeakMap<Row[], Map<string, Map<string, Row[]>>>()
export function matchingSettings(
  rows: Row[],
  model: string,
  id: string,
): Row[] {
  let models = settingsIndexes.get(rows)
  if (!models) {
    models = new Map()
    for (const row of rows) {
      if (
        typeof row.model_type !== 'string' ||
        typeof row.model_id !== 'string'
      )
        continue
      let ids = models.get(row.model_type)
      if (!ids) {
        ids = new Map()
        models.set(row.model_type, ids)
      }
      const group = ids.get(row.model_id)
      if (group) group.push(row)
      else ids.set(row.model_id, [row])
    }
    settingsIndexes.set(rows, models)
  }
  return (models.get(model)?.get(id) ?? []).slice()
}
