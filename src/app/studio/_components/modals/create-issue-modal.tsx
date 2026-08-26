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
import type {
    IssueCategory,
    IssueRecord,
    IssueRelatedType,
    IssueSeverity,
    RuntimePromotionInput,
} from '@/app/studio/issues/_components/issue-types'
import { IssueMarkdown } from '@/app/studio/issues/_components/issue-markdown'

type Props = {
    onClose: () => void
    onCreated?: (issue?: IssueRecord, created?: boolean) => void
    /** Pre-fill relation context (from template/generation drawers) */
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

const CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = [
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'performance', label: 'Performance' },
    { value: 'content', label: 'Content' },
    { value: 'ui', label: 'UI' },
    { value: 'ai-quality', label: 'AI Quality' },
    { value: 'other', label: 'Other' },
]

const RELATED_TYPE_OPTIONS: { value: Exclude<IssueRelatedType, 'runtime'>; label: string }[] = [
    { value: 'template', label: 'Template' },
    { value: 'generation', label: 'Generation' },
    { value: 'block', label: 'Block' },
]

export function CreateIssueModal({
    onClose,
    onCreated,
    defaultRelatedType,
    defaultRelatedId,
    runtimePromotion,
}: Props) {
    const [title, setTitle] = useState(runtimePromotion?.title ?? '')
    const [description, setDescription] = useState('')
    const [severity, setSeverity] = useState<IssueSeverity>(runtimePromotion?.severity ?? 'medium')
    const [category, setCategory] = useState<IssueCategory>('other')
    const [relatedType, setRelatedType] = useState<IssueRelatedType>(defaultRelatedType ?? 'template')
    const [relatedId, setRelatedId] = useState(defaultRelatedId ?? '')
    const [previewMd, setPreviewMd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canSubmit = title.trim().length > 0
        && (runtimePromotion ? runtimePromotion.providerId.length > 0 : relatedId.trim().length > 0)

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
                        category,
                        relatedType,
                        relatedId: relatedId.trim(),
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{runtimePromotion ? 'Create tracked issue' : 'Report issue'}</DialogTitle>
                    <DialogDescription>
                        {runtimePromotion
                            ? 'Review the title and severity. Prime refetches safe provider evidence when you submit.'
                            : 'Add an issue to the existing tracking workflow.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
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
                        <Label htmlFor="ci-title">Title <span className="text-destructive">*</span></Label>
                        <Input
                            id="ci-title"
                            name="issue-title"
                            autoComplete="off"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief description of the issue…"
                            className="min-h-11 text-base sm:text-sm"
                            maxLength={300}
                        />
                    </div>

                    {/* Severity + Category */}
                    <div className={`grid gap-3 ${runtimePromotion ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
                                <Label htmlFor="ci-category">Category</Label>
                                <select
                                    id="ci-category"
                                    name="issue-category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                                    className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base sm:text-sm"
                                >
                                    {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Related entity */}
                    {!runtimePromotion && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="ci-related-type">Related to</Label>
                                <select
                                    id="ci-related-type"
                                    name="issue-related-type"
                                    value={relatedType}
                                    onChange={(e) => setRelatedType(e.target.value as IssueRelatedType)}
                                    disabled={!!defaultRelatedType}
                                    className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base disabled:opacity-60 sm:text-sm"
                                >
                                    {RELATED_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ci-related-id">ID / Slug <span className="text-destructive">*</span></Label>
                                <Input
                                    id="ci-related-id"
                                    name="issue-related-id"
                                    autoComplete="off"
                                    value={relatedId}
                                    onChange={(e) => setRelatedId(e.target.value)}
                                    placeholder="e.g. 42 or block-slug…"
                                    className="min-h-11 text-base sm:text-sm"
                                    disabled={!!defaultRelatedId}
                                />
                            </div>
                        </div>
                    )}

                    {/* Description with markdown preview toggle */}
                    {!runtimePromotion && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ci-desc">Description</Label>
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
                                        placeholder="Describe the issue… (markdown supported)"
                                        className="text-base sm:text-sm"
                                        rows={4}
                                        maxLength={10000}
                                    />
                                )
                            }
                        </div>
                    )}

                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading || !canSubmit}>
                            {loading
                                ? runtimePromotion ? 'Creating…' : 'Reporting…'
                                : runtimePromotion ? 'Create tracked issue' : 'Report issue'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
