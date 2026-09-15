'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import type { GenerationRecord, GenerationsFilters, GenerationsListResponse } from './generation-types'
import { GenerationDetailDrawer } from './generation-detail-drawer'

const POLL_INTERVAL_MS = 10_000
const labels: Record<string, string> = { cannot_recover: 'Cần ticket Dev', retryable: 'Có thể gen lại', retrying: 'Đang gen lại', stale_running: 'Đang treo', history: 'Lịch sử' }
function relativeTime(value: string) { const d = Date.now() - new Date(value).getTime(); return d < 60_000 ? 'vừa xong' : d < 3_600_000 ? `${Math.floor(d / 60_000)}m` : `${Math.floor(d / 3_600_000)}h` }
function buildUrl(f: GenerationsFilters) { const p = new URLSearchParams({ view: f.view, status: f.status, recoveryStatus: f.recoveryStatus, limit: String(f.limit) }); for (const [key, value] of Object.entries({ search: f.search, userId: f.userId, siteId: f.siteId, dateFrom: f.dateFrom, dateTo: f.dateTo, cursor: f.cursor })) if (value) p.set(key, value); return `/api/admin/generations?${p}` }

/**
 * Keeps the first occurrence of each record. The API uses a stable cursor, but
 * a record can still appear in a later response after its recovery state is
 * updated between polls. De-duplicating by ID makes "Tải thêm" safe in that
 * case without losing the order of already visible rows.
 */
export function appendUniqueGenerationRecords(current: GenerationRecord[], incoming: GenerationRecord[]) {
    const ids = new Set(current.map((record) => record.id))
    return [...current, ...incoming.filter((record) => !ids.has(record.id))]
}

function sameFilters(a: GenerationsFilters, b: GenerationsFilters) {
    return a.view === b.view && a.status === b.status && a.recoveryStatus === b.recoveryStatus
        && a.search === b.search && a.userId === b.userId && a.siteId === b.siteId
        && a.dateFrom === b.dateFrom && a.dateTo === b.dateTo
}

export function GenerationsLiveFeed({ initialData }: { initialData: GenerationsListResponse }) {
    const [data, setData] = useState(initialData), [filters, setFilters] = useState<GenerationsFilters>({ view: 'needs_attention', status: 'all', recoveryStatus: 'all', search: '', userId: '', siteId: '', dateFrom: '', dateTo: '', cursor: '', limit: 50 }), [loading, setLoading] = useState(false), [selected, setSelected] = useState<GenerationRecord | null>(null)
    const ref = useRef(filters); ref.current = filters
    const load = useCallback(async (f: GenerationsFilters, mode: 'replace' | 'append' | 'poll' = 'replace', manual = false) => {
        if (manual) setLoading(true)
        try {
            const response = await fetch(buildUrl(f))
            if (!response.ok || !sameFilters(f, ref.current)) return
            const next = await response.json() as GenerationsListResponse
            setData((current) => {
                if (mode === 'append') return { ...next, items: appendUniqueGenerationRecords(current.items, next.items) }
                if (mode === 'poll') {
                    const nextCursor = current.nextCursor ?? next.nextCursor
                    return {
                        ...next,
                        items: appendUniqueGenerationRecords(next.items, current.items),
                        nextCursor,
                        meta: { ...next.meta, hasNextPage: Boolean(nextCursor) },
                    }
                }
                return next
            })
        } finally { if (manual) setLoading(false) }
    }, [])
    useEffect(() => { void load(filters, 'replace', true) }, [filters, load])
    useEffect(() => { const id = setInterval(() => void load(ref.current, 'poll'), POLL_INTERVAL_MS); return () => clearInterval(id) }, [load])
    const update = <K extends keyof GenerationsFilters>(key: K, value: GenerationsFilters[K]) => setFilters((old) => ({ ...old, [key]: value, cursor: '' }))
    const loadMore = () => {
        if (!data.nextCursor || loading) return
        void load({ ...filters, cursor: data.nextCursor }, 'append', true)
    }
    return <div className="gen-page">
        <div className="page-head"><div><h1 className="page-title">User Generations</h1><p className="page-sub">Ưu tiên website cần xử lý. Dữ liệu lỗi đã được làm an toàn cho Operations.</p></div><button className="btn btn-sm" onClick={() => void load(filters, 'replace', true)} disabled={loading}><RefreshCw size={12} /> Refresh</button></div>
        <div className="gen-filters"><div className="gen-status-chips" role="tablist" aria-label="Generation views">{(['needs_attention', 'all'] as const).map((view) => <button key={view} role="tab" aria-selected={filters.view === view} className={`g-chip${filters.view === view ? ' active' : ''}`} onClick={() => update('view', view)}>{view === 'needs_attention' ? 'Needs Attention' : 'All generations'}</button>)}</div><div className="search-wrap"><Search size={13} /><input aria-label="Tìm generation" value={filters.search} onChange={(e) => update('search', e.target.value)} placeholder="Trace, endpoint, category…" /></div><select aria-label="Status" value={filters.status} onChange={(e) => update('status', e.target.value)}><option value="all">All status</option><option value="running">Running</option><option value="success">Success</option><option value="failed">Failed</option></select><select aria-label="Recovery status" value={filters.recoveryStatus} onChange={(e) => update('recoveryStatus', e.target.value)}><option value="all">All recovery</option><option value="eligible">Retryable</option><option value="ticket_required">Ticket required</option><option value="retrying">Retrying</option><option value="stale_running">Stale</option></select></div>
        <div className="gen-filters" aria-label="Bộ lọc nâng cao"><input aria-label="User ID" value={filters.userId} onChange={(e) => update('userId', e.target.value)} placeholder="User ID" /><input aria-label="Website ID" value={filters.siteId} onChange={(e) => update('siteId', e.target.value)} placeholder="Website ID" /><label>Từ <input aria-label="Từ ngày" type="datetime-local" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label><label>Đến <input aria-label="Đến ngày" type="datetime-local" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label></div>
        <div className="gen-list"><div className="gen-list-head"><div className="col col-time">Thời gian</div><div className="col col-user">User</div><div className="col col-template">Website</div><div className="col col-metrics">Page</div><div className="col col-prompt">Lỗi an toàn</div><div className="col col-status">Trạng thái</div></div><div className="gen-list-body scroll-thin">{data.items.length === 0 ? <div className="empty-state">Không có generation cần xử lý</div> : data.items.map((r: GenerationRecord) => <button type="button" onClick={() => setSelected(r)} className="gen-row" key={r.id} aria-label={`Xem generation ${r.id}`}><div className="gen-row-time"><span className="t">{relativeTime(r.submittedAt)}</span><span className="id">#{r.id}</span></div><div className="gen-row-user"><div className="n">{r.user.label}</div><div className="e">{r.user.missing ? 'Unknown user' : 'User'}</div></div><div className="gen-row-template"><div className="tn">{r.site.label}</div><div className="tm">{r.site.missing ? 'Unknown website' : 'Website'}</div></div><div className="gen-row-metrics" aria-label={`${r.pageSummary.persisted} of ${r.pageSummary.expected ?? 'unknown'} pages persisted; ${r.pageSummary.failed} failed`}>{r.pageSummary.persisted}/{r.pageSummary.expected ?? '?'} <small>{r.pageSummary.failed ? `${r.pageSummary.failed} lỗi` : ''}</small></div><div className="gen-row-prompt"><div className="prompt-text">{r.affectedError ? `${r.affectedError.code}: ${r.affectedError.summary}` : 'Không xác định'}</div></div><div className="gen-row-status"><span className="gen-pill gen-pill-danger">{labels[r.priority] ?? r.priority}</span></div></button>)}{data.nextCursor && <button className="btn btn-sm" onClick={loadMore} disabled={loading}>Tải thêm</button>}</div></div><GenerationDetailDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
}
