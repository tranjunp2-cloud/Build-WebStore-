'use client'
/**
 * Schedule template modal — date/time picker + confirm.
 * Works for both single-template and bulk-schedule flows.
 * When template is null → bulk mode (onScheduled receives ISO string, not a patchTemplate call).
 */
import { useState } from 'react'
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { patchTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type SingleProps = {
    template: AdminTemplate
    onClose: () => void
    onScheduled: () => void
}

type BulkProps = {
    template: null
    onClose: () => void
    onScheduled: (scheduledFor: string) => void
}

type Props = SingleProps | BulkProps

function isBulk(props: Props): props is BulkProps {
    return props.template === null
}

export function ScheduleTemplateModal(props: Props) {
    const { onClose } = props
    // Default: 24h from now rounded to next hour
    const defaultDt = () => {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
        d.setMinutes(0, 0, 0)
        // Format for datetime-local: YYYY-MM-DDTHH:mm
        return d.toISOString().slice(0, 16)
    }

    const [datetime, setDatetime] = useState(defaultDt)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!datetime) {
            setError('Please select a date and time')
            return
        }
        const iso = new Date(datetime).toISOString()
        setLoading(true)
        setError(null)
        try {
            if (isBulk(props)) {
                props.onScheduled(iso)
            } else {
                await patchTemplate(props.template.id, {
                    status: 'scheduled',
                    scheduledFor: iso,
                })
                props.onScheduled()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Schedule failed')
            setLoading(false)
        }
    }

    const templateName = !isBulk(props) ? props.template.name : null

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Schedule publish</DialogTitle>
                    {templateName && (
                        <DialogDescription>
                            <span className="font-medium text-foreground">{templateName}</span> will go live at the selected time.
                        </DialogDescription>
                    )}
                    {isBulk(props) && (
                        <DialogDescription>
                            Selected templates will go live at the chosen date and time.
                        </DialogDescription>
                    )}
                </DialogHeader>
                <form onSubmit={handleConfirm} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="schedule-dt">Publish date &amp; time</Label>
                        <input
                            id="schedule-dt"
                            type="datetime-local"
                            value={datetime}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={e => setDatetime(e.target.value)}
                            required
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !datetime}>
                            {loading ? 'Scheduling…' : 'Schedule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
