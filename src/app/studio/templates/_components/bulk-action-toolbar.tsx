'use client'
/**
 * Floating bulk action toolbar — appears bottom-right when ≥1 template selected.
 * Actions: Publish, Schedule, Archive, Delete (soft = archive), Re-score.
 * Re-score warns if >20 selected (Vercel timeout constraint).
 */
import { useState } from 'react'
import { Rocket, Clock, Archive, Trash2, X, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScheduleTemplateModal } from '../../_components/modals/schedule-template-modal'

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
        if (action === 'schedule') {
            setShowSchedule(true)
            return
        }
        if (action === 're-score' && count > BULK_RESCORE_MAX) {
            // Warn rather than silently cap
            alert(`Re-score is limited to ${BULK_RESCORE_MAX} templates at a time to stay within Vercel's 60s timeout. Please deselect some templates and try again.`)
            return
        }
        setLoading(action)
        try {
            await onAction(action)
        } finally {
            setLoading(null)
        }
    }

    const handleScheduleConfirm = async (scheduledFor: string) => {
        setShowSchedule(false)
        setLoading('schedule')
        try {
            await onAction('schedule', scheduledFor)
        } finally {
            setLoading(null)
        }
    }

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border bg-background shadow-xl px-4 py-3 animate-in slide-in-from-bottom-4">
                {/* Count pill */}
                <span className="text-sm font-medium text-foreground mr-1">
                    <span className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs font-bold mr-1.5">
                        {count}
                    </span>
                    selected
                </span>

                <div className="w-px h-5 bg-border mx-1" />

                <Button
                    size="sm"
                    variant="outline"
                    disabled={loading !== null}
                    onClick={() => handle('publish')}
                    className="gap-1.5"
                >
                    <Rocket size={13} />
                    {loading === 'publish' ? 'Publishing…' : 'Publish'}
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    disabled={loading !== null}
                    onClick={() => handle('schedule')}
                    className="gap-1.5"
                >
                    <Clock size={13} />
                    Schedule
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    disabled={loading !== null}
                    onClick={() => handle('archive')}
                    className="gap-1.5"
                >
                    <Archive size={13} />
                    {loading === 'archive' ? 'Archiving…' : 'Archive'}
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    disabled={loading !== null}
                    onClick={() => handle('delete')}
                    className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                    <Trash2 size={13} />
                    {loading === 'delete' ? 'Removing…' : 'Delete'}
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    disabled={loading !== null}
                    onClick={() => handle('re-score')}
                    className="gap-1.5"
                    title={count > BULK_RESCORE_MAX ? `Max ${BULK_RESCORE_MAX} at a time` : 'Score selected templates'}
                >
                    <Star size={13} />
                    {loading === 're-score' ? 'Scoring…' : 'Re-score'}
                </Button>

                <div className="w-px h-5 bg-border mx-1" />

                <button
                    onClick={onClear}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    aria-label="Clear selection"
                >
                    <X size={14} />
                </button>
            </div>

            {showSchedule && (
                <ScheduleTemplateModal
                    template={null}
                    onClose={() => setShowSchedule(false)}
                    onScheduled={handleScheduleConfirm}
                />
            )}
        </>
    )
}
