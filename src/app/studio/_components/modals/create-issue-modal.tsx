'use client'

/**
 * CreateIssueModal — create a new issue with optional pre-filled relation.
 * Fields: title, description (with markdown preview toggle), severity,
 * category, relatedType, relatedId.
 * Submits → POST /api/admin/issues
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { IssueRelatedType, IssueSeverity, IssueCategory } from '@/app/studio/issues/_components/issue-types'
import { IssueMarkdown } from '@/app/studio/issues/_components/issue-markdown'

type Props = {
    onClose: () => void
    onCreated?: () => void
    /** Pre-fill relation context (from template/generation drawers) */
    defaultRelatedType?: IssueRelatedType
    defaultRelatedId?: string
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

const RELATED_TYPE_OPTIONS: { value: IssueRelatedType; label: string }[] = [
    { value: 'template', label: 'Template' },
    { value: 'generation', label: 'Generation' },
    { value: 'block', label: 'Block' },
]

export function CreateIssueModal({ onClose, onCreated, defaultRelatedType, defaultRelatedId }: Props) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [severity, setSeverity] = useState<IssueSeverity>('medium')
    const [category, setCategory] = useState<IssueCategory>('other')
    const [relatedType, setRelatedType] = useState<IssueRelatedType>(defaultRelatedType ?? 'template')
    const [relatedId, setRelatedId] = useState(defaultRelatedId ?? '')
    const [previewMd, setPreviewMd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canSubmit = title.trim().length > 0 && relatedId.trim().length > 0

    async function handleSubmit() {
        if (!canSubmit) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
            onCreated?.()
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
                    <DialogTitle>Report issue</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="ci-title">Title <span className="text-destructive">*</span></Label>
                        <Input
                            id="ci-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief description of the issue"
                            autoFocus
                            maxLength={300}
                        />
                    </div>

                    {/* Severity + Category */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="ci-severity">Severity</Label>
                            <select
                                id="ci-severity"
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ci-category">Category</Label>
                            <select
                                id="ci-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Related entity */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="ci-related-type">Related to</Label>
                            <select
                                id="ci-related-type"
                                value={relatedType}
                                onChange={(e) => setRelatedType(e.target.value as IssueRelatedType)}
                                disabled={!!defaultRelatedType}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-60"
                            >
                                {RELATED_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ci-related-id">ID / Slug <span className="text-destructive">*</span></Label>
                            <Input
                                id="ci-related-id"
                                value={relatedId}
                                onChange={(e) => setRelatedId(e.target.value)}
                                placeholder="e.g. 42 or block-slug"
                                disabled={!!defaultRelatedId}
                            />
                        </div>
                    </div>

                    {/* Description with markdown preview toggle */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="ci-desc">Description</Label>
                            <button
                                type="button"
                                onClick={() => setPreviewMd((p) => !p)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the issue… (markdown supported)"
                                    rows={4}
                                    maxLength={10000}
                                />
                            )
                        }
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading || !canSubmit}>
                            {loading ? 'Reporting…' : 'Report issue'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
