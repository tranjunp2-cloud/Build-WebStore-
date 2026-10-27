'use client'

import { useMemo, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useI18n } from '@/i18n'
import { FeedbackDialog } from './feedback-dialog'
import type { FeedbackContext } from './types'

type FeedbackButtonProps = {
    /** Current store name shown in the report context; omitted line when absent. */
    storeName?: string
}

/**
 * Header "Feedback" entry (Figma Topbar 34993:3329). Opens the feedback dialog.
 */
export function FeedbackButton({ storeName }: FeedbackButtonProps) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const context = useMemo<FeedbackContext>(() => ({ storeName }), [storeName])
    const label = t.dashboard.feedback.button

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={label}
                aria-haspopup="dialog"
                // Preflight is OFF → full border shorthand. Label hides below md (header is tight
                // on mobile: ☰ + logo + bell + theme + avatar); the aria-label keeps it accessible.
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-transparent px-2.5 text-[13px] font-medium leading-5 text-[var(--dash-accent)] outline-none transition-colors [border:1px_solid_var(--dash-accent)] hover:bg-[hsl(var(--primary)/0.1)] focus-visible:ring-2 focus-visible:ring-ring md:mr-4 md:px-3"
            >
                <MessageSquareText aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">{label}</span>
            </button>
            {open && <FeedbackDialog context={context} onClose={() => setOpen(false)} />}
        </>
    )
}
