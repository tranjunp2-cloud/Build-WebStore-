/**
 * /studio/performance/logs — every AI call, newest first, with server-side filters and a detail drawer.
 * ?period|from&to  ?q ?plan ?area ?task ?model ?outcome ?unpriced=1  ?limit=25..500 (Load more)  ?log=<id> (drawer)
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'
import { Download } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { fmtInt, fmtUsd } from '@/lib/admin/ai-usage/format'
import { hasActiveFilters, logsQuery, MAX_ROWS, PAGE_SIZE, parseLimit, parseLogFilters } from '@/lib/admin/ai-usage/log-filters'
import { getFilterOptions, getLogById, getLogRows, getLogTotals, getRunSiblings } from '@/lib/admin/ai-usage/log-queries'
import { first, klDay, rangeLabel, resolvePeriod } from '@/lib/admin/ai-usage/period'
import type { ReportsDb } from '@/lib/admin/ai-usage/sql-parts'
import '../ai-usage.css'
import { EmptyState, ErrorState } from '../_components/au-parts'
import { LogDrawer } from '../_components/log-drawer'
import { LogsFilters } from '../_components/logs-filters'
import { LogsTable } from '../_components/logs-table'
import { PeriodControls } from '../_components/period-controls'

export const metadata: Metadata = { title: 'AI logs' }

export default async function AiLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireSuperAdmin()
    const sp = await searchParams
    const period = resolvePeriod(sp)
    const filters = parseLogFilters(sp)
    const limit = parseLimit(sp)
    const logId = Number(first(sp.log))
    const base = (extra: Record<string, string | undefined> = {}) => logsQuery(period, filters, extra).toString()
    const url = (extra: Record<string, string | undefined> = {}) => { const q = base(extra); return `/studio/performance/logs${q ? `?${q}` : ''}` }
    const withLimit = (extra: Record<string, string | undefined> = {}) => url({ limit: limit > PAGE_SIZE ? String(limit) : undefined, ...extra })

    let data: { rows: Awaited<ReturnType<typeof getLogRows>>; totals: Awaited<ReturnType<typeof getLogTotals>>; options: Awaited<ReturnType<typeof getFilterOptions>>; log: Awaited<ReturnType<typeof getLogById>>; siblings: Awaited<ReturnType<typeof getRunSiblings>> } | null = null
    try {
        const db = (await getPayload({ config })) as unknown as ReportsDb
        const [rows, totals, options, log] = await Promise.all([
            getLogRows(db, filters, period, limit), getLogTotals(db, filters, period), getFilterOptions(db, period),
            Number.isSafeInteger(logId) && logId > 0 ? getLogById(db, logId) : Promise.resolve(null),
        ])
        const siblings = log?.runId ? await getRunSiblings(db, log.runId, log.id) : []
        data = { rows, totals, options, log, siblings }
    } catch (error) {
        console.error('[ai-usage] logs failed', error)
    }

    return (
        <div className="page au-page">
            <div className="page-head">
                <div><h1 className="page-title">AI logs</h1><p className="page-sub">Every AI call from all shops. {rangeLabel(period)}, Malaysia time.</p></div>
                <PeriodControls periodKey={period.key} rangeText={rangeLabel(period)} fromDay={period.fromDay} toDay={period.toDay} todayDay={klDay(new Date())} />
            </div>
            {!data ? <ErrorState what="the AI logs" retryHref={withLimit()} /> : (
                <>
                    <LogsFilters filters={filters} options={data.options} />
                    <div className="au-sumbar" aria-live="polite">
                        <span><b>{fmtInt(data.totals.calls)}</b> calls</span><span><b>{fmtUsd(data.totals.cost)}</b> cost</span>
                        <span><b>{fmtInt(data.totals.errors)}</b> errors</span>
                        {data.totals.unpriced > 0 && <span><b>{fmtInt(data.totals.unpriced)}</b> unpriced</span>}
                        <span className="au-muted-txt">{hasActiveFilters(filters) ? 'matching the filters' : 'in this period'}</span>
                        <a className="btn btn-sm" style={{ marginLeft: 'auto' }} href={`/api/admin/ai-usage/export?${base()}`} download><Download size={14} />Export CSV</a>
                    </div>
                    <section className="card">
                        {data.rows.length === 0 ? (
                            <EmptyState title="No AI calls match" text={hasActiveFilters(filters) ? 'Try a wider period or clear a filter.' : 'No AI calls were recorded in this period.'} />
                        ) : (
                            <>
                                <LogsTable rows={data.rows} selectedId={data.log?.id} hrefFor={(id) => withLimit({ log: String(id) })} />
                                <div className="au-load">
                                    <span>Showing {fmtInt(data.rows.length)} of {fmtInt(data.totals.calls)}</span>
                                    {data.rows.length < data.totals.calls && limit < MAX_ROWS ? <Link className="btn btn-sm" href={url({ limit: String(limit + PAGE_SIZE) })} scroll={false}>Load more</Link>
                                        : data.rows.length < data.totals.calls ? <span>Narrow the filters or export the CSV to see the rest.</span> : null}
                                </div>
                            </>
                        )}
                    </section>
                    {data.log && <LogDrawer log={data.log} siblings={data.siblings} closeHref={withLimit()} hrefFor={(id) => withLimit({ log: String(id) })} />}
                </>
            )}
        </div>
    )
}
