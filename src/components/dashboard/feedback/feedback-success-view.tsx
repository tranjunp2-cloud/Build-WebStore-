'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = { feedbackId: string; onClose: () => void }

/** Confirmation shown only after the API accepted the feedback (no ETA / SLA promised). */
export function FeedbackSuccessView({ feedbackId, onClose }: Props) {
    const { t } = useI18n()
    const f = t.dashboard.feedback
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(feedbackId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard can be blocked (insecure context / permissions); the ID stays selectable.
        }
    }

    return (
        <>
            <Alert variant="success" className="items-center py-2.5">
                <AlertTitle className="text-[hsl(var(--success))]">{f.success.title}</AlertTitle>
            </Alert>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[hsl(var(--secondary))] px-4 py-3">
                <div className="min-w-0">
                    <p className="text-xs leading-4 text-[var(--dash-text-muted)]">{f.success.feedbackId}</p>
                    <p className="select-all break-all text-[22px] font-bold leading-8 text-[var(--dash-text)]">{feedbackId}</p>
                </div>
                <Button type="button" variant="dashSecondary" className="shrink-0 px-4" onClick={copy} aria-live="polite">
                    {copied ? f.success.copied : f.success.copy}
                </Button>
            </div>
            <p className="text-[13px] leading-5 text-[var(--dash-text-muted)]">{f.success.notifyNote}</p>
            <div className="flex justify-end">
                <Button type="button" variant="dashPrimary" className="px-4" onClick={onClose}>{f.actions.close}</Button>
            </div>
        </>
    )
}
