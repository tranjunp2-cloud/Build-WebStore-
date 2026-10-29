'use client'

import { useI18n } from '@/i18n'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = { onClose: () => void }

/** Confirmation shown only after the API accepted the feedback (no ETA / SLA promised). */
export function FeedbackSuccessView({ onClose }: Props) {
    const { t } = useI18n()
    const f = t.dashboard.feedback
    return (
        <>
            <Alert variant="success" className="items-center py-2.5">
                <AlertTitle className="text-[hsl(var(--success))]">{f.success.title}</AlertTitle>
            </Alert>
            <p className="text-[13px] leading-5 text-[var(--dash-text-muted)]">{f.success.notifyNote}</p>
            <div className="flex justify-end">
                <Button type="button" variant="dashPrimary" className="px-4" onClick={onClose}>{f.actions.close}</Button>
            </div>
        </>
    )
}
