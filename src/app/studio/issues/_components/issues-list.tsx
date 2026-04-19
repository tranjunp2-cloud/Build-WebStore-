'use client'

/**
 * IssuesList — filterable table of issues with bulk toolbar and row actions.
 * Plain fetch + useState (no TanStack Query).
 * Pagination: 50/page.
 */
import { useState, useCallback, useEffect } from 'react'
import { SeverityPill } from './severity-pill'
import { IssueStatusBadge } from './issue-status-badge'
import { IssueDetailDrawer } from './issue-detail-drawer'
import type { IssueRecord, IssueSeverity, IssueStatus } from './issue-types'

// ── Filter types ─────────────────────────────────────────────────────────────

type Filters = {
    severity: string
    status: string
    category: string
    search: string
}

const EMPTY_FILTERS: Filters = { severity: '', status: '', category: '', search: '' }

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

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
    initialIssues: IssueRecord[]
    initialTotal: number
    initialPages: number
}

export function IssuesList({ initialIssues, initialTotal, initialPages }: Props) {
    const [issues, setIssues] = useState<IssueRecord[]>(initialIssues)
    const [total, setTotal] = useState(initialTotal)
    const [pages, setPages] = useState(initialPages)
    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [activeIssue, setActiveIssue] = useState<IssueRecord | null>(null)
    const [bulkError, setBulkError] = useState<string | null>(null)

    const fetchIssues = useCallback(async (f: Filters, p: number) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/issues?${buildQuery(f, p)}`)
            const json = await res.json() as { data?: IssueRecord[]; meta?: { total: number; pages: number } }
            setIssues(json.data ?? [])
            setTotal(json.meta?.total ?? 0)
            setPages(json.meta?.pages ?? 1)
        } catch {
            // Keep existing data on error
        } finally {
            setLoading(false)
        }
    }, [])

    // Refetch when filters/page change (skip initial render — server already fetched)
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

    // ── Selection ────────────────────────────────────────────────────────────

    function toggleRow(id: number) {
        setSelected((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    function toggleAll() {
        if (selected.size === issues.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(issues.map((i) => i.id)))
        }
    }

    // ── Bulk actions ─────────────────────────────────────────────────────────

    async function bulkAction(action: 'resolve' | 'change-severity', extra?: Partial<{ severity: IssueSeverity }>) {
        if (selected.size === 0) return
        setBulkError(null)
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
            setBulkError(err instanceof Error ? err.message : 'Bulk action failed')
        }
    }

    function handleIssueUpdated(updated: IssueRecord) {
        setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        setActiveIssue(updated)
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                    type="search"
                    placeholder="Search title…"
                    value={filters.search}
                    onChange={(e) => setFilter('search', e.target.value)}
                    style={inputStyle}
                />
                <FilterSelect value={filters.severity} onChange={(v) => setFilter('severity', v)}
                    options={[
                        { value: '', label: 'All severities' },
                        { value: 'critical', label: 'Critical' },
                        { value: 'high', label: 'High' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'low', label: 'Low' },
                    ]}
                />
                <FilterSelect value={filters.status} onChange={(v) => setFilter('status', v)}
                    options={[
                        { value: '', label: 'All statuses' },
                        { value: 'open', label: 'Open' },
                        { value: 'in-review', label: 'In Review' },
                        { value: 'fixed', label: 'Fixed' },
                        { value: 'wont-fix', label: "Won't Fix" },
                    ]}
                />
                <FilterSelect value={filters.category} onChange={(v) => setFilter('category', v)}
                    options={[
                        { value: '', label: 'All categories' },
                        { value: 'accessibility', label: 'Accessibility' },
                        { value: 'performance', label: 'Performance' },
                        { value: 'content', label: 'Content' },
                        { value: 'ui', label: 'UI' },
                        { value: 'ai-quality', label: 'AI Quality' },
                        { value: 'other', label: 'Other' },
                    ]}
                />
                <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center', marginLeft: 'auto' }}>
                    {total} issue{total !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Bulk toolbar */}
            {selected.size > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-elev)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{selected.size} selected</span>
                    <button onClick={() => bulkAction('resolve')} style={bulkBtnStyle}>Resolve all</button>
                    <button onClick={() => bulkAction('change-severity', { severity: 'high' })} style={bulkBtnStyle}>Mark High</button>
                    <button onClick={() => bulkAction('change-severity', { severity: 'low' })} style={bulkBtnStyle}>Mark Low</button>
                    <button onClick={() => setSelected(new Set())} style={{ ...bulkBtnStyle, marginLeft: 'auto' }}>Clear</button>
                    {bulkError && <span style={{ fontSize: 12, color: 'var(--danger, #ef4444)' }}>{bulkError}</span>}
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <Th style={{ width: 32 }}>
                                <input type="checkbox" checked={selected.size === issues.length && issues.length > 0}
                                    onChange={toggleAll} aria-label="Select all" />
                            </Th>
                            <Th>Severity</Th>
                            <Th>Status</Th>
                            <Th style={{ minWidth: 200 }}>Title</Th>
                            <Th>Category</Th>
                            <Th>Related</Th>
                            <Th>Assignee</Th>
                            <Th>Created</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 13 }}>
                                    Loading…
                                </td>
                            </tr>
                        )}
                        {!loading && issues.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                                    No issues found.
                                </td>
                            </tr>
                        )}
                        {!loading && issues.map((issue) => (
                            <tr
                                key={issue.id}
                                style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: selected.has(issue.id) ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
                                    cursor: 'pointer',
                                }}
                                onClick={() => setActiveIssue(issue)}
                            >
                                <Td onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={selected.has(issue.id)}
                                        onChange={() => toggleRow(issue.id)} aria-label={`Select issue ${issue.id}`} />
                                </Td>
                                <Td><SeverityPill severity={issue.severity as IssueSeverity} /></Td>
                                <Td><IssueStatusBadge status={issue.status as IssueStatus} /></Td>
                                <Td style={{ fontWeight: 500, color: 'var(--text)' }}>{issue.title}</Td>
                                <Td style={{ textTransform: 'capitalize' }}>{issue.category}</Td>
                                <Td style={{ color: 'var(--text-2)' }}>
                                    {issue.relatedType} · {issue.relatedId.slice(0, 8)}
                                </Td>
                                <Td style={{ color: 'var(--text-2)' }}>{assigneeLabel(issue.assignedTo)}</Td>
                                <Td style={{ color: 'var(--text-3)' }}>{relativeTime(issue.createdAt)}</Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={bulkBtnStyle}>← Prev</button>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>Page {page} / {pages}</span>
                    <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} style={bulkBtnStyle}>Next →</button>
                </div>
            )}

            <IssueDetailDrawer issue={activeIssue} onClose={() => setActiveIssue(null)} onUpdated={handleIssueUpdated} />
        </>
    )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', ...style }}>
            {children}
        </th>
    )
}

function Td({ children, style, onClick }: { children?: React.ReactNode; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
    return (
        <td style={{ padding: '10px 10px', verticalAlign: 'middle', color: 'var(--text-2)', ...style }} onClick={onClick}>
            {children}
        </td>
    )
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    )
}

const inputStyle: React.CSSProperties = {
    height: 32,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
}

const bulkBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12,
    cursor: 'pointer',
}
