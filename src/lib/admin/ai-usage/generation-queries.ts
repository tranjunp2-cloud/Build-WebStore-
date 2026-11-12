/**
 * "Website generation" section: finished site generations from `ai_generation_records`.
 *
 * Counted: endpoint `site-generator`, status success|failed, not cancelled, not a form rejection.
 * Not counted (reported as exclusions): status `running` (still running or stuck), rejected forms (first error code
 * FORM_INVALID, written by captureRejectedWebsiteGeneration), and every other endpoint (e.g. `generate-meta` SEO rows).
 * Failure reason = the real incident code (generation_errors), else a failed page's code, else "No code recorded".
 */
import { type SQL, sql } from 'drizzle-orm'
import { inAreaGroupSql } from './groups'
import { num, numOrNull, pctChange } from './format'
import type { Period } from './period'
import { inWindow, rowsOf, type ReportsDb } from './sql-parts'

export const NO_CODE = 'No code recorded'
const SITE_ENDPOINT = 'site-generator'

type Row = Record<string, unknown>

const rejectedSql = (): SQL => sql`EXISTS (SELECT 1 FROM ai_generation_records_generation_errors e WHERE e._parent_id = r.id AND e.code = 'FORM_INVALID')`
const windowOf = (start: Date, end: Date): SQL => sql`r.created_at >= ${start.toISOString()}::timestamptz AND r.created_at < ${end.toISOString()}::timestamptz`
const finishedSql = (): SQL => sql`r.endpoint = ${SITE_ENDPOINT} AND r.status IN ('success', 'failed') AND r.outcome IS DISTINCT FROM 'cancelled' AND NOT ${rejectedSql()}`

export interface GenerationStats {
    finished: number
    succeeded: number
    successRate: number | null
    medianMs: number | null
    /** cost of the Website setup area ÷ successes; null when nothing succeeded or no cost recorded */
    costPerSuccess: number | null
    websiteSetupCost: number
}

export interface GenerationExclusions {
    running: number
    rejected: number
    otherEndpoints: number
}

export interface GenerationSection {
    current: GenerationStats
    previous: GenerationStats
    finishedDeltaPct: number | null
    exclusions: GenerationExclusions
    failReasons: Array<{ code: string; count: number }>
    failedTotal: number
    recentFailed: Array<{ id: number; shop: string; code: string; at: string; durationMs: number | null }>
}

export async function getGenerationStats(db: ReportsDb, start: Date, end: Date): Promise<GenerationStats> {
    const [gen] = await rowsOf<Row>(db, sql`
        SELECT COUNT(*) AS finished, COUNT(*) FILTER (WHERE r.status = 'success') AS succeeded,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY r.duration_ms) AS median_ms
        FROM ai_generation_records r WHERE ${windowOf(start, end)} AND ${finishedSql()}`)
    const [cost] = await rowsOf<Row>(db, sql`
        SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM ai_usage_logs WHERE ${inWindow(start, end)} AND ${inAreaGroupSql('website-setup')}`)
    const finished = num(gen?.finished), succeeded = num(gen?.succeeded), websiteSetupCost = num(cost?.cost)
    return {
        finished, succeeded, websiteSetupCost,
        successRate: finished > 0 ? (succeeded / finished) * 100 : null,
        medianMs: numOrNull(gen?.median_ms),
        costPerSuccess: succeeded > 0 && websiteSetupCost > 0 ? websiteSetupCost / succeeded : null,
    }
}

export async function getGenerationSection(db: ReportsDb, period: Period): Promise<GenerationSection> {
    const [current, previous, [excl], reasons, recent] = await Promise.all([
        getGenerationStats(db, period.start, period.end),
        getGenerationStats(db, period.prevStart, period.prevEnd),
        rowsOf<Row>(db, sql`
            SELECT COUNT(*) FILTER (WHERE r.endpoint = ${SITE_ENDPOINT} AND r.status = 'running') AS running,
                   COUNT(*) FILTER (WHERE r.endpoint = ${SITE_ENDPOINT} AND r.status <> 'running' AND ${rejectedSql()}) AS rejected,
                   COUNT(*) FILTER (WHERE r.endpoint <> ${SITE_ENDPOINT}) AS other
            FROM ai_generation_records r WHERE ${windowOf(period.start, period.end)}`),
        rowsOf<Row>(db, sql`
            SELECT ${failCodeSql()} AS code, COUNT(*) AS n
            FROM ai_generation_records r WHERE ${windowOf(period.start, period.end)} AND ${finishedSql()} AND r.status = 'failed'
            GROUP BY 1 ORDER BY n DESC, code ASC LIMIT 8`),
        rowsOf<Row>(db, sql`
            SELECT r.id, t.name AS shop, ${failCodeSql()} AS code, r.created_at, r.duration_ms
            FROM ai_generation_records r LEFT JOIN tenants t ON t.id = r.tenant_id
            WHERE ${windowOf(period.start, period.end)} AND ${finishedSql()} AND r.status = 'failed'
            ORDER BY r.created_at DESC, r.id DESC LIMIT 5`),
    ])
    const failReasons = reasons.map((r) => ({ code: String(r.code), count: num(r.n) }))
    return {
        current, previous,
        finishedDeltaPct: pctChange(current.finished, previous.finished),
        exclusions: { running: num(excl?.running), rejected: num(excl?.rejected), otherEndpoints: num(excl?.other) },
        failReasons,
        failedTotal: current.finished - current.succeeded,
        recentFailed: recent.map((r) => ({
            id: num(r.id), shop: r.shop ? String(r.shop) : 'Unknown shop', code: String(r.code),
            at: new Date(String(r.created_at)).toISOString(), durationMs: numOrNull(r.duration_ms),
        })),
    }
}

/** The real failure code of a record: first incident code, else the first failed page's code, else NO_CODE. */
function failCodeSql(): SQL {
    return sql`COALESCE(
        (SELECT e.code FROM ai_generation_records_generation_errors e WHERE e._parent_id = r.id AND e.code IS NOT NULL ORDER BY e._order LIMIT 1),
        (SELECT p.error_code FROM ai_generation_records_page_outcomes p WHERE p._parent_id = r.id AND p.status = 'failed' AND p.error_code IS NOT NULL ORDER BY p._order LIMIT 1),
        ${NO_CODE})`
}
