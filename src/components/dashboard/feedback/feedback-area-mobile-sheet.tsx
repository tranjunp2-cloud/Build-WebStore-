'use client'

import { useEffect, useId, useState } from 'react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FeedbackAreaOptionsList } from './feedback-area-options-list'
import type { FeedbackArea } from './types'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    value: readonly FeedbackArea[]
    onChange: (next: FeedbackArea[]) => void
}

/**
 * Mobile Feature picker (Figma "13 · Mobile 375 — chọn Tính năng"): bottom sheet over the form.
 * Picks are a draft until "Done"; closing any other way leaves the field unchanged.
 */
export function FeedbackAreaMobileSheet({ open, onOpenChange, value, onChange }: Props) {
    const { t, ti } = useI18n()
    const f = t.dashboard.feedback.fields
    const titleId = useId()
    const [draft, setDraft] = useState<FeedbackArea[]>([...value])

    // Start from the field's current value each time the sheet opens.
    useEffect(() => {
        if (open) setDraft([...value])
    }, [open, value])

    const done = () => {
        onChange(draft)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                aria-labelledby={titleId}
                overlayClassName="z-[60] bg-black/40"
                className="bottom-0 left-0 top-auto z-[60] flex max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-[var(--dash-border)]" />
                <div className="flex items-center justify-between px-4 py-3 [border-bottom:1px_solid_var(--dash-border)]">
                    <DialogTitle id={titleId} className="text-base font-semibold text-[var(--dash-text)]">
                        {f.areaSheetTitle}
                    </DialogTitle>
                    <DialogDescription className="sr-only">{f.areaPlaceholder}</DialogDescription>
                    <button
                        type="button"
                        onClick={() => setDraft([])}
                        disabled={draft.length === 0}
                        className="rounded text-sm font-medium text-[hsl(var(--info))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                        {f.areaClearAll}
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <FeedbackAreaOptionsList value={draft} onChange={setDraft} labelledBy={titleId} size="md" />
                </div>
                <div className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 [border-top:1px_solid_var(--dash-border)]">
                    <Button type="button" variant="dashPrimary" size="dash" className="h-11 w-full" onClick={done}>
                        {draft.length ? ti(f.areaDoneCount, { count: draft.length }) : f.areaDone}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
