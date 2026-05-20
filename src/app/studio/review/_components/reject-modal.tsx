'use client'
/**
 * RejectModal — confirm rejection with optional issue title + description.
 * POST /api/admin/review/reject. If issueTitle filled → creates TemplateIssue.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
    templateId: string
    templateName: string
    onClose: () => void
    onRejected: () => void
}

export function RejectModal({ templateId, templateName, onClose, onRejected }: Props) {
    const [issueTitle, setIssueTitle] = useState('')
    const [issueDescription, setIssueDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)
        try {
            const body: Record<string, unknown> = { templateId }
            if (issueTitle.trim()) {
                body.issueTitle = issueTitle.trim()
                body.issueDescription = issueDescription.trim() || undefined
            }

            const res = await fetch('/api/admin/review/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d.error ?? 'Reject failed')
            }

            const d = await res.json()
            const msg = d.issue
                ? `"${templateName}" rejected — issue created`
                : `"${templateName}" rejected and moved to draft`
            toast.success(msg)
            onRejected()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reject failed')
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reject Template</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{templateName}</span> will be moved
                        back to <span className="font-mono text-xs bg-muted px-1 rounded">draft</span>.
                    </p>

                    <div className="space-y-1.5">
                        <Label htmlFor="rj-title">
                            Issue title{' '}
                            <span className="text-xs text-muted-foreground font-normal">(optional — creates a linked issue)</span>
                        </Label>
                        <Input
                            id="rj-title"
                            value={issueTitle}
                            onChange={e => setIssueTitle(e.target.value)}
                            placeholder="e.g. Missing hero block, wrong personality"
                            maxLength={300}
                        />
                    </div>

                    {issueTitle.trim() && (
                        <div className="space-y-1.5">
                            <Label htmlFor="rj-desc">Issue description</Label>
                            <Textarea
                                id="rj-desc"
                                value={issueDescription}
                                onChange={e => setIssueDescription(e.target.value)}
                                placeholder="Describe what needs to be fixed…"
                                rows={4}
                                maxLength={5000}
                            />
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Rejecting…' : 'Reject'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
