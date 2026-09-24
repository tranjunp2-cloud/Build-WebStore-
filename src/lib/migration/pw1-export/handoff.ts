import type { Diagnostic } from './contracts'
import { approvedReviewScope, reviewCategory } from './export-outcome'

type StoreSummary = { storeId: string; exportStatus: string }
type Status = 'excluded' | 'source_blocked' | 'global_review_required' | 'importer_verification_required' | 'source_diagnostics_clear'

/** Conservative source-diagnostic triage, never an importer preflight or permission to write DB. */
export function buildHandoff(stores: readonly StoreSummary[], diagnostics: readonly Diagnostic[], archive: ReadonlySet<string> = new Set()) {
  const scope = approvedReviewScope(diagnostics)
  const excluded = new Set(stores.filter(s => s.exportStatus === 'excluded').map(s => s.storeId))
  const local = new Map<string, Diagnostic[]>()
  const global: Diagnostic[] = []
  for (const d of diagnostics) {
    if (d.storeId) {
      const group = local.get(d.storeId) ?? []
      group.push(d); local.set(d.storeId, group)
    } else global.push(d)
  }
  const unresolved = (d: Diagnostic) => ['data_issue', 'import_requirement', 'warning'].includes(reviewCategory(d, archive, excluded, scope))
  const globalIssues = global.filter(unresolved)
  const evidence = (issues: Diagnostic[]) => {
    const groups = new Map<string, { code: string; table?: string; field?: string; reason?: string; category: string; count: number; sourceIds: string[] }>()
    for (const d of issues) {
      const category = reviewCategory(d, archive, excluded, scope)
      const key = JSON.stringify([category, d.code, d.table, d.field, d.reason])
      const group = groups.get(key) ?? { category, code: d.code, table: d.table, field: d.field, reason: d.reason, count: 0, sourceIds: [] }
      group.count++
      if (d.sourceId && group.sourceIds.length < 5 && !group.sourceIds.includes(d.sourceId)) group.sourceIds.push(d.sourceId)
      groups.set(key, group)
    }
    return [...groups.values()]
  }
  const rows = stores.map(store => {
    const issues = (local.get(store.storeId) ?? []).filter(unresolved)
    const data = issues.filter(d => reviewCategory(d, archive, excluded, scope) === 'data_issue')
    const status: Status = excluded.has(store.storeId) ? 'excluded'
      : store.exportStatus === 'blocked' || data.length ? 'source_blocked'
      : globalIssues.length ? 'global_review_required'
      : issues.length ? 'importer_verification_required' : 'source_diagnostics_clear'
    return { storeId: store.storeId, exportStatus: store.exportStatus, status, importReady: false,
      sourceDiagnosticCount: data.length, globalReviewRequired: status !== 'excluded' && globalIssues.length > 0,
      issues: evidence(issues) }
  })
  const counts: Record<Status, number> = { excluded: 0, source_blocked: 0, global_review_required: 0, importer_verification_required: 0, source_diagnostics_clear: 0 }
  for (const row of rows) counts[row.status]++
  return { version: 1, assessment: 'source_diagnostic_triage', importReady: false,
    limitation: 'Không thay importer preflight. source_diagnostics_clear chỉ nghĩa không còn diagnostic cần xử lý; importer vẫn xác minh classification/coverage, policy, credentials, creator binding và DB đích. Warning chưa được xác minh không tự động được bỏ qua. Global issues cần xác định phạm vi, không đồng nghĩa mọi Store có lỗi nguồn.',
    counts, globalIssues: evidence(globalIssues), stores: rows }
}
