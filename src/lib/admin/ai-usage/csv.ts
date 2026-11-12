/** CSV for the Logs export. Text cells are escaped (RFC 4180) and defused against spreadsheet formula injection. */
import type { LogRow } from './log-queries'
import { AREA_GROUP_LABELS, PLAN_GROUP_LABELS } from './groups'

/** A text cell: quote when needed and prefix `'` when a spreadsheet would read it as a formula. */
export function csvText(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') return ''
    let text = String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A numeric cell; null/NaN stay empty (an unpriced call has no cost, not $0). */
export const csvNumber = (value: number | null | undefined): string =>
    value === null || value === undefined || !Number.isFinite(value) ? '' : String(value)

export const CSV_HEADER = [
    'id', 'time_utc', 'shop_id', 'shop', 'user_email', 'plan', 'area', 'task', 'summary', 'provider', 'model',
    'tokens_in', 'cached_tokens_in', 'tokens_out', 'cost_usd', 'battery_cost_usd', 'duration_ms', 'outcome', 'error_code', 'run_id',
].join(',')

export function csvLine(row: LogRow): string {
    return [
        csvNumber(row.id), csvText(row.at), csvNumber(row.tenantId), csvText(row.shop), csvText(row.userEmail),
        csvText(PLAN_GROUP_LABELS[row.plan]), csvText(AREA_GROUP_LABELS[row.areaGroup]), csvText(row.taskLabel), csvText(row.summary),
        csvText(row.provider), csvText(row.model), csvNumber(row.tokensIn), csvNumber(row.cachedTokensIn), csvNumber(row.tokensOut),
        csvNumber(row.costUsd), csvNumber(row.batteryCostUsd), csvNumber(row.durationMs), csvText(row.outcome), csvText(row.errorCode), csvText(row.runId),
    ].join(',')
}

export const buildCsv = (rows: LogRow[]): string => [CSV_HEADER, ...rows.map(csvLine)].join('\r\n') + '\r\n'
