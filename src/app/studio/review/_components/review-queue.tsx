'use client'
/**
 * ReviewQueue — split-layout review workflow (bundle design Batch 2).
 * Left: 340px queue with status filter tabs.
 * Right: ReviewDetailPanel (checks + decision).
 * State: active item selection, approve/reject flow, optimistic removal.
 */
import { useState } from 'react'
import { Bell, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { RejectModal } from './reject-modal'
import { ReviewDetailPanel, type ReviewDetailItem } from './review-detail-panel'
import type { ComplianceResult } from '@/lib/admin/dna-compliance'

export type ReviewTemplate = {
    id: string
    name: string
    description?: string | null
    category: string[]
    personality?: string | null
    thumbnail?: { url?: string | null } | null
    dnaComplianceCache?: ComplianceResult | null
    updatedAt: string
}

type ReviewItem = ReviewDetailItem & {
    priority: 'high' | 'normal'
}

function buildReviews(templates: ReviewTemplate[]): ReviewItem[] {
    return templates.map((t) => ({
        id: t.id,
        templateId: t.id,
        name: t.name,
        category: t.category,
        status: 'pending' as const,
        priority: 'normal' as const,
        version: 'v1.0',
        updatedAt: t.updatedAt,
        dnaCache: t.dnaComplianceCache,
    }))
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'Pending',           color: 'var(--warn)',    bg: 'rgba(217,119,6,0.08)' },
    approved: { label: 'Approved',          color: 'var(--success)', bg: 'rgba(5,150,105,0.08)' },
    changes:  { label: 'Changes requested', color: 'var(--danger)',  bg: 'rgba(220,38,38,0.08)' },
    rejected: { label: 'Rejected',          color: 'var(--text-3)',  bg: 'var(--bg-sunk)' },
}

const FILTER_TABS = [
    { id: 'all',      label: 'All' },
    { id: 'pending',  label: 'Pending' },
    { id: 'changes',  label: 'Changes' },
    { id: 'approved', label: 'Approved' },
] as const

type FilterId = (typeof FILTER_TABS)[number]['id']

type Props = { initialTemplates: ReviewTemplate[] }

export function ReviewQueue({ initialTemplates }: Props) {
    const [reviews, setReviews]   = useState<ReviewItem[]>(() => buildReviews(initialTemplates))
    const [filter, setFilter]     = useState<FilterId>('all')
    const [activeId, setActiveId] = useState<string | null>(reviews[0]?.id ?? null)
    const [decisionNote, setDecisionNote] = useState('')
    const [approving, setApproving]       = useState(false)
    const [showReject, setShowReject]     = useState(false)

    const filtered = reviews.filter(r => filter === 'all' || r.status === filter)
    const active   = reviews.find(r => r.id === activeId) ?? null

    const removeActive = () => {
        const remaining = reviews.filter(r => r.id !== activeId)
        setReviews(remaining)
        setActiveId(remaining[0]?.id ?? null)
        setDecisionNote('')
    }

    const handleApprove = async () => {
        if (!active) return
        setApproving(true)
        try {
            const res = await fetch('/api/admin/review/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: active.templateId }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Approve failed')
            toast.success(`"${active.name}" approved — ready to publish`)
            removeActive()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Approve failed')
        } finally {
            setApproving(false)
        }
    }

    if (reviews.length === 0) {
        return (
            <div className="page">
                <div className="page-head">
                    <div>
                        <h1 className="page-title">Review workflow</h1>
                        <p className="page-sub">Admin approves templates before publish.</p>
                    </div>
                </div>
                <div className="empty-state">
                    <p>Queue is clear — no templates pending review.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            {/* Page header */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">Review workflow</h1>
                    <p className="page-sub">
                        Admin approves templates before publish. Focus: DNA compliance, content quality, AI-ready.
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-ghost"><Bell size={14} /> Notifications</button>
                    <button className="btn btn-primary"><Plus size={14} /> Request review</button>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="tabs">
                {FILTER_TABS.map(tab => {
                    const count = tab.id === 'all'
                        ? reviews.length
                        : reviews.filter(r => r.status === tab.id).length
                    return (
                        <button
                            key={tab.id}
                            className={filter === tab.id ? 'active' : ''}
                            onClick={() => setFilter(tab.id)}
                        >
                            {tab.label}{' '}
                            <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>{count}</span>
                        </button>
                    )
                })}
            </div>

            {/* Split: 340px queue | detail */}
            <div className="rw-split">
                {/* Queue list */}
                <div className="card" style={{ overflow: 'hidden' }}>
                    <div className="card-head">
                        <span className="card-title">Review queue</span>
                        <span className="card-sub">{filtered.length} items</span>
                    </div>
                    <div className="rw-queue-scroll scroll-thin">
                        {filtered.map(r => {
                            const meta = STATUS_META[r.status]
                            const pct  = r.dnaCache ? Math.round(r.dnaCache.score) : null
                            return (
                                <button
                                    key={r.id}
                                    className={`rw-queue-item${r.id === activeId ? ' rw-queue-item--active' : ''}`}
                                    onClick={() => setActiveId(r.id)}
                                >
                                    <div className="rw-queue-item-row">
                                        <span className="rw-queue-item-name">{r.name}</span>
                                        <span className="mono muted" style={{ fontSize: 11 }}>{r.version}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <span className="rw-status-badge" style={{ color: meta.color, background: meta.bg }}>
                                            {meta.label}
                                        </span>
                                        {r.priority === 'high' && (
                                            <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>● High</span>
                                        )}
                                    </div>
                                    <div className="muted rw-queue-item-meta">
                                        {r.category.join(', ') || '—'} · {new Date(r.updatedAt).toLocaleDateString()}
                                    </div>
                                    {pct !== null && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
                                            <div className="rw-check-bar">
                                                <div
                                                    className="rw-check-bar-fill"
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: pct === 100 ? 'var(--success)' : pct < 50 ? 'var(--danger)' : 'var(--warn)',
                                                    }}
                                                />
                                            </div>
                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                DNA {r.dnaCache?.pass ? 'pass' : 'fail'} ({pct}/100)
                                            </span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                        {filtered.length === 0 && (
                            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                                No reviews in this filter
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail panel */}
                {active ? (
                    <ReviewDetailPanel
                        item={active}
                        decisionNote={decisionNote}
                        approving={approving}
                        onNoteChange={setDecisionNote}
                        onApprove={handleApprove}
                        onRequestChanges={() => setShowReject(true)}
                    />
                ) : (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                        Select a review from the queue on the left
                    </div>
                )}
            </div>

            {/* Reject modal — shadcn Dialog preserved */}
            {showReject && active && (
                <RejectModal
                    templateId={active.templateId}
                    templateName={active.name}
                    onClose={() => setShowReject(false)}
                    onRejected={removeActive}
                />
            )}
        </div>
    )
}
