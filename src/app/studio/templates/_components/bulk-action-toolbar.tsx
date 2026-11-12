'use client'
/**
 * Bulk action toolbar — bundle Variant B: floating bottom pill.
 * Appears (slides up) when ≥1 template selected.
 * Actions: Publish | Schedule | Archive | Delete | Re-score | Clear
 * Re-score warns if >20 selected (Vercel 60s timeout constraint).
 */
import { useState } from 'react'
import { Rocket, Clock, Archive, Trash2, X, Star } from 'lucide-react'
import { ScheduleTemplateModal } from '../../_components/modals/schedule-template-modal'
import { useStudioCan } from '../../_components/studio-permissions-context'

const BULK_RESCORE_MAX = 20

type BulkActionType = 'publish' | 'archive' | 'schedule' | 'delete' | 're-score'

type Props = {
    count: number
    onAction: (action: BulkActionType, scheduledFor?: string) => Promise<void>
    onClear: () => void
}

export function BulkActionToolbar({ count, onAction, onClear }: Props) {
    const [loading, setLoading] = useState<BulkActionType | null>(null)
    const [showSchedule, setShowSchedule] = useState(false)

    const handle = async (action: BulkActionType) => {
        if (action === 'schedule') { setShowSchedule(true); return }
        if (action === 're-score' && count > BULK_RESCORE_MAX) {
            alert(`Re-score is limited to ${BULK_RESCORE_MAX} templates at a time to stay within Vercel's 60s timeout. Deselect some and try again.`)
            return
        }
        setLoading(action)
        try { await onAction(action) } finally { setLoading(null) }
    }

    const handleScheduleConfirm = async (scheduledFor: string) => {
        setShowSchedule(false)
        setLoading('schedule')
        try { await onAction('schedule', scheduledFor) } finally { setLoading(null) }
    }

    const busy = loading !== null
    const can = useStudioCan()
    const canReview = can('template.review')
    // The server skips rows the user may not archive, so editors still get the archive/delete buttons.
    const canArchiveOrDelete = canReview || can('template.edit')
    const canScore = can('template.score')
    const hasMidGroup = canReview || canArchiveOrDelete || canScore

    return (
        <>
            {/* Floating pill — always rendered, slide controlled by .active class */}
            <div className={`bulk-floating${count > 0 ? ' active' : ''}`}>
                <span className="count">{count}</span>
                <span style={{ color: 'var(--text-3)' }}>selected</span>

                {hasMidGroup && <div className="divider" />}

                {canReview && (
                    <>
                <button
                    className="btn-float"
                    disabled={busy}
                    onClick={() => handle('publish')}
                >
                    <Rocket size={13} />
                    {loading === 'publish' ? 'Publishing…' : 'Publish'}
                </button>

                <button
                    className="btn-float"
                    disabled={busy}
                    onClick={() => handle('schedule')}
                >
                    <Clock size={13} /> Schedule
                </button>
                    </>
                )}

                {canArchiveOrDelete && (
                <button
                    className="btn-float"
                    disabled={busy}
                    onClick={() => handle('archive')}
                >
                    <Archive size={13} />
                    {loading === 'archive' ? 'Archiving…' : 'Archive'}
                </button>
                )}

                {canScore && (
                <button
                    className="btn-float"
                    disabled={busy}
                    onClick={() => handle('re-score')}
                    title={count > BULK_RESCORE_MAX ? `Max ${BULK_RESCORE_MAX} at a time` : 'Score selected'}
                >
                    <Star size={13} />
                    {loading === 're-score' ? 'Scoring…' : 'Re-score'}
                </button>
                )}

                {canArchiveOrDelete && (
                    <>
                <div className="divider" />

                <button
                    className="btn-float btn-danger"
                    disabled={busy}
                    onClick={() => handle('delete')}
                >
                    <Trash2 size={13} />
                </button>
                    </>
                )}

                <button
                    className="btn-float"
                    onClick={onClear}
                    aria-label="Clear selection"
                >
                    <X size={13} />
                </button>
            </div>

            {showSchedule && canReview && (
                <ScheduleTemplateModal
                    template={null}
                    onClose={() => setShowSchedule(false)}
                    onScheduled={handleScheduleConfirm}
                />
            )}
        </>
    )
}
