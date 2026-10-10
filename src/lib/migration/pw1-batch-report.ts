import { groupMigrationWarnings } from './pw1-warning-groups'
import type { Client } from 'pg'

type Result = Record<string, unknown>
export type ReportAttempt = {
    source_store_id: string; status: string; stage: string; error_code: string | null
    brand_evidence?: unknown; brand_selection?: unknown; source_link_checks?: unknown; carousel_scan?: unknown; carousel_evidence?: unknown
    duration_seconds: number | null; design_tokens: number | null; model: string | null
    design_retries?: number | null; design_retry_reasons?: unknown
}
export function buildBatchReport(batch: { id: string; status: string; results: Result[]; started_at: string | Date; finished_at: string | Date | null; limits?: unknown }, attempts: ReportAttempt[]) {
    const results = [...batch.results]
    // Running/recovered attempts may not have reached the batch result append yet.
    const represented = new Set(results.map(r => r.sourceStoreId))
    const latest = new Map<string, ReportAttempt>()
    for (const attempt of attempts) latest.set(attempt.source_store_id, attempt)
    for (const [sourceStoreId, attempt] of latest) {
        if (!represented.has(sourceStoreId)) results.push({ sourceStoreId, status: attempt.status, stage: attempt.stage, code: attempt.error_code })
    }
    const stores = results.map(result => {
        const related = attempts.filter(a => a.source_store_id === result.sourceStoreId)
        const timed = related.filter(a => a.duration_seconds !== null)
        const measured = related.filter(a => a.design_tokens !== null)
        return { ...result, warningGroups: groupMigrationWarnings(result.warnings), status: result.status ?? (result.error ? 'failed' : 'unknown'), attempts: related.length,
            attemptSeconds: timed.length ? timed.reduce((sum, a) => sum + Number(a.duration_seconds), 0) : null,
            observedDesignTokens: measured.length ? measured.reduce((sum, a) => sum + Number(a.design_tokens), 0) : null,
            models: [...new Set(related.map(a => a.model).filter(Boolean))],
            designRetries: related.reduce((sum, a) => sum + Number(a.design_retries ?? 0), 0),
            designRetryReasons: related.flatMap(a => Array.isArray(a.design_retry_reasons) ? a.design_retry_reasons : []),
        }
    })
    return { batchId: batch.id, status: batch.status, startedAt: batch.started_at, finishedAt: batch.finished_at,
        durationSeconds: batch.finished_at ? (new Date(batch.finished_at).getTime() - new Date(batch.started_at).getTime()) / 1000 : null,
        limits: batch.limits ?? {}, stores, attempts,
        totals: { stores: stores.length,
            published: results.filter(r => ['published','already-published'].includes((r.publish as {status?:string}|undefined)?.status ?? '')).length,
            keptDraft: results.filter(r => (r.publish as {status?:string}|undefined)?.status === 'kept-draft').length,
            publishFailed: results.filter(r => ['failed','deferred'].includes((r.publish as {status?:string}|undefined)?.status ?? '')).length, completed: stores.filter(s => String(s.status).startsWith('completed')).length,
            failed: stores.filter(s => s.status === 'failed').length, skipped: stores.filter(s => s.status === 'skipped').length,
            running: stores.filter(s => s.status === 'running').length, deferred: stores.filter(s => s.status === 'deferred').length, attempts: attempts.length,
            observedDesignTokens: attempts.some(a => a.design_tokens !== null) ? attempts.reduce((sum, a) => sum + Number(a.design_tokens ?? 0), 0) : null,
            designRetries: attempts.reduce((sum, a) => sum + Number(a.design_retries ?? 0), 0) },
        costUsd: null,
        usageScope: 'Observed native-design responses only (designRetries counts paid re-generations after layout validation failed). Visual brand-analysis model/tokens are recorded separately in each attempt brand_evidence.analysisModel/analysisTokens and in ai_usage_logs endpoint brand-analysis (reused evidence across retries is not a new call). Excludes credit probes, translation, provider retries without a response and other AI calls; null means not measured. Not a billing report.',
    }
}

/** Quote every cell and neutralize spreadsheet formulas, including leading whitespace/control characters. */
export function csvCell(value: unknown) {
    let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
}
export function batchReportCsv(report: ReturnType<typeof buildBatchReport>) {
    const keys = ['sourceStoreId','inputIndex','status','siteId','attempts','attemptSeconds','observedDesignTokens','designRetries','designRetryReasons','models','code','error','warnings','warningGroups','readiness','beMapping','mediaCleanup','publish']
    return [keys.map(csvCell).join(','), ...report.stores.map(store => keys.map(key => csvCell((store as Result)[key])).join(','))].join('\r\n') + '\r\n'
}
export async function readBatchReport(client: Client, id: string) {
    const { rows } = await client.query('SELECT * FROM pw1_migration_batches WHERE id=$1', [id])
    if (!rows.length) throw new Error('Migration batch not found')
    const attempts = await client.query<ReportAttempt>(`SELECT source_store_id,status,stage,error_code,
        EXTRACT(EPOCH FROM (finished_at-started_at))::float8 AS duration_seconds,
        (artifacts->'usage.json'->>'totalTokens')::float8 AS design_tokens,
        artifacts->'usage.json'->>'model' AS model,
        (artifacts->'usage.json'->>'designRetries')::int AS design_retries,
        artifacts->'design-retries.json' AS design_retry_reasons,
        artifacts->'source-link-checks.json' AS source_link_checks,
        artifacts->'carousel-scan.json' AS carousel_scan,
        artifacts->'carousel-evidence.json' AS carousel_evidence,
        (artifacts->'brand-evidence.json') - 'screenshot' - 'logoScreenshot' AS brand_evidence,
        artifacts->'brand-selection.json' AS brand_selection
        FROM pw1_migration_attempts WHERE batch_id=$1 ORDER BY started_at`, [id])
    return buildBatchReport(rows[0], attempts.rows)
}
