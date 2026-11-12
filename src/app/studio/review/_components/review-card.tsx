'use client'
/**
 * ReviewCard — single template in the review queue.
 * Shows thumbnail, metadata, DNA compliance badge, approve/reject actions.
 */
import { useState } from 'react'
import { ImageOff, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useStudioCan } from '../../_components/studio-permissions-context'
import { RejectModal } from './reject-modal'
import type { ReviewTemplate } from './review-queue'
import type { ComplianceResult } from '@/lib/admin/dna-compliance'

type Props = {
    template: ReviewTemplate
    onResolved: () => void
}

function ComplianceBadge({ cache }: { cache: ComplianceResult | null | undefined }) {
    if (!cache) {
        return <span className="text-xs text-muted-foreground">No compliance data</span>
    }
    const color = cache.pass
        ? 'bg-green-100 text-green-800'
        : cache.score >= 60
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800'
    const errorCount = cache.violations.filter(v => v.severity === 'error').length
    const warnCount = cache.violations.filter(v => v.severity === 'warning').length

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {cache.pass ? '✓ Pass' : '✗ Fail'} — {cache.score}/100
            {(errorCount > 0 || warnCount > 0) && (
                <span className="ml-1 opacity-70">
                    {errorCount > 0 && `${errorCount}err `}{warnCount > 0 && `${warnCount}warn`}
                </span>
            )}
        </span>
    )
}

export function ReviewCard({ template, onResolved }: Props) {
    const canDecide = useStudioCan()('template.review')
    const [approving, setApproving] = useState(false)
    const [showReject, setShowReject] = useState(false)

    const handleApprove = async () => {
        setApproving(true)
        try {
            const res = await fetch('/api/admin/review/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: template.id }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Approve failed')
            toast.success(`"${template.name}" approved and set to live`)
            onResolved()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Approve failed')
            setApproving(false)
        }
    }

    const categoryList = template.category.join(', ') || '—'

    return (
        <>
            <div className="rounded-lg border bg-card flex gap-4 p-4 items-start">
                {/* Thumbnail */}
                <div className="w-24 h-16 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                    {template.thumbnail?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={template.thumbnail.url} alt={template.name} className="w-full h-full object-cover" />
                    ) : (
                        <ImageOff size={16} className="text-muted-foreground opacity-40" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="font-medium text-sm">{template.name}</h3>
                            <p className="text-xs text-muted-foreground">{categoryList}</p>
                        </div>
                        <ComplianceBadge cache={template.dnaComplianceCache} />
                    </div>

                    {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                        {canDecide && <>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={handleApprove}
                            disabled={approving}
                        >
                            <CheckCircle size={12} />
                            {approving ? 'Approving…' : 'Approve'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setShowReject(true)}
                            disabled={approving}
                        >
                            <XCircle size={12} /> Reject
                        </Button>
                        </>}
                        <span className="ml-auto text-xs text-muted-foreground">
                            Updated {new Date(template.updatedAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {showReject && canDecide && (
                <RejectModal
                    templateId={template.id}
                    templateName={template.name}
                    onClose={() => setShowReject(false)}
                    onRejected={onResolved}
                />
            )}
        </>
    )
}
