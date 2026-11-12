'use client'

/**
 * IssuesList — iss-split layout: list (left) + detail panel (right).
 * Styled with bundle CSS classes: .iss-page, .iss-split, .iss-row, .iss-detail, etc.
 * All functional logic (fetch/filter/bulk) preserved — only JSX + classNames updated.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { closestCorners, DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Search } from 'lucide-react'
import { SeverityPill } from './severity-pill'
import { IssueStatusBadge } from './issue-status-badge'
import { IssueDetailDrawer } from './issue-detail-drawer'
import { LiveErrorsView } from './live-errors-view'
import type { IssueRecord, IssueSeverity, IssueStatus } from './issue-types'
import { CreateIssueModal } from '@/app/studio/_components/modals/create-issue-modal'
import { canSetIssueStatus } from '@/lib/admin/studio-permissions'
import { useStudioCan, useStudioRoles } from '@/app/studio/_components/studio-permissions-context'

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

const BOARD_COLUMNS: Array<{ status: IssueStatus; label: string; hint: string }> = [
    { status: 'backlog', label: 'Backlog', hint: 'Chưa được nhận xử lý' },
    { status: 'reopen', label: 'Reopen', hint: 'Lỗi tái diễn / test chưa đạt' },
    { status: 'in_progress', label: 'In Progress', hint: 'Dev đang xử lý' },
    { status: 'dev_fixed', label: 'Dev fixed', hint: 'Dev đã sửa, chờ QA' },
    { status: 'testing', label: 'QA Testing', hint: 'Đang kiểm thử bản sửa' },
    { status: 'done', label: 'Done', hint: 'Trả User Generations để test lại' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function assigneeLabel(issue: IssueRecord): string {
    // Assignment is intentionally a team queue, not an individual identity.
    return issue.assignmentTarget === 'dev' ? 'DEV' : 'Chưa phân công'
}

export function isIssueUnassigned(issue: Pick<IssueRecord, 'assignmentTarget' | 'assignedTo'>): boolean {
    // Existing tickets can still carry the legacy person relationship. New
    // tickets use the explicit team assignment target.
    return issue.assignmentTarget === undefined ? !issue.assignedTo : issue.assignmentTarget !== 'dev'
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
}

function priorityLabel(severity: IssueSeverity) {
    return { critical: 'P0', high: 'P1', medium: 'P2', low: 'P3' }[severity]
}

function handoffField(description: string | undefined, label: string) {
    const value = description?.match(new RegExp(`^- ${label}: (.+)$`, 'm'))?.[1] ?? null
    return value?.replace(/\*\*/g, '').trim() || null
}

function bugReportField(description: string | undefined, label: string) {
    const value = description?.match(new RegExp(`^- ${label}:\\s+\\*\\*(.+?)\\*\\*`, 'm'))?.[1] ?? null
    return value?.trim() || null
}

function emailFrom(value: string | null) {
    return value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
}

function legacySectionField(description: string | undefined, label: string) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return description?.match(new RegExp(`(?:^|\\n)${escapedLabel}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? null
}

function affectedContext(issue: IssueRecord) {
    const affectedUser = bugReportField(issue.description, 'Người dùng bị ảnh hưởng')
        ?? handoffField(issue.description, 'Người gửi form')
        ?? legacySectionField(issue.description, 'Người gửi form')
    return {
        website: bugReportField(issue.description, 'Website bị ảnh hưởng') ?? handoffField(issue.description, 'Website'),
        // The operator needs an unambiguous identifier. A display name is not
        // enough to locate the affected account, so show the email only.
        userEmail: emailFrom(affectedUser),
        impact: handoffField(issue.description, 'Ảnh hưởng đến') ?? handoffField(issue.description, 'Ảnh hưởng'),
    }
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
    const critical   = issues.filter((i) => i.severity === 'critical' && i.status !== 'done').length
    const open       = issues.filter((i) => i.status === 'backlog').length
    const unassigned = issues.filter((i) => isIssueUnassigned(i) && i.status !== 'done').length
    const inReview   = issues.filter((i) => i.status === 'in_progress').length
    const fixed      = issues.filter((i) => i.status === 'done').length

    return (
        <div className="gen-stats">
            <div className="gen-stat">
            <div className="gen-stat-label">Tổng ticket</div>
                <div className="gen-stat-val">{issues.length}</div>
            </div>
            <div className="gen-stat">
            <div className="gen-stat-label">Khẩn cấp</div>
                <div className="gen-stat-val gen-stat-danger">{critical}</div>
            </div>
            <div className="gen-stat">
                <div className="gen-stat-label">Backlog</div>
                <div className="gen-stat-val gen-stat-warn">{open}</div>
            </div>
            <div className="gen-stat">
            <div className="gen-stat-label">Dev xử lý</div>
                <div className="gen-stat-val gen-stat-accent">{inReview}</div>
            </div>
            <div className="gen-stat">
            <div className="gen-stat-label">Chưa phân công</div>
                <div className="gen-stat-val gen-stat-warn">{unassigned}</div>
            </div>
            <div className="gen-stat">
            <div className="gen-stat-label">Đã trả test</div>
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
    shouldSuppressOpen: () => boolean
}

function IssueRow({ iss, selected, onClick, shouldSuppressOpen }: IssueRowProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `issue-${iss.id}`,
        data: { issueId: iss.id },
    })
    const sevColor  = SEVERITY_COLOR[iss.severity] ?? 'muted'
    const context = affectedContext(iss)

    return (
        <div
            ref={setNodeRef}
            className={`iss-row${selected ? ' selected' : ''}${isDragging ? ' iss-row-dragging' : ''}`}
            onClick={() => {
                // DnD-kit/browser emits exactly one click after pointer-up.
                // Consume it; the next deliberate click opens the ticket.
                if (!shouldSuppressOpen()) onClick()
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
            {...attributes}
            {...listeners}
        >
            <div className="iss-row-head">
                <span className={`sev-dot sev-${sevColor}`} title={iss.severity} />
                <span className="iss-title">{iss.title}</span>
            </div>
            <div className="iss-row-meta">
                <span className="iss-id">#{iss.id}</span>
                <span className="iss-priority">{priorityLabel(iss.severity)}</span>
                <span className={`iss-kind-chip iss-kind-${iss.category}`}>{iss.category}</span>
                {iss.relatedType && (
                    <span className="iss-block-chip">{iss.relatedType}</span>
                )}
                <IssueStatusBadge status={iss.status} />
                <span style={{ flex: 1 }} />
                <SeverityPill severity={iss.severity as IssueSeverity} />
            </div>
            <div className="iss-row-stats">
                {context.website && <span>Website: <b>{context.website}</b></span>}
                {context.userEmail && <span>Email user bị ảnh hưởng: <b>{context.userEmail}</b></span>}
                {context.impact && <span>Ảnh hưởng: <b>{context.impact}</b></span>}
                <span>Liên quan: <b>{iss.relatedId.slice(0, 12)}</b></span>
                <span>Dev phụ trách: <b>{assigneeLabel(iss)}</b></span>
                <span>Tạo: <b>{relativeTime(iss.createdAt)}</b></span>
            </div>
        </div>
    )
}

function IssueBoardColumn({ column, issues, selectedIssueId, onOpen, onCreate, canCreate, shouldSuppressOpen }: {
    column: (typeof BOARD_COLUMNS)[number]
    issues: IssueRecord[]
    selectedIssueId: number | null
    onOpen: (issue: IssueRecord) => void
    onCreate: (status: IssueStatus) => void
    canCreate: boolean
    shouldSuppressOpen: () => boolean
}) {
    // The scrollable card area is the actual drop target. Registering the
    // outer column made empty stages unreliable after the board gained
    // independently-scrollable columns: the pointer was over the child
    // scroll container, not the registered node.
    const { setNodeRef, isOver } = useDroppable({
        id: `column-${column.status}`,
        data: { status: column.status },
    })

    return (
        <section className={`iss-board-column${isOver ? ' iss-board-column-over' : ''}`} aria-label={`${column.label}: ${issues.length} ticket`}>
            <header className="iss-board-column-head">
                <div>
                    <h2>{column.label} <span>{issues.length}</span></h2>
                    <p>{column.hint}</p>
                </div>
                {canCreate && <button type="button" className="iss-board-add" aria-label={`Tạo ticket ở ${column.label}`} onClick={() => onCreate(column.status)}>+</button>}
            </header>
            <div ref={setNodeRef} className="iss-board-cards">
                {issues.map((iss) => (
                    <IssueRow key={iss.id} iss={iss} selected={selectedIssueId === iss.id} onClick={() => onOpen(iss)} shouldSuppressOpen={shouldSuppressOpen} />
                ))}
                {issues.length === 0 && <div className="iss-board-empty">Kéo ticket vào đây</div>}
            </div>
        </section>
    )
}

// ── Issue detail (right panel) ────────────────────────────────────────────────

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
    initialIssues: IssueRecord[]
    initialTotal: number
    initialPages: number
}

export function IssuesList({ initialIssues, initialTotal, initialPages }: Props) {
    const roles = useStudioRoles()
    const can = useStudioCan()
    const canWork = can('issue.work')
    const canBulk = can('issue.bulk')
    const [activeView, setActiveView] = useState<'tracked' | 'live'>('tracked')
    const [issues, setIssues]       = useState<IssueRecord[]>(initialIssues)
    const [total, setTotal]         = useState(initialTotal)
    const [pages, setPages]         = useState(initialPages)
    const [page, setPage]           = useState(1)
    const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS)
    const [loading, setLoading]     = useState(false)
    const [drawerIssue, setDrawer]  = useState<IssueRecord | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [createStatus, setCreateStatus] = useState<IssueStatus>('backlog')
    const [dragError, setDragError] = useState<string | null>(null)
    const [bulkError, setBulkErr]   = useState<string | null>(null)
    const [selected, setSelected]   = useState<Set<number>>(new Set())
    const suppressOpenAfterDragRef = useRef(false)

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

    function updateIssueInBoard(updated: IssueRecord) {
        setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    }

    function handleIssueUpdated(updated: IssueRecord) {
        updateIssueInBoard(updated)
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
        setDrawer(issue)
        setActiveView('tracked')
    }

    // Sort: critical first, then by createdAt desc
    const sorted = useMemo(() => {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return [...issues].sort((a, b) => {
            const d = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
            return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [issues])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    async function moveIssue(event: DragEndEvent) {
        const issueId = Number(event.active.data.current?.issueId)
        const targetId = String(event.over?.id ?? '')
        // DnD Kit reports either the empty column drop-zone or the card under
        // the pointer. Resolve both so a card can be dropped anywhere in the
        // destination column, including directly onto another ticket.
        const targetIssueId = targetId.startsWith('issue-') ? Number(targetId.slice('issue-'.length)) : null
        const targetStatus = event.over?.data.current?.status as IssueStatus | undefined
            ?? BOARD_COLUMNS.find((column) => `column-${column.status}` === targetId)?.status
            ?? (Number.isFinite(targetIssueId) ? issues.find((candidate) => candidate.id === targetIssueId)?.status : undefined)
        const issue = issues.find((candidate) => candidate.id === issueId)
        if (!issue || !targetStatus || issue.status === targetStatus) return
        if (!canSetIssueStatus(roles, issue.status, targetStatus)) {
            setDragError('Bạn không có quyền chuyển ticket sang trạng thái này')
            return
        }

        const previous = issue
        const optimistic = { ...issue, status: targetStatus }
        setDragError(null)
        setIssues((current) => current.map((candidate) => candidate.id === issue.id ? optimistic : candidate))
        try {
            const response = await fetch(`/api/admin/issues/${issue.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus }),
            })
            if (!response.ok) throw new Error('Không thể cập nhật trạng thái ticket')
            const body = await response.json() as { data?: IssueRecord }
            // A drop is a board-only interaction. Do not reuse the detail
            // updater here because it deliberately opens the drawer.
            if (body.data) updateIssueInBoard(body.data)
        } catch (error) {
            setIssues((current) => current.map((candidate) => candidate.id === previous.id ? previous : candidate))
            setDragError(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái ticket')
        }
    }

    function handleCreated(issue?: IssueRecord) {
        if (!issue) return
        setIssues((current) => [issue, ...current])
        setTotal((current) => current + 1)
        setDrawer(issue)
    }

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
                        {canWork && <button className="btn btn-sm btn-primary" onClick={() => { setCreateStatus('backlog'); setCreateOpen(true) }}>+ Tạo ticket</button>}
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
                    <option value="backlog">Backlog</option>
                    <option value="reopen">Reopen</option>
                    <option value="in_progress">Dev đang xử lý</option>
                    <option value="dev_fixed">Dev đã sửa</option>
                    <option value="testing">QA Testing</option>
                    <option value="done">Done · cần test lại</option>
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
            {canBulk && selected.size > 0 && (
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

            {dragError && <p role="alert" className="iss-board-error">{dragError}</p>}
            <DndContext
                // dnd-kit derives accessibility IDs from this value. A stable
                // ID keeps SSR and client markup identical on first load.
                id="issues-board-dnd"
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={() => { suppressOpenAfterDragRef.current = true }}
                onDragEnd={(event) => { void moveIssue(event) }}
                onDragCancel={() => { suppressOpenAfterDragRef.current = false }}
            >
            <div className="iss-board scroll-thin">
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
                    {BOARD_COLUMNS.map((column) => (
                        <IssueBoardColumn
                            key={column.status}
                            column={column}
                            issues={sorted.filter((issue) => issue.status === column.status)}
                            selectedIssueId={drawerIssue?.id ?? null}
                            onOpen={setDrawer}
                            onCreate={(status) => { setCreateStatus(status); setCreateOpen(true) }}
                            canCreate={canWork}
                            shouldSuppressOpen={() => {
                                if (!suppressOpenAfterDragRef.current) return false
                                suppressOpenAfterDragRef.current = false
                                return true
                            }}
                        />
                    ))}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="iss-board-pagination">
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
            </DndContext>

            {/* Clicking an issue always opens its complete, actionable ticket. */}
            <IssueDetailDrawer
                issue={drawerIssue}
                onClose={() => setDrawer(null)}
                onUpdated={handleIssueUpdated}
            />
            {createOpen && canWork && <CreateIssueModal defaultStatus={createStatus} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}
                </>
            ) : (
                <LiveErrorsView onPromoted={handleRuntimePromoted} />
            )}
        </div>
    )
}
