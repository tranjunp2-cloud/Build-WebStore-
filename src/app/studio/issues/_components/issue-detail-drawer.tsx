'use client'

/**
 * IssueDetailDrawer — shadcn Dialog with 3 tabs:
 * Description | Comments | Timeline
 *
 * Fetches full record on open. Supports inline status/severity/assignee change.
 */
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SeverityPill } from './severity-pill'
import { IssueStatusBadge } from './issue-status-badge'
import { IssueMarkdown } from './issue-markdown'
import { IssueCommentThread } from './issue-comment-thread'
import { IssueTimeline } from './issue-timeline'
import type { IssueRecord, IssueStatus, IssueSeverity } from './issue-types'

type Props = {
    issue: IssueRecord | null
    onClose: () => void
    onUpdated?: (updated: IssueRecord) => void
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in-review', label: 'In Review' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'wont-fix', label: "Won't Fix" },
]

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
]

export function IssueDetailDrawer({ issue, onClose, onUpdated }: Props) {
    const [full, setFull] = useState<IssueRecord | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    useEffect(() => {
        if (!issue) { setFull(null); return }
        setFull(null)
        setLoading(true)
        fetch(`/api/admin/issues/${issue.id}`)
            .then((r) => r.json())
            .then((j: { data?: IssueRecord }) => setFull(j.data ?? issue))
            .catch(() => setFull(issue))
            .finally(() => setLoading(false))
    }, [issue?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const displayed = full ?? issue

    async function patchField(field: string, value: unknown) {
        if (!displayed) return
        setSaving(true)
        setSaveError(null)
        try {
            const res = await fetch(`/api/admin/issues/${displayed.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({})) as { error?: string }
                throw new Error(j.error ?? 'Update failed')
            }
            const j = await res.json() as { data?: IssueRecord }
            if (j.data) { setFull(j.data); onUpdated?.(j.data) }
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Update failed')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={!!issue} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <DialogHeader>
                    <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {displayed && <SeverityPill severity={displayed.severity} />}
                        {displayed && <IssueStatusBadge status={displayed.status} />}
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{displayed?.title ?? '—'}</span>
                    </DialogTitle>
                </DialogHeader>

                {/* Meta controls row */}
                {displayed && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '6px 0 10px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Status
                            <select
                                value={displayed.status}
                                disabled={saving}
                                onChange={(e) => patchField('status', e.target.value)}
                                style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', background: 'var(--bg)', color: 'var(--text)' }}
                            >
                                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Severity
                            <select
                                value={displayed.severity}
                                disabled={saving}
                                onChange={(e) => patchField('severity', e.target.value)}
                                style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', background: 'var(--bg)', color: 'var(--text)' }}
                            >
                                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </label>
                        <span>
                            Related: <b>{displayed.relatedType}</b> #{displayed.relatedId}
                        </span>
                        <span>
                            Created: <b>{new Date(displayed.createdAt).toLocaleDateString()}</b>
                        </span>
                        {saveError && <span style={{ color: 'var(--danger, #ef4444)' }}>{saveError}</span>}
                    </div>
                )}

                {loading && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading details…</p>}

                {displayed && (
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Tabs defaultValue="description" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <TabsList>
                                <TabsTrigger value="description">Description</TabsTrigger>
                                <TabsTrigger value="comments">
                                    Comments ({displayed.comments?.length ?? 0})
                                </TabsTrigger>
                                <TabsTrigger value="timeline">
                                    Timeline ({displayed.timeline?.length ?? 0})
                                </TabsTrigger>
                            </TabsList>

                            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12 }}>
                                <TabsContent value="description">
                                    {displayed.description
                                        ? <IssueMarkdown content={displayed.description} />
                                        : <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No description provided.</p>
                                    }
                                </TabsContent>

                                <TabsContent value="comments">
                                    <IssueCommentThread
                                        issueId={displayed.id}
                                        comments={displayed.comments ?? []}
                                        onCommentAdded={(updated) => setFull((prev) => prev ? { ...prev, comments: updated } : prev)}
                                    />
                                </TabsContent>

                                <TabsContent value="timeline">
                                    <IssueTimeline timeline={displayed.timeline ?? []} />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
