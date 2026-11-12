'use client'

/**
 * IssueDetailDrawer — shadcn Dialog with 3 tabs:
 * Description | Comments | Timeline
 *
 * Fetches full record on open. Supports inline status/severity/assignee change.
 */
import { useState, useEffect, useRef, type ChangeEvent, type ClipboardEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { canSetIssueStatus } from '@/lib/admin/studio-permissions'
import { useStudioCan, useStudioRoles } from '@/app/studio/_components/studio-permissions-context'
import { SeverityPill } from './severity-pill'
import { IssueStatusBadge } from './issue-status-badge'
import { IssueMarkdown } from './issue-markdown'
import { IssueCommentThread } from './issue-comment-thread'
import { IssueTimeline } from './issue-timeline'
import { addEvidenceMedia, EVIDENCE_MEDIA_ACCEPT, uploadIssueEvidence } from './issue-evidence-media'
import type { IssueRecord, IssueStatus, IssueSeverity } from './issue-types'

type Props = {
    issue: IssueRecord | null
    onClose: () => void
    onUpdated?: (updated: IssueRecord) => void
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'reopen', label: 'Reopen' },
    { value: 'in_progress', label: 'Dev đang xử lý' },
    { value: 'dev_fixed', label: 'Dev đã sửa' },
    { value: 'testing', label: 'QA Testing' },
    { value: 'done', label: 'Done — gửi lại User Generations để test' },
]

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
    { value: 'critical', label: 'Khẩn cấp' },
    { value: 'high', label: 'Cao' },
    { value: 'medium', label: 'Trung bình' },
    { value: 'low', label: 'Thấp' },
]

export function IssueDetailDrawer({ issue, onClose, onUpdated }: Props) {
    const roles = useStudioRoles()
    const canWork = useStudioCan()('issue.work')
    const [full, setFull] = useState<IssueRecord | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [evidenceError, setEvidenceError] = useState<string | null>(null)
    const [uploadingEvidence, setUploadingEvidence] = useState(false)
    const [editing, setEditing] = useState(false)
    const [draftTitle, setDraftTitle] = useState('')
    const [draftDescription, setDraftDescription] = useState('')
    // State updates are asynchronous. Keep a synchronous guard too so two
    // rapid select changes cannot race and overwrite each other's result.
    const savingRef = useRef(false)
    const detailsRequestRef = useRef(0)
    const evidenceInputRef = useRef<HTMLInputElement>(null)
    const descriptionRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        let cancelled = false
        savingRef.current = false
        if (!issue) { setFull(null); setLoading(false); return () => { cancelled = true } }
        const requestId = ++detailsRequestRef.current
        setFull(null)
        setEditing(false)
        setLoading(true)
        fetch(`/api/admin/issues/${issue.id}`)
            .then((r) => r.json())
            .then((j: { data?: IssueRecord }) => {
                if (!cancelled && requestId === detailsRequestRef.current) setFull(j.data ?? issue)
            })
            .catch(() => {
                if (!cancelled && requestId === detailsRequestRef.current) setFull(issue)
            })
            .finally(() => {
                if (!cancelled && requestId === detailsRequestRef.current) setLoading(false)
            })
        return () => { cancelled = true }
    }, [issue?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const displayed = full ?? issue

    function beginEdit() {
        if (!displayed) return
        setDraftTitle(displayed.title)
        setDraftDescription(displayed.description ?? '')
        setSaveError(null)
        setEvidenceError(null)
        setEditing(true)
    }

    async function uploadEvidence(media: File) {
        if (draftDescription.length > 9_400) {
            setEvidenceError('Bug report gần đầy. Hãy rút ngắn nội dung trước khi đính kèm bằng chứng.')
            return
        }
        setEvidenceError(null)
        setUploadingEvidence(true)
        try {
            const uploaded = await uploadIssueEvidence(media, draftTitle)
            setDraftDescription((current) => addEvidenceMedia(current, uploaded.url, uploaded.type))
            requestAnimationFrame(() => descriptionRef.current?.focus())
        } catch (error) {
            setEvidenceError(error instanceof Error ? error.message : 'Không thể tải tệp. Hãy thử lại.')
        } finally {
            setUploadingEvidence(false)
        }
    }

    async function handleEvidencePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
        const media = Array.from(event.clipboardData.items)
            .find((item) => item.kind === 'file' && EVIDENCE_MEDIA_ACCEPT.split(',').includes(item.type))
            ?.getAsFile()
        if (!media) return
        event.preventDefault()
        await uploadEvidence(media)
    }

    async function handleEvidenceFileChange(event: ChangeEvent<HTMLInputElement>) {
        const media = event.target.files?.[0]
        event.target.value = ''
        if (media) await uploadEvidence(media)
    }

    async function saveTicketContent() {
        if (!displayed || !draftTitle.trim() || savingRef.current) return
        savingRef.current = true
        setSaving(true)
        setSaveError(null)
        try {
            const res = await fetch(`/api/admin/issues/${displayed.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: draftTitle.trim(), description: draftDescription.trim() }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: string }
                throw new Error(body.error ?? 'Không thể lưu ticket')
            }
            const body = await res.json() as { data?: IssueRecord }
            if (body.data) { setFull(body.data); onUpdated?.(body.data) }
            setEditing(false)
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Không thể lưu ticket')
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    async function patchField(field: string, value: unknown) {
        if (!displayed || savingRef.current) return
        savingRef.current = true
        // A saved triage result always wins over an older detail fetch.
        detailsRequestRef.current += 1
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
            savingRef.current = false
            setSaving(false)
            setLoading(false)
        }
    }

    return (
        <Dialog open={!!issue} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="issue-detail-dialog">
                <DialogHeader className="issue-detail-header">
                    <DialogTitle className="issue-detail-title-row">
                        <span className="issue-detail-kicker">Bug report · #{displayed?.id ?? '—'}</span>
                        <span className="issue-detail-dialog-title">{displayed?.title ?? '—'}</span>
                        <span className="issue-detail-badges">
                            {displayed && <SeverityPill severity={displayed.severity} />}
                            {displayed && <IssueStatusBadge status={displayed.status} />}
                        </span>
                    </DialogTitle>
                    {displayed && canWork && (
                        <button type="button" className="btn btn-sm issue-header-edit" onClick={beginEdit} disabled={saving}>
                            Chỉnh sửa ticket
                        </button>
                    )}
                </DialogHeader>

                {/* Triage stays above the report: ownership and workflow are
                    visible without burying the actual bug evidence. */}
                {displayed && (
                    <div className="issue-triage-panel">
                        <section className="issue-workflow" aria-label="Workflow ticket">
                            <div className="issue-workflow-label">Workflow</div>
                            <div className="issue-workflow-steps">
                                {STATUS_OPTIONS.map((option, index) => {
                                    const active = option.value === displayed.status
                                    if (!active && !canSetIssueStatus(roles, displayed.status, option.value)) return null
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={`issue-workflow-step${active ? ' active' : ''}`}
                                            aria-pressed={active}
                                            disabled={saving || active}
                                            onClick={() => patchField('status', option.value)}
                                        >
                                            <span className="issue-workflow-marker">{index + 1}</span>
                                            <span className="issue-workflow-step-label">{option.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="issue-workflow-help">Chọn bất kỳ trạng thái nào để cập nhật ngay; không áp dụng thứ tự bắt buộc.</p>
                        </section>
                        <div className="issue-triage-controls">
                            <label>
                                Mức độ
                                <select value={displayed.severity} disabled={saving || !canWork} onChange={(e) => patchField('severity', e.target.value)}>
                                    {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </label>
                            <label>
                                Người phụ trách
                                <select aria-label="Người phụ trách ticket" value={displayed.assignmentTarget ?? (displayed.assignedTo ? 'dev' : 'unassigned')} disabled={saving || !canWork} onChange={(e) => patchField('assignmentTarget', e.target.value)}>
                                    <option value="unassigned">Chưa phân công</option>
                                    <option value="dev">DEV</option>
                                </select>
                            </label>
                            <div className="issue-triage-fact"><span>Generation</span><b>#{displayed.relatedId}</b></div>
                            <div className="issue-triage-fact"><span>Ngày tạo</span><b>{new Date(displayed.createdAt).toLocaleDateString('vi-VN')}</b></div>
                        </div>
                        {saveError && <p role="alert" className="issue-triage-error">{saveError}</p>}
                    </div>
                )}

                {displayed && editing && canWork && (
                    <section className="issue-ticket-editor" aria-label="Chỉnh sửa nội dung ticket">
                        <div className="issue-ticket-editor-intro">
                            <b>Chỉnh sửa Bug Report</b>
                            <span>Cập nhật tiêu đề và nội dung bàn giao cho Dev. Nhấn Lưu ticket để áp dụng thay đổi.</span>
                        </div>
                        <label>
                            Tiêu đề lỗi
                            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={300} disabled={saving} />
                        </label>
                        <label>
                            <span className="issue-ticket-editor-label-row">
                                Nội dung Bug Report (Markdown)
                                <span>
                                    <input ref={evidenceInputRef} type="file" accept={EVIDENCE_MEDIA_ACCEPT} className="sr-only" onChange={handleEvidenceFileChange} />
                                    <button type="button" className="issue-ticket-editor-attach" onClick={() => evidenceInputRef.current?.click()} disabled={saving || uploadingEvidence}>Đính kèm ảnh/video</button>
                                </span>
                            </span>
                            <textarea ref={descriptionRef} value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} onPaste={handleEvidencePaste} maxLength={10000} rows={18} disabled={saving || uploadingEvidence} />
                        </label>
                        <p className="issue-ticket-editor-evidence" aria-live="polite">{uploadingEvidence ? 'Đang tải bằng chứng…' : 'Dán hoặc đính kèm ảnh JPG/PNG/WebP (tối đa 5MB) hay video MP4/WebM (tối đa 20MB).'}</p>
                        {evidenceError && <p role="alert" className="issue-triage-error">{evidenceError}</p>}
                        <div className="issue-ticket-editor-actions">
                            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)} disabled={saving}>Hủy</button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={saveTicketContent} disabled={saving || !draftTitle.trim()}>{saving ? 'Đang lưu…' : 'Lưu ticket'}</button>
                        </div>
                    </section>
                )}

                {loading && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Đang tải ticket…</p>}

                {displayed && !editing && (
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Tabs defaultValue="description" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <TabsList>
                                <TabsTrigger value="description">Bug report</TabsTrigger>
                                <TabsTrigger value="comments">
                                    Bình luận ({displayed.comments?.length ?? 0})
                                </TabsTrigger>
                                <TabsTrigger value="timeline">
                                    Lịch sử ({displayed.timeline?.length ?? 0})
                                </TabsTrigger>
                            </TabsList>

                            <div className="issue-detail-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 12 }}>
                                <TabsContent value="description">
                                    {displayed.description
                                        ? <IssueMarkdown content={displayed.description} />
                                        : <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Ticket chưa có mô tả.</p>
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
