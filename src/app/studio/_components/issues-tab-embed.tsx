'use client'

/**
 * IssuesTabEmbed — reusable issues list filtered by relatedType + relatedId.
 * Used in Template drawer (Phase 02 Issues tab) and Generation drawer (Phase 05).
 * Plain fetch + useState, no TanStack Query.
 */
import { useState, useEffect, useCallback } from 'react'
import { SeverityPill } from '@/app/studio/issues/_components/severity-pill'
import { IssueStatusBadge } from '@/app/studio/issues/_components/issue-status-badge'
import { IssueDetailDrawer } from '@/app/studio/issues/_components/issue-detail-drawer'
import { CreateIssueModal } from './modals/create-issue-modal'
import { useStudioCan } from './studio-permissions-context'
import type { IssueRecord, IssueRelatedType, IssueSeverity, IssueStatus } from '@/app/studio/issues/_components/issue-types'

type Props = {
    relatedType: IssueRelatedType
    relatedId: string
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
}

export function IssuesTabEmbed({ relatedType, relatedId }: Props) {
    const canWork = useStudioCan()('issue.work')
    const [issues, setIssues] = useState<IssueRecord[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [activeIssue, setActiveIssue] = useState<IssueRecord | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    const fetchIssues = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ relatedType, relatedId, limit: '50' })
            const res = await fetch(`/api/admin/issues?${params}`)
            const json = await res.json() as { data?: IssueRecord[]; meta?: { total: number } }
            setIssues(json.data ?? [])
            setTotal(json.meta?.total ?? 0)
        } catch {
            // keep empty list
        } finally {
            setLoading(false)
        }
    }, [relatedType, relatedId])

    useEffect(() => { void fetchIssues() }, [fetchIssues])

    function handleIssueUpdated(updated: IssueRecord) {
        setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        setActiveIssue(updated)
    }

    return (
        <div style={{ padding: '12px 16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {total} issue{total !== 1 ? 's' : ''}
                </span>
                {canWork && <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--accent)',
                        color: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    + Create issue
                </button>}
            </div>

            {/* List */}
            {loading && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>Loading…</p>
            )}
            {!loading && issues.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
                    No issues reported for this {relatedType}.
                </p>
            )}
            {!loading && issues.map((issue) => (
                <button
                    key={issue.id}
                    type="button"
                    onClick={() => setActiveIssue(issue)}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        marginBottom: 8,
                        cursor: 'pointer',
                    }}
                >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <SeverityPill severity={issue.severity as IssueSeverity} />
                        <IssueStatusBadge status={issue.status as IssueStatus} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginLeft: 2 }}>
                            {issue.title}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {issue.category} · {relativeTime(issue.createdAt)}
                        {(issue.comments?.length ?? 0) > 0 && ` · ${issue.comments!.length} comment${issue.comments!.length !== 1 ? 's' : ''}`}
                    </div>
                </button>
            ))}

            {/* Detail drawer */}
            <IssueDetailDrawer
                issue={activeIssue}
                onClose={() => setActiveIssue(null)}
                onUpdated={handleIssueUpdated}
            />

            {/* Create modal */}
            {showCreate && canWork && (
                <CreateIssueModal
                    defaultRelatedType={relatedType}
                    defaultRelatedId={relatedId}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); void fetchIssues() }}
                />
            )}
        </div>
    )
}
