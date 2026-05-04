'use client'

/**
 * GenerationsLiveFeed — client component that polls /api/admin/generations every 10s.
 * Layout: GenStatsStrip (5 tiles) + filter bar + gen-split (list left | drill-down right).
 * Styled with bundle CSS classes from studio.css (Generations section).
 * All functional logic preserved; only JSX + classNames updated to match design bundle.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, Download, RefreshCw } from 'lucide-react'
import { StatusDot } from './status-dot'
import { GenerationDetailDrawer } from './generation-detail-drawer'
import type { GenerationRecord, GenerationsFilters, GenerationsListResponse } from './generation-types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
    return `${Math.floor(diff / 86_400_000)}d`
}

function fmtMs(ms: number | null | undefined): string {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function getUserLabel(user: GenerationRecord['user']): string {
    if (!user) return 'Anonymous'
    if (typeof user === 'number') return `#${user}`
    return user.email ?? `#${user.id}`
}

function getUserInitials(user: GenerationRecord['user']): string {
    if (!user || typeof user === 'number') return '?'
    const email = user.email ?? ''
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
    if (name) return name.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('')
    return email.slice(0, 2).toUpperCase()
}

function buildUrl(filters: GenerationsFilters): string {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.endpoint) params.set('endpoint', filters.endpoint)
    if (filters.category) params.set('category', filters.category)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.search) params.set('search', filters.search)
    params.set('page', String(filters.page))
    params.set('limit', String(filters.limit))
    return `/api/admin/generations?${params.toString()}`
}

const STATUS_OPTIONS = ['all', 'running', 'success', 'failed'] as const
const POLL_INTERVAL_MS = 10_000

// Avatar colors per status
const AVATAR_COLORS = ['#6366F1', '#0EA5E9', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981']

function avatarColor(id: number): string {
    return AVATAR_COLORS[id % AVATAR_COLORS.length]!
}

// ── Stats Strip ────────────────────────────────────────────────────────────────

type StatsStripProps = {
    records: GenerationRecord[]
    filtered: number
    total: number
    lastPoll: Date
}

function GenStatsStrip({ records, filtered, total, lastPoll }: StatsStripProps) {
    const success = records.filter((r) => r.status === 'success').length
    const running = records.filter((r) => r.status === 'running').length
    const failed  = records.filter((r) => r.status === 'failed').length
    const successRate = records.length > 0 ? Math.round((success / records.length) * 100) : 0
    const durations = records.filter((r) => r.durationMs).map((r) => r.durationMs!)
    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    return (
        <div className="gen-stats">
            <div className="gen-stat">
                <div className="gen-stat-label">Hiển thị</div>
                <div className="gen-stat-val">{filtered}<span className="gen-stat-sub">/{total}</span></div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Success rate</div>
                <div className="gen-stat-val gen-stat-success">{successRate}%</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Running</div>
                <div className="gen-stat-val gen-stat-accent">{running}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Failed</div>
                <div className="gen-stat-val gen-stat-danger">{failed}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Gen time TB</div>
                <div className="gen-stat-val">{fmtMs(Math.round(avgDur))}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Updated</div>
                <div className="gen-stat-val" style={{ fontSize: 11, fontWeight: 500 }}>
                    {relativeTime(lastPoll.toISOString())} ago
                </div>
            </div>
        </div>
    )
}

// ── Gen Row ────────────────────────────────────────────────────────────────────

type GenRowProps = {
    rec: GenerationRecord
    selected: boolean
    onClick: () => void
}

const STATUS_PILL_COLOR: Record<string, string> = {
    running: 'accent',
    success: 'success',
    failed:  'danger',
}

function GenRow({ rec, selected, onClick }: GenRowProps) {
    const userId = typeof rec.user === 'number' ? rec.user : (rec.user?.id ?? 0)
    const pillColor = STATUS_PILL_COLOR[rec.status] ?? 'muted'

    return (
        <div className={`gen-row${selected ? ' selected' : ''}`} onClick={onClick}>
            {/* Time + ID */}
            <div className="gen-row-time">
                <span className="t">{relativeTime(rec.createdAt)}</span>
                <span className="id">#{rec.id}</span>
            </div>

            {/* User */}
            <div className="gen-row-user">
                <div
                    className="user-av"
                    style={{ width: 28, height: 28, background: avatarColor(userId), fontSize: 11 }}
                >
                    {getUserInitials(rec.user)}
                </div>
                <div>
                    <div className="n">{getUserLabel(rec.user)}</div>
                    <div className="e">{rec.category ?? '—'}</div>
                </div>
            </div>

            {/* Prompt / endpoint */}
            <div className="gen-row-prompt">
                <div className="prompt-text" title={rec.endpoint}>{rec.endpoint}</div>
                <div className="gen-row-meta">
                    {rec.promptMode && (
                        <span className="cat-chip">{rec.promptMode}</span>
                    )}
                    {rec.promptText && (
                        <span className="cat-chip" title={rec.promptText} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rec.promptText.slice(0, 40)}{rec.promptText.length > 40 ? '…' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Template / category */}
            <div className="gen-row-template">
                <div className="tn">{rec.category ?? '—'}</div>
                {rec.costUsd != null && (
                    <div className="tm">${rec.costUsd.toFixed(4)}</div>
                )}
            </div>

            {/* Metrics — duration */}
            <div className="gen-row-metrics">
                <div className="mini-metric">
                    <div className="mm-label">Duration</div>
                    <div className="mm-val">{fmtMs(rec.durationMs)}</div>
                </div>
            </div>

            {/* Status pill */}
            <div className="gen-row-status">
                <span className={`gen-pill gen-pill-${pillColor}`}>
                    <span className="dot" />
                    {rec.status}
                </span>
            </div>
        </div>
    )
}

// ── Drill-down panel ───────────────────────────────────────────────────────────

type DrillDownProps = {
    rec: GenerationRecord | null
    onView: () => void
}

function GenDrillDown({ rec, onView }: DrillDownProps) {
    if (!rec) {
        return (
            <div className="gen-detail gen-detail-empty">
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>◉</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Chọn 1 generation từ danh sách</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>để xem chi tiết AI fill, block log, và timeline</div>
                </div>
            </div>
        )
    }

    const pillColor = STATUS_PILL_COLOR[rec.status] ?? 'muted'
    const userId = typeof rec.user === 'number' ? rec.user : (rec.user?.id ?? 0)

    return (
        <div className="gen-detail">
            {/* Head */}
            <div className="gen-detail-head">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div
                        className="user-av"
                        style={{ width: 36, height: 36, background: avatarColor(userId), fontSize: 14, flexShrink: 0 }}
                    >
                        {getUserInitials(rec.user)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div className="gd-title">{getUserLabel(rec.user)}</div>
                        <div className="gd-sub">
                            <span className="gen-id-mono">#{rec.id}</span>
                            {' · '}{relativeTime(rec.createdAt)} ago
                        </div>
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={`gen-pill gen-pill-${pillColor}`}>
                        <span className="dot" />
                        {rec.status}
                    </span>
                </div>
            </div>

            {/* Endpoint section */}
            <div className="gd-section">
                <div className="gd-section-label">Endpoint</div>
                <div className="gd-prompt">{rec.endpoint}</div>
                {rec.promptText && (
                    <>
                        <div className="gd-section-label" style={{ marginTop: 8 }}>Prompt</div>
                        <div className="gd-prompt" style={{ fontStyle: 'italic' }}>
                            &ldquo;{rec.promptText}&rdquo;
                        </div>
                    </>
                )}
                <div className="gd-prompt-meta">
                    {rec.category && <span>Category: <b>{rec.category}</b></span>}
                    <span>Mode: <b>{rec.promptMode}</b></span>
                    {rec.promptHash && <span>Hash: <b style={{ fontFamily: 'monospace' }}>{rec.promptHash.slice(0, 12)}…</b></span>}
                </div>
            </div>

            {/* Metrics */}
            <div className="gd-metrics">
                <div className="gd-metric">
                    <div className="gd-metric-v">{fmtMs(rec.durationMs)}</div>
                    <div className="gd-metric-l">Duration</div>
                </div>
                <div className="gd-metric">
                    <div className="gd-metric-v">
                        {rec.costUsd != null ? `$${rec.costUsd.toFixed(4)}` : '—'}
                    </div>
                    <div className="gd-metric-l">Cost</div>
                </div>
                <div className="gd-metric">
                    <div className="gd-metric-v">{rec.selectedBlocks?.length ?? '—'}</div>
                    <div className="gd-metric-l">Blocks</div>
                </div>
                <div className="gd-metric">
                    <div className="gd-metric-v">
                        {rec.completedAt
                            ? new Date(rec.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                    </div>
                    <div className="gd-metric-l">Completed</div>
                </div>
            </div>

            {/* Error log */}
            {rec.errorLog && (
                <div className="gd-flags" style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid var(--border)' }}>
                    <span className="flag-chip">⚠ {rec.errorLog.slice(0, 120)}{rec.errorLog.length > 120 ? '…' : ''}</span>
                </div>
            )}

            {/* Blocks preview */}
            {rec.selectedBlocks && rec.selectedBlocks.length > 0 && (
                <div className="gd-section">
                    <div className="gd-section-label">Selected blocks ({rec.selectedBlocks.length})</div>
                    <div className="gd-block-log">
                        {rec.selectedBlocks.slice(0, 10).map((b, i) => (
                            <div key={b.id} className="block-log-row block-ok">
                                <div className="blr-idx">#{i + 1}</div>
                                <div className="blr-type" style={{ gridColumn: '2 / -2' }}>{b.id}</div>
                            </div>
                        ))}
                        {rec.selectedBlocks.length > 10 && (
                            <div style={{ fontSize: 10, color: 'var(--text-3)', padding: '4px 8px' }}>
                                +{rec.selectedBlocks.length - 10} more…
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="gd-footer" style={{ marginTop: 'auto' }}>
                <button className="btn btn-sm btn-ghost">View site ↗</button>
                <button className="btn btn-sm btn-primary" onClick={onView}>Full detail</button>
            </div>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
    initialData: GenerationsListResponse
}

export function GenerationsLiveFeed({ initialData }: Props) {
    const [records, setRecords] = useState<GenerationRecord[]>(initialData.data)
    const [meta, setMeta] = useState(initialData.meta)
    const [loading, setLoading] = useState(false)
    const [lastPoll, setLastPoll] = useState<Date>(new Date())
    const [live, setLive] = useState(true)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [drawerRecord, setDrawerRecord] = useState<GenerationRecord | null>(null)

    const [filters, setFilters] = useState<GenerationsFilters>({
        status: 'all',
        endpoint: '',
        category: '',
        dateFrom: '',
        dateTo: '',
        search: '',
        page: 1,
        limit: 50,
    })

    const filtersRef = useRef(filters)
    filtersRef.current = filters

    const fetchData = useCallback(async (f: GenerationsFilters, isManual = false) => {
        if (isManual) setLoading(true)
        try {
            const res = await fetch(buildUrl(f))
            if (!res.ok) return
            const json = await res.json() as GenerationsListResponse
            setRecords(json.data)
            setMeta(json.meta)
            setLastPoll(new Date())
        } catch {
            // silent — poll failure must not crash the page
        } finally {
            if (isManual) setLoading(false)
        }
    }, [])

    // Initial fetch on filter change
    useEffect(() => {
        void fetchData(filters, true)
    }, [filters, fetchData])

    // Polling every 10s (keep existing behavior)
    useEffect(() => {
        if (!live) return
        const id = setInterval(() => {
            void fetchData(filtersRef.current)
        }, POLL_INTERVAL_MS)
        return () => clearInterval(id)
    }, [live, fetchData])

    function setFilter<K extends keyof GenerationsFilters>(key: K, val: GenerationsFilters[K]) {
        setFilters((prev) => ({ ...prev, [key]: val, page: key !== 'page' ? 1 : (val as number) }))
    }

    function handleExport() {
        const params = new URLSearchParams()
        if (filters.status && filters.status !== 'all') params.set('status', filters.status)
        if (filters.endpoint) params.set('endpoint', filters.endpoint)
        if (filters.category) params.set('category', filters.category)
        window.open(`/api/admin/generations/export?${params.toString()}`, '_blank')
    }

    const selectedRec = useMemo(() => records.find((r) => r.id === selectedId) ?? null, [records, selectedId])

    return (
        <div className="gen-page">
            {/* Page head */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">User Generations</h1>
                    <p className="page-sub">Live feed tất cả các lần user tạo website từ AI prompt — drill-down để xem chi tiết block fill, issues, timeline.</p>
                </div>
                <div className="page-actions">
                    <button
                        className={`btn btn-sm${live ? ' btn-primary' : ''}`}
                        onClick={() => setLive((l) => !l)}
                    >
                        <span className={`live-dot${live ? ' on' : ''}`} />
                        {live ? 'Live' : 'Paused'}
                    </button>
                    <button className="btn btn-sm" onClick={() => fetchData(filters, true)} disabled={loading}>
                        <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
                        Refresh
                    </button>
                    <button className="btn btn-sm" onClick={handleExport}>
                        <Download size={12} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <GenStatsStrip
                records={records}
                filtered={records.length}
                total={meta.totalDocs}
                lastPoll={lastPoll}
            />

            {/* Filter bar */}
            <div className="gen-filters">
                {/* Time range seg (maps to page navigation shortcut — just visual; real filter is dateFrom/dateTo) */}
                <div className="gen-status-chips">
                    {STATUS_OPTIONS.map((s) => (
                        <button
                            key={s}
                            className={`g-chip g-chip-${s === 'success' ? 'success' : s === 'failed' ? 'danger' : s === 'running' ? 'accent' : ''}${filters.status === s ? ' active' : ''}`}
                            onClick={() => setFilter('status', s)}
                        >
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            <span className="c">{s === 'all' ? meta.totalDocs : records.filter((r) => r.status === s).length}</span>
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1 }} />

                <div className="search-wrap" style={{ minWidth: 220 }}>
                    <Search size={13} />
                    <input
                        value={filters.search}
                        onChange={(e) => setFilter('search', e.target.value)}
                        placeholder="Tìm user, endpoint, category…"
                    />
                </div>
            </div>

            {/* Split: list | drill-down */}
            <div className="gen-split">
                {/* List */}
                <div className="gen-list">
                    <div className="gen-list-head">
                        <div className="col col-time">Time</div>
                        <div className="col col-user">User</div>
                        <div className="col col-prompt">Endpoint & context</div>
                        <div className="col col-template">Category</div>
                        <div className="col col-metrics">Metrics</div>
                        <div className="col col-status">Status</div>
                    </div>
                    <div className="gen-list-body scroll-thin">
                        {loading && records.length === 0 && (
                            <div className="empty-state">
                                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</div>
                            </div>
                        )}
                        {!loading && records.length === 0 && (
                            <div className="empty-state">
                                <div style={{ fontSize: 32, opacity: 0.3 }}>○</div>
                                <div style={{ fontSize: 13, marginTop: 8 }}>Không có generation phù hợp</div>
                            </div>
                        )}
                        {records.map((rec) => (
                            <GenRow
                                key={rec.id}
                                rec={rec}
                                selected={selectedId === rec.id}
                                onClick={() => setSelectedId(rec.id === selectedId ? null : rec.id)}
                            />
                        ))}

                        {/* Pagination at bottom of list */}
                        {meta.totalPages > 1 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    disabled={!meta.hasPrevPage}
                                    onClick={() => setFilter('page', filters.page - 1)}
                                >
                                    ← Prev
                                </button>
                                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                    {meta.page} / {meta.totalPages}
                                </span>
                                <button
                                    className="btn btn-sm btn-ghost"
                                    disabled={!meta.hasNextPage}
                                    onClick={() => setFilter('page', filters.page + 1)}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Drill-down */}
                <GenDrillDown
                    rec={selectedRec}
                    onView={() => setDrawerRecord(selectedRec)}
                />
            </div>

            {/* Full detail drawer (shadcn Dialog — kept for deep dive) */}
            <GenerationDetailDrawer
                record={drawerRecord}
                onClose={() => setDrawerRecord(null)}
            />
        </div>
    )
}
