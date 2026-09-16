'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Info, RefreshCw, Search } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTapToggleTooltip } from '@/hooks/use-tap-toggle-tooltip'
import type { GenerationRecord, GenerationsFilters, GenerationsListResponse } from './generation-types'
import { GenerationDetailDrawer } from './generation-detail-drawer'
import { GenerationRetryAction } from './generation-retry-action'

const POLL_INTERVAL_MS = 10_000
const labels: Record<string, string> = { cannot_recover: 'Không recovery', retryable: 'Cần xử lý', retry_failed: 'Retry thất bại', retrying: 'Đang gen lại', stale_running: 'Đang treo', history: 'Hoàn tất' }
const statusTone: Record<string, string> = { cannot_recover: 'danger', retry_failed: 'danger', retryable: 'warn', retrying: 'accent', stale_running: 'accent', history: 'success' }
const priorityLabel: Record<string, string> = { cannot_recover: 'P0', retry_failed: 'P0', retryable: 'P1', retrying: 'P2', stale_running: 'P2', history: '—' }
function relativeTime(value: string) { const d = Date.now() - new Date(value).getTime(); return d < 60_000 ? 'vừa xong' : d < 3_600_000 ? `${Math.floor(d / 60_000)} phút` : `${Math.floor(d / 3_600_000)} giờ` }
function buildUrl(f: GenerationsFilters) { const p = new URLSearchParams({ view: f.view, status: f.status, recoveryStatus: f.recoveryStatus, limit: String(f.limit) }); for (const [key, value] of Object.entries({ search: f.search, userId: f.userId, siteId: f.siteId, dateFrom: f.dateFrom, dateTo: f.dateTo, cursor: f.cursor })) if (value) p.set(key, value); return `/api/admin/generations?${p}` }

/** Converts a stored ISO timestamp to the browser-local datetime-local value. */
export function toDateTimeLocalValue(value: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function GenerationTimeHelp() {
    const { open, onOpenChange, onPointerDown, onTouchStart, onFocus, onClick, ref } = useTapToggleTooltip<HTMLButtonElement>()
    return <TooltipProvider><Tooltip open={open} onOpenChange={onOpenChange}><TooltipTrigger asChild><button ref={ref} type="button" className="f41-column-help" aria-label="Giải thích thời gian generation" aria-expanded={open} onPointerDown={onPointerDown} onTouchStart={onTouchStart} onFocus={onFocus} onClick={onClick}><Info size={12} aria-hidden /></button></TooltipTrigger><TooltipContent side="top">Thời gian tính từ lúc user gửi form và hệ thống tạo generation; không phải thời lượng AI gen website.</TooltipContent></Tooltip></TooltipProvider>
}

export function getExportScope(filters: GenerationsFilters) {
    const unsupported = filters.view !== 'all' || filters.recoveryStatus !== 'all' || Boolean(filters.search || filters.siteId)
    return unsupported
        ? 'Export CSV chỉ hỗ trợ toàn bộ generation theo trạng thái, User ID và khoảng thời gian. Hãy bỏ Needs Attention, tìm kiếm, Website ID và recovery status trước khi xuất.'
        : 'Export tối đa 500 generation theo các bộ lọc trạng thái, User ID và khoảng thời gian hiện tại.'
}

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

/**
 * A retry acknowledgement is applied optimistically so an operator cannot
 * submit it twice. A poll started immediately before that acknowledgement can
 * still return the old `eligible` record; retain the local monitor state until
 * the API also reports retrying (or a terminal/retry-failed state).
 */
export function mergePolledGenerationRecords(incoming: GenerationRecord[], current: GenerationRecord[]) {
    const currentById = new Map(current.map((record) => [record.id, record]))
    const merged = incoming.map((record) => {
        const local = currentById.get(record.id)
        const staleRetryablePoll = local?.recoveryStatus === 'retrying'
            && local.recoveryPolicy.action === 'monitor'
            && record.recoveryPolicy.action === 'retry_website'
        return staleRetryablePoll ? local : record
    })
    return appendUniqueGenerationRecords(merged, current)
}

function sameFilters(a: GenerationsFilters, b: GenerationsFilters) {
    return a.view === b.view && a.status === b.status && a.recoveryStatus === b.recoveryStatus
        && a.search === b.search && a.userId === b.userId && a.siteId === b.siteId
        && a.dateFrom === b.dateFrom && a.dateTo === b.dateTo
}

export function GenerationsLiveFeed({ initialData }: { initialData: GenerationsListResponse }) {
    const [data, setData] = useState(initialData), [filters, setFilters] = useState<GenerationsFilters>({ view: 'needs_attention', status: 'all', recoveryStatus: 'all', search: '', userId: '', siteId: '', dateFrom: '', dateTo: '', cursor: '', limit: 50 }), [loading, setLoading] = useState(false), [selected, setSelected] = useState<GenerationRecord | null>(null), [advancedOpen, setAdvancedOpen] = useState(false), [timeRange, setTimeRange] = useState('all'), [loadError, setLoadError] = useState<string | null>(null)
    const ref = useRef(filters); ref.current = filters
    const load = useCallback(async (f: GenerationsFilters, mode: 'replace' | 'append' | 'poll' = 'replace', manual = false) => {
        if (manual) setLoading(true)
        try {
            const response = await fetch(buildUrl(f))
            if (!sameFilters(f, ref.current)) return
            if (!response.ok) {
                const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
                // A failed replace represents the active filter, not the prior
                // successful query. Clear its rows so stale actions cannot be
                // applied to a generation that is no longer in scope.
                if (mode === 'replace') {
                    setData((current) => ({ ...current, items: [], nextCursor: null, meta: { ...current.meta, totalDocs: 0, hasNextPage: false, hasPrevPage: false } }))
                    setSelected(null)
                }
                setLoadError(body?.error?.message ?? 'Chưa thể tải generations. Vui lòng thử lại.')
                return
            }
            const next = await response.json() as GenerationsListResponse
            setLoadError(null)
            setData((current) => {
                if (mode === 'append') return { ...next, items: appendUniqueGenerationRecords(current.items, next.items) }
                if (mode === 'poll') {
                    const nextCursor = current.nextCursor ?? next.nextCursor
                    return {
                        ...next,
                        items: mergePolledGenerationRecords(next.items, current.items),
                        nextCursor,
                        meta: { ...next.meta, hasNextPage: Boolean(nextCursor) },
                    }
                }
                return next
            })
        } catch {
            if (sameFilters(f, ref.current)) {
                if (mode === 'replace') {
                    setData((current) => ({ ...current, items: [], nextCursor: null, meta: { ...current.meta, totalDocs: 0, hasNextPage: false, hasPrevPage: false } }))
                    setSelected(null)
                }
                setLoadError('Chưa thể tải generations. Vui lòng kiểm tra kết nối và thử lại.')
            }
        } finally { if (manual) setLoading(false) }
    }, [])
    useEffect(() => { void load(filters, 'replace', true) }, [filters, load])
    useEffect(() => { const id = setInterval(() => void load(ref.current, 'poll'), POLL_INTERVAL_MS); return () => clearInterval(id) }, [load])
    const clearActiveScope = () => {
        // Filter/view changes define a new queue scope. Do this synchronously,
        // before its request starts, so a stale row can never be retried in the
        // short interval between the input event and the API response.
        setData((current) => ({ ...current, items: [], nextCursor: null, meta: { ...current.meta, totalDocs: 0, hasNextPage: false, hasPrevPage: false } }))
        setSelected(null)
        setLoadError(null)
    }
    const update = <K extends keyof GenerationsFilters>(key: K, value: GenerationsFilters[K]) => {
        clearActiveScope()
        setFilters((old) => ({ ...old, [key]: value, cursor: '' }))
    }
    const updateStatusFilter = (value: string) => {
        const [status, recoveryStatus] = value.split(':')
        clearActiveScope()
        setFilters((old) => ({ ...old, status: status as GenerationsFilters['status'], recoveryStatus: recoveryStatus as GenerationsFilters['recoveryStatus'], cursor: '' }))
    }
    const updateTimeRange = (value: string) => {
        setTimeRange(value)
        const now = Date.now()
        const duration = value === '24h' ? 24 * 60 * 60 * 1000 : value === '7d' ? 7 * 24 * 60 * 60 * 1000 : value === '30d' ? 30 * 24 * 60 * 60 * 1000 : 0
        clearActiveScope()
        setFilters((old) => ({ ...old, dateFrom: duration ? new Date(now - duration).toISOString() : '', dateTo: '', cursor: '' }))
    }
    const loadMore = () => {
        if (!data.nextCursor || loading) return
        void load({ ...filters, cursor: data.nextCursor }, 'append', true)
    }
    const exportCsv = () => {
        // The export endpoint deliberately owns its privacy-safe CSV shape. Only
        // pass filters it supports; recovery/view filtering remains a live queue
        // concern and must not make the exported data look more scoped than it is.
        const params = new URLSearchParams()
        if (filters.status !== 'all') params.set('status', filters.status)
        if (filters.userId) params.set('userId', filters.userId)
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.set('dateTo', filters.dateTo)
        window.location.assign(`/api/admin/generations/export?${params}`)
    }
    const exportScope = getExportScope(filters)
    const canExport = filters.view === 'all' && filters.recoveryStatus === 'all' && !filters.search && !filters.siteId
    const retryAccepted = (id: string) => {
        const apply = (record: GenerationRecord) => record.id === id ? { ...record, recoveryStatus: 'retrying', priority: 'retrying', recoveryPolicy: { action: 'monitor' as const, retryable: false, reasonCode: 'RETRY_IN_PROGRESS' } } : record
        setData((current) => ({ ...current, items: current.items.map(apply) }))
        setSelected((current) => current ? apply(current) : current)
    }
    const visible = data.items
    const metric = (priority: string) => visible.filter((item) => item.priority === priority).length
    return <div className="gen-page f41-generation-page">
        <p className="f41-caption">Needs Attention là queue mặc định. Success chỉ nằm trong history để người trực thấy lỗi cần xử lý trước.</p>
        <div className="page-head f41-page-head"><div><h1 className="page-title">User Generations</h1><p className="page-sub">Theo dõi website AI gen, khôi phục lỗi và chuyển Dev khi không thể recovery.</p></div><div className="f41-head-actions"><button className="btn btn-sm" onClick={() => void load(filters, 'replace', true)} disabled={loading}><RefreshCw size={13} /> Làm mới</button><button className="btn btn-sm" onClick={exportCsv} disabled={!canExport} title={exportScope} aria-label={exportScope}><Download size={13} /> Export CSV</button></div></div>
        <div className="f41-kpis" aria-label="Tổng quan generation đang hiển thị"><div><small>Cần xử lý</small><b className="amber">{metric('retryable')}</b></div><div><small>Đang gen lại</small><b className="blue">{metric('retrying')}</b></div><div><small>Không recovery</small><b className="red">{metric('cannot_recover') + metric('retry_failed')}</b></div><div><small>Hoàn tất hôm nay</small><b className="green">{metric('history')}</b></div><div><small>Đang gen</small><b className="blue">{visible.filter((item) => item.lifecycle === 'running').length}</b></div></div>
        <div className="f41-tabs" aria-label="Generation views">{(['needs_attention', 'all'] as const).map((view) => <button key={view} type="button" aria-pressed={filters.view === view} className={filters.view === view ? 'active' : ''} onClick={() => update('view', view)}>{view === 'needs_attention' ? `Needs Attention · ${data.meta.totalDocs}` : 'All Generations'}</button>)}</div>
        <div className="f41-toolbar"><select className="f41-toolbar-control" aria-label="Lỗi hoặc trạng thái" value={`${filters.status}:${filters.recoveryStatus}`} onChange={(e) => updateStatusFilter(e.target.value)}><option value="all:all">Lỗi / trạng thái</option><option value="failed:all">Lỗi</option><option value="all:eligible">Cần xử lý</option><option value="all:retrying">Đang gen lại</option><option value="running:all">Đang gen</option><option value="success:all">Hoàn tất</option></select><select className="f41-toolbar-control" aria-label="Thời gian" value={timeRange} onChange={(e) => updateTimeRange(e.target.value)}><option value="all">Thời gian</option><option value="24h">24 giờ gần đây</option><option value="7d">7 ngày gần đây</option><option value="30d">30 ngày gần đây</option></select><button type="button" className="btn btn-sm f41-toolbar-control" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>Bộ lọc khác</button><div className="f41-search"><Search size={14} /><input aria-label="Tìm generation" value={filters.search} onChange={(e) => update('search', e.target.value)} placeholder="Tìm user, website, generation ID…" /></div></div>
        {loadError && <p role="alert" className="f41-load-error">{loadError}</p>}
        {advancedOpen && <div className="f41-advanced" aria-label="Bộ lọc nâng cao"><input aria-label="User ID" value={filters.userId} onChange={(e) => update('userId', e.target.value)} placeholder="User ID" /><input aria-label="Website ID" value={filters.siteId} onChange={(e) => update('siteId', e.target.value)} placeholder="Website ID" /><label>Từ <input aria-label="Từ ngày" type="datetime-local" value={toDateTimeLocalValue(filters.dateFrom)} onChange={(e) => update('dateFrom', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label><label>Đến <input aria-label="Đến ngày" type="datetime-local" value={toDateTimeLocalValue(filters.dateTo)} onChange={(e) => update('dateTo', e.target.value ? new Date(e.target.value).toISOString() : '')} /></label></div>}
        <div className="gen-list"><div className="gen-list-head"><div className="col col-time"><span>Ưu tiên / thời gian</span><GenerationTimeHelp /></div><div className="col col-user">User &amp; website</div><div className="col col-metrics">Trang</div><div className="col col-prompt">Loại sự cố</div><div className="col col-status">Trạng thái</div><div className="col col-action"><span className="sr-only">Hành động</span></div></div><div className="gen-list-body scroll-thin">{data.items.length === 0 ? <div className="empty-state">Không có generation cần xử lý</div> : data.items.map((r: GenerationRecord) => <div className="gen-row-wrap" key={r.id}><button type="button" onClick={() => setSelected(r)} className="gen-row" aria-label={`Xem generation ${r.id}`}><div className="gen-row-time"><span className="t">{priorityLabel[r.priority] ?? '—'} · {relativeTime(r.submittedAt)}</span><span className="id">#{r.id}</span></div><div className="gen-row-user-site"><div className="n">{r.user.label}</div><div className="e">{r.site.label}</div></div><div className="gen-row-metrics" aria-label={`${r.pageSummary.persisted} of ${r.pageSummary.expected ?? 'unknown'} pages persisted; ${r.pageSummary.failed} failed`}><b>{r.pageSummary.persisted}/{r.pageSummary.expected ?? '?'}</b><small>pages</small></div><div className="gen-row-prompt">{r.incidentSummary ? <><b>{r.incidentSummary.label}</b><div className="prompt-text" title={r.incidentSummary.scope}>{r.incidentSummary.scope}{r.incidentSummary.totalErrors > 1 ? ` · +${r.incidentSummary.totalErrors - 1} lỗi khác` : ''}</div></> : <><b>—</b><div className="prompt-text">Không có lỗi ảnh hưởng</div></>}</div><div className="gen-row-status"><span className={`gen-pill gen-pill-${statusTone[r.priority] ?? 'muted'}`}>{labels[r.priority] ?? r.priority}</span></div></button><div className="gen-row-action"><GenerationRetryAction record={r} onAccepted={retryAccepted} /><button type="button" className="btn btn-sm" onClick={() => setSelected(r)}>Xem</button></div></div>)}{data.nextCursor && <button className="btn btn-sm" onClick={loadMore} disabled={loading}>Tải thêm</button>}</div></div><p className="f41-list-note">`Gen lại website` tạo child generation bằng form gốc; parent và evidence lỗi luôn được giữ.</p><GenerationDetailDrawer record={selected} onClose={() => setSelected(null)} onRetryAccepted={retryAccepted} />
    </div>
}
