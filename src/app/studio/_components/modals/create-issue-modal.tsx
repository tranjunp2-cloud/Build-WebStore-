'use client'

/**
 * CreateIssueModal — create a new issue with optional pre-filled relation.
 * Fields: title, description (with markdown preview toggle), severity,
 * category, relatedType, relatedId.
 * Submits → POST /api/admin/issues
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { IssueRecord, IssueRelatedType, IssueSeverity, IssueStatus, RuntimePromotionInput } from '@/app/studio/issues/_components/issue-types'
import { IssueMarkdown } from '@/app/studio/issues/_components/issue-markdown'

type Props = {
    onClose: () => void
    onCreated?: (issue?: IssueRecord, created?: boolean) => void
    /** Board columns can create directly into their own stage. Not user-editable here. */
    defaultStatus?: IssueStatus
    /** Context callers may attach a ticket silently without exposing ID inputs. */
    defaultRelatedType?: IssueRelatedType
    defaultRelatedId?: string
    /** Runtime promotion sends provider identity only; evidence is refetched server-side. */
    runtimePromotion?: RuntimePromotionInput
}

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
]

const BUG_REPORT_TEMPLATE = `# Bug Report: [Mô tả ngắn gọn lỗi]

**Bug ID:** BUG-FXX-XXX
**Feature/Module:** FXX – [Tên feature]
**Environment:** Staging / Production
**Browser/Device:** Chrome xx / macOS / Desktop
**Tester:** @username
**Date:** YYYY-MM-DD
**Severity:** Critical / High / Medium / Low
**Priority:** P0 / P1 / P2 / P3

### Preconditions
- Người dùng đã đăng nhập với role: …
- Có dữ liệu: …

### Steps to Reproduce
1. Truy cập \`...\`
2. Thực hiện \`...\`
3. Nhấn \`...\`

### Actual Result
Mô tả chính xác hành vi hiện tại.

### Expected Result
Mô tả hành vi đúng theo yêu cầu/Acceptance Criteria.

### Evidence
- Screenshot/video: [link]
- Console error: [nếu có]
- Network/API response: [nếu có]

### Impact
- Ảnh hưởng đến: người dùng/chức năng/dữ liệu nào?
- Tần suất: Always / Intermittent / Once
- Có workaround không: Có / Không`

export function CreateIssueModal({
    onClose,
    onCreated,
    defaultStatus,
    defaultRelatedType,
    defaultRelatedId,
    runtimePromotion,
}: Props) {
    const [title, setTitle] = useState(runtimePromotion?.title ?? '')
    const [description, setDescription] = useState(runtimePromotion ? '' : BUG_REPORT_TEMPLATE)
    const [severity, setSeverity] = useState<IssueSeverity>(runtimePromotion?.severity ?? 'medium')
    const [assignmentTarget, setAssignmentTarget] = useState<'unassigned' | 'dev'>('unassigned')
    const [previewMd, setPreviewMd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canSubmit = title.trim().length > 0
        && (runtimePromotion ? runtimePromotion.providerId.length > 0 : description.trim().length > 0)

    async function handleSubmit() {
        if (!canSubmit) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(runtimePromotion
                    ? {
                        relatedType: 'runtime',
                        source: runtimePromotion.source,
                        providerId: runtimePromotion.providerId,
                        title: title.trim(),
                        severity,
                    }
                    : {
                        title: title.trim(),
                        description: description.trim() || undefined,
                        severity,
                        status: defaultStatus ?? 'backlog',
                        ...(defaultRelatedType && defaultRelatedId && defaultRelatedType !== 'runtime' && defaultRelatedType !== 'manual'
                            ? { relatedType: defaultRelatedType, relatedId: defaultRelatedId }
                            : {}),
                        assignmentTarget,
                    }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({})) as { error?: string }
                throw new Error(j.error ?? 'Create failed')
            }
            const result = await res.json() as { data?: IssueRecord; created?: boolean }
            if (runtimePromotion && !result.data) throw new Error('Issue response was invalid')
            onCreated?.(result.data, result.created ?? true)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="issue-create-dialog">
                <DialogHeader>
                    <DialogTitle>{runtimePromotion ? 'Create tracked issue' : 'Tạo ticket bug'}</DialogTitle>
                    <DialogDescription>
                        {runtimePromotion
                            ? 'Review the title and severity. Prime refetches safe provider evidence when you submit.'
                            : 'Điền theo mẫu Bug Report để Dev có thể tái hiện và xử lý ngay.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="issue-create-form">
                    {runtimePromotion && (
                        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold capitalize">{runtimePromotion.source}</span>
                                <code className="break-all text-xs text-muted-foreground" translate="no">
                                    {runtimePromotion.providerId}
                                </code>
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-1.5">
                            <Label htmlFor="ci-title">Tiêu đề lỗi <span className="text-destructive">*</span></Label>
                        <Input
                            id="ci-title"
                            name="issue-title"
                            autoComplete="off"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ví dụ: Không thể lưu website sau khi tạo trang Liên hệ"
                            className="min-h-11 text-base sm:text-sm"
                            maxLength={300}
                        />
                    </div>

                    {/* Manual ticket: severity plus an optional developer owner. */}
                    <div className={`issue-create-grid ${runtimePromotion ? 'issue-create-grid-single' : ''}`}>
                        <div className="space-y-1.5">
                            <Label htmlFor="ci-severity">Severity</Label>
                            <select
                                id="ci-severity"
                                name="issue-severity"
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                                className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base sm:text-sm"
                            >
                                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        {!runtimePromotion && (
                            <div className="space-y-1.5">
                                <Label htmlFor="ci-assignee">Người phụ trách</Label>
                                <select
                                    id="ci-assignee"
                                    name="issue-assignee"
                                    value={assignmentTarget}
                                    onChange={(e) => setAssignmentTarget(e.target.value as 'unassigned' | 'dev')}
                                    className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base sm:text-sm"
                                >
                                    <option value="unassigned">Chưa phân công</option>
                                    <option value="dev">DEV</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Description with markdown preview toggle */}
                    {!runtimePromotion && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                            <Label htmlFor="ci-desc">Bug report <span className="text-destructive">*</span></Label>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMd((p) => !p)}
                                    className="min-h-11 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {previewMd ? 'Edit' : 'Preview'}
                                </button>
                            </div>
                            {previewMd
                                ? (
                                    <div className="min-h-[80px] rounded-md border border-input bg-muted/30 p-3">
                                        {description.trim()
                                            ? <IssueMarkdown content={description} />
                                            : <p className="text-sm text-muted-foreground">Nothing to preview.</p>
                                        }
                                    </div>
                                )
                                : (
                                    <Textarea
                                        id="ci-desc"
                                        name="issue-description"
                                        autoComplete="off"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Mô tả lỗi theo template… (Markdown hỗ trợ)"
                                        className="text-base sm:text-sm"
                                        rows={4}
                                        maxLength={10000}
                                    />
                                )
                            }
                        </div>
                    )}

                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

                    <div className="issue-create-actions">
                        <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
                            Hủy
                        </Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading || !canSubmit}>
                            {loading
                                ? runtimePromotion ? 'Đang tạo…' : 'Đang tạo…'
                                : runtimePromotion ? 'Tạo tracked issue' : 'Tạo ticket'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
