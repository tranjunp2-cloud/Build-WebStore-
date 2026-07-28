'use client'

/**
 * IssuesList — iss-split layout: list (left) + detail panel (right).
 * Styled with bundle CSS classes: .iss-page, .iss-split, .iss-row, .iss-detail, etc.
 * All functional logic (fetch/filter/bulk) preserved — only JSX + classNames updated.
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { SeverityPill } from './severity-pill'
import { IssueStatusBadge } from './issue-status-badge'
import { IssueDetailDrawer } from './issue-detail-drawer'
import { LiveErrorsView } from './live-errors-view'
import type { IssueRecord, IssueSeverity, IssueStatus } from './issue-types'

// ── Filter types ──────────────────────────────────────────────────────────────

type Filters = {
    severity: string
    status: string
    category: string
    search: string
}

const EMPTY_FILTERS: Filters = { severity: '', status: '', category: '', search: '' }

// Severity meta — for sev-dot color
const SEVERITY_COLOR: Record<string, string> = {
    critical: 'danger',
    high: 'warn',
    medium: 'accent',
    low: 'muted',
}

const STATUS_COLOR: Record<string, string> = {
    'open':      'danger',
    'in-review': 'warn',
    'fixed':     'success',
    'wont-fix':  'muted',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assigneeLabel(assignedTo: IssueRecord['assignedTo']): string {
    if (!assignedTo) return '—'
    if (typeof assignedTo === 'number') return `#${assignedTo}`
    return assignedTo.email ?? `#${assignedTo.id}`
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
}

function buildQuery(filters: Filters, page: number) {
    const p = new URLSearchParams()
    if (filters.severity) p.set('severity', filters.severity)
    if (filters.status) p.set('status', filters.status)
    if (filters.category) p.set('category', filters.category)
    if (filters.search) p.set('search', filters.search)
    p.set('page', String(page))
    return p.toString()
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function IssueSummary({ issues }: { issues: IssueRecord[] }) {
    const critical   = issues.filter((i) => i.severity === 'critical' && i.status !== 'fixed' && i.status !== 'wont-fix').length
    const open       = issues.filter((i) => i.status === 'open').length
    const unassigned = issues.filter((i) => !i.assignedTo && i.status !== 'fixed' && i.status !== 'wont-fix').length
    const inReview   = issues.filter((i) => i.status === 'in-review').length
    const fixed      = issues.filter((i) => i.status === 'fixed').length

    return (
        <div className="gen-stats">
            <div className="gen-stat">
                <div className="gen-stat-label">Total issues</div>
                <div className="gen-stat-val">{issues.length}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Critical open</div>
                <div className="gen-stat-val gen-stat-danger">{critical}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Open</div>
                <div className="gen-stat-val gen-stat-warn">{open}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">In review</div>
                <div className="gen-stat-val gen-stat-accent">{inReview}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Unassigned</div>
                <div className="gen-stat-val gen-stat-warn">{unassigned}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Fixed</div>
                <div className="gen-stat-val gen-stat-success">{fixed}</div>
            </div>
        </div>
    )
}

// ── Issue row ─────────────────────────────────────────────────────────────────

type IssueRowProps = {
    iss: IssueRecord
    selected: boolean
    onClick: () => void
}

function IssueRow({ iss, selected, onClick }: IssueRowProps) {
    const sevColor  = SEVERITY_COLOR[iss.severity] ?? 'muted'
    const statColor = STATUS_COLOR[iss.status] ?? 'muted'

    return (
        <div className={`iss-row${selected ? ' selected' : ''}`} onClick={onClick}>
            <div className="iss-row-head">
                <span className={`sev-dot sev-${sevColor}`} title={iss.severity} />
                <span className="iss-title">{iss.title}</span>
            </div>
            <div className="iss-row-meta">
                <span className="iss-id">#{iss.id}</span>
                <span className={`iss-kind-chip iss-kind-${iss.category}`}>{iss.category}</span>
                {iss.relatedType && (
                    <span className="iss-block-chip">{iss.relatedType}</span>
                )}
                <span className={`iss-status-chip iss-status-${statColor}`}>{iss.status}</span>
                <span style={{ flex: 1 }} />
                <SeverityPill severity={iss.severity as IssueSeverity} />
            </div>
            <div className="iss-row-stats">
                <span>Related: <b>{iss.relatedId.slice(0, 12)}</b></span>
                <span>Assignee: <b>{assigneeLabel(iss.assignedTo)}</b></span>
                <span>Created: <b>{relativeTime(iss.createdAt)}</b></span>
            </div>
        </div>
    )
}

// ── Issue detail (right panel) ────────────────────────────────────────────────

type IssueDetailPanelProps = {
    iss: IssueRecord | null
    onFullDetail: () => void
}

function IssueDetailPanel({ iss, onFullDetail }: IssueDetailPanelProps) {
    if (!iss) {
        return (
            <div className="iss-detail iss-detail-empty">
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>◉</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Chọn 1 issue từ danh sách</div>
                </div>
            </div>
        )
    }

    const sevColor  = SEVERITY_COLOR[iss.severity] ?? 'muted'
    const statColor = STATUS_COLOR[iss.status] ?? 'muted'

    return (
        <div className="iss-detail scroll-thin">
            {/* Head */}
            <div className="iss-detail-head">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="iss-id-mono">#{iss.id}</span>
                    <span className={`sev-chip sev-${sevColor}`}>{iss.severity}</span>
                    <span className={`iss-status-chip iss-status-${statColor}`}>{iss.status}</span>
                </div>
            </div>

            <h2 className="iss-detail-title">{iss.title}</h2>

            {/* Meta grid */}
            <div className="iss-detail-meta">
                <div className="imd-item">
                    <div className="imd-label">Category</div>
                    <div className="imd-val" style={{ textTransform: 'capitalize' }}>{iss.category}</div>
                </div>
                <div className="imd-item">
                    <div className="imd-label">Related type</div>
                    <div className="imd-val">{iss.relatedType}</div>
                </div>
                <div className="imd-item">
                    <div className="imd-label">Assigned to</div>
                    <div className="imd-val">{assigneeLabel(iss.assignedTo)}</div>
                </div>
                <div className="imd-item">
                    <div className="imd-label">Created</div>
                    <div className="imd-val">{relativeTime(iss.createdAt)}</div>
                </div>
            </div>

            {/* Related ID */}
            <div className="iss-section">
                <div className="iss-section-label">Related ID</div>
                <div className="iss-tpl-list">
                    <span className="iss-tpl-chip">{iss.relatedId}</span>
                </div>
            </div>

            {/* Description */}
            {iss.description && (
                <div className="iss-section">
                    <div className="iss-section-label">Description</div>
                    <div className="iss-desc">{iss.description}</div>
                </div>
            )}

            {/* Comments count */}
            {(iss.comments?.length ?? 0) > 0 && (
                <div className="iss-section">
                    <div className="iss-section-label">Comments</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {iss.comments!.length} comment{iss.comments!.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            {/* Timeline count */}
            {(iss.timeline?.length ?? 0) > 0 && (
                <div className="iss-section">
                    <div className="iss-section-label">Timeline</div>
                    <div className="iss-tl">
                        {iss.timeline!.slice(0, 3).map((e) => (
                            <div key={e.id} className="iss-tl-item">
                                <span className="tl-t">{relativeTime(e.at)}</span>
                                <span>{e.event}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="iss-footer">
                <button className="btn btn-sm btn-ghost">Comment</button>
                <button className="btn btn-sm btn-primary" onClick={onFullDetail}>Full detail</button>
            </div>
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
    initialIssues: IssueRecord[]
    initialTotal: number
    initialPages: number
}

export function IssuesList({ initialIssues, initialTotal, initialPages }: Props) {
    const [activeView, setActiveView] = useState<'tracked' | 'live'>('tracked')
    const [issues, setIssues]       = useState<IssueRecord[]>(initialIssues)
    const [total, setTotal]         = useState(initialTotal)
    const [pages, setPages]         = useState(initialPages)
    const [page, setPage]           = useState(1)
    const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS)
    const [loading, setLoading]     = useState(false)
    const [selectedId, setSelId]    = useState<number | null>(issues[0]?.id ?? null)
    const [drawerIssue, setDrawer]  = useState<IssueRecord | null>(null)
    const [bulkError, setBulkErr]   = useState<string | null>(null)
    const [selected, setSelected]   = useState<Set<number>>(new Set())

    const fetchIssues = useCallback(async (f: Filters, p: number) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/issues?${buildQuery(f, p)}`)
            const json = await res.json() as { data?: IssueRecord[]; meta?: { total: number; pages: number } }
            setIssues(json.data ?? [])
            setTotal(json.meta?.total ?? 0)
            setPages(json.meta?.pages ?? 1)
        } catch {
            // keep existing data on error
        } finally {
            setLoading(false)
        }
    }, [])

    const [isFirstRender, setIsFirstRender] = useState(true)
    useEffect(() => {
        if (isFirstRender) { setIsFirstRender(false); return }
        void fetchIssues(filters, page)
    }, [filters, page]) // eslint-disable-line react-hooks/exhaustive-deps

    function setFilter(key: keyof Filters, value: string) {
        setPage(1)
        setSelected(new Set())
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    async function bulkAction(action: 'resolve' | 'change-severity', extra?: Partial<{ severity: IssueSeverity }>) {
        if (selected.size === 0) return
        setBulkErr(null)
        try {
            const res = await fetch('/api/admin/issues/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...selected], action, ...extra }),
            })
            if (!res.ok) throw new Error('Bulk action failed')
            setSelected(new Set())
            await fetchIssues(filters, page)
        } catch (err) {
            setBulkErr(err instanceof Error ? err.message : 'Bulk action failed')
        }
    }

    function handleIssueUpdated(updated: IssueRecord) {
        setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        setDrawer(updated)
    }

    function handleRuntimePromoted(issue: IssueRecord, created: boolean) {
        const alreadyLoaded = issues.some((current) => current.id === issue.id)
        setIssues((prev) => (
            prev.some((current) => current.id === issue.id)
                ? prev.map((current) => current.id === issue.id ? issue : current)
                : [issue, ...prev]
        ))
        if (created && !alreadyLoaded) setTotal((current) => current + 1)
        setSelId(issue.id)
        setDrawer(issue)
        setActiveView('tracked')
    }

    const selectedIss = useMemo(() => issues.find((i) => i.id === selectedId) ?? null, [issues, selectedId])

    // Sort: critical first, then by createdAt desc
    const sorted = useMemo(() => {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return [...issues].sort((a, b) => {
            const d = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
            return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [issues])

    return (
        <div className="iss-page">
            {/* Page head */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">Issues & Feedback</h1>
                    <p className="page-sub">
                        {activeView === 'tracked'
                            ? 'Vấn đề tổng hợp từ user generations, grouped theo root cause — block, template, AI pattern, hoặc user feedback.'
                            : 'Read-on-demand production errors from Sentry and Vercel. Evidence remains temporary until promotion.'}
                    </p>
                </div>
                {activeView === 'tracked' && (
                    <div className="page-actions">
                        <button className="btn btn-sm" onClick={() => fetchIssues(filters, page)} disabled={loading}>
                            {loading ? 'Loading…' : 'Refresh'}
                        </button>
                        <button className="btn btn-sm btn-primary">+ New issue</button>
                    </div>
                )}
            </div>

            <div
                className="inline-flex w-fit rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elev)] p-1"
                role="group"
                aria-label="Issues views"
            >
                <button
                    type="button"
                    className={[
                        'min-h-11 rounded-md px-4 text-sm font-semibold transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                        activeView === 'tracked'
                            ? 'bg-[var(--bg-sunk)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border)]'
                            : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]',
                    ].join(' ')}
                    aria-pressed={activeView === 'tracked'}
                    onClick={() => setActiveView('tracked')}
                >
                    Tracked issues
                </button>
                <button
                    type="button"
                    className={[
                        'min-h-11 rounded-md px-4 text-sm font-semibold transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                        activeView === 'live'
                            ? 'bg-[var(--bg-sunk)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border)]'
                            : 'text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]',
                    ].join(' ')}
                    aria-pressed={activeView === 'live'}
                    onClick={() => setActiveView('live')}
                >
                    Live errors
                </button>
            </div>

            {activeView === 'tracked' ? (
                <>
            {/* Summary strip */}
            <IssueSummary issues={issues} />

            {/* Filter bar */}
            <div className="gen-filters">
                {/* Severity seg */}
                <div className="seg">
                    {['', 'critical', 'high', 'medium', 'low'].map((s) => (
                        <button
                            key={s}
                            className={filters.severity === s ? 'active' : ''}
                            onClick={() => setFilter('severity', s)}
                        >
                            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Status select */}
                <select
                    className="select"
                    value={filters.status}
                    onChange={(e) => setFilter('status', e.target.value)}
                >
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="in-review">In Review</option>
                    <option value="fixed">Fixed</option>
                    <option value="wont-fix">Won&apos;t Fix</option>
                </select>

                {/* Category select */}
                <select
                    className="select"
                    value={filters.category}
                    onChange={(e) => setFilter('category', e.target.value)}
                >
                    <option value="">All categories</option>
                    <option value="accessibility">Accessibility</option>
                    <option value="performance">Performance</option>
                    <option value="content">Content</option>
                    <option value="ui">UI</option>
                    <option value="ai-quality">AI Quality</option>
                    <option value="other">Other</option>
                </select>

                <div style={{ flex: 1 }} />

                {/* Search */}
                <div className="search-wrap" style={{ minWidth: 240 }}>
                    <Search size={13} />
                    <input
                        value={filters.search}
                        onChange={(e) => setFilter('search', e.target.value)}
                        placeholder="Tìm issue, block type…"
                    />
                </div>
            </div>

            {/* Bulk toolbar */}
            {selected.size > 0 && (
                <div className="bulk-inline active">
                    <span className="count">{selected.size} selected</span>
                    <div className="divider" />
                    <button className="btn btn-sm" onClick={() => bulkAction('resolve')}>Resolve all</button>
                    <button className="btn btn-sm" onClick={() => bulkAction('change-severity', { severity: 'high' })}>Mark High</button>
                    <button className="btn btn-sm" onClick={() => bulkAction('change-severity', { severity: 'low' })}>Mark Low</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
                    {bulkError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{bulkError}</span>}
                </div>
            )}

            {/* Split: list | detail */}
            <div className="iss-split">
                {/* List */}
                <div className="iss-list scroll-thin">
                    {loading && issues.length === 0 && (
                        <div className="empty-state">
                            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</div>
                        </div>
                    )}
                    {!loading && issues.length === 0 && (
                        <div className="empty-state">
                            <div style={{ fontSize: 32, opacity: 0.3 }}>○</div>
                            <div style={{ fontSize: 13, marginTop: 8 }}>Không có issue phù hợp</div>
                        </div>
                    )}
                    {sorted.map((iss) => (
                        <IssueRow
                            key={iss.id}
                            iss={iss}
                            selected={selectedId === iss.id}
                            onClick={() => setSelId(iss.id === selectedId ? null : iss.id)}
                        />
                    ))}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                            <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                ← Prev
                            </button>
                            <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>
                                Page {page} / {pages} · {total} total
                            </span>
                            <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                                disabled={page >= pages}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                <IssueDetailPanel
                    iss={selectedIss}
                    onFullDetail={() => setDrawer(selectedIss)}
                />
            </div>

            {/* Full drawer */}
            <IssueDetailDrawer
                issue={drawerIssue}
                onClose={() => setDrawer(null)}
                onUpdated={handleIssueUpdated}
            />
                </>
            ) : (
                <LiveErrorsView onPromoted={handleRuntimePromoted} />
            )}
        </div>
    )
}
