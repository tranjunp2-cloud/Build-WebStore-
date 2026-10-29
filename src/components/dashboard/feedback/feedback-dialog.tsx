'use client'

import { useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DiscardConfirmDialog } from './discard-confirm-dialog'
import { FeedbackSuccessView } from './feedback-success-view'
import { FeedbackFormFields } from './feedback-form-fields'
import { submitFeedback } from './submit-feedback'
import { useFeedbackForm } from './use-feedback-form'
import { FEEDBACK_TYPES, type FeedbackContext, type FeedbackType, type SubmitFeedback } from './types'

type Props = {
    context: FeedbackContext
    /** Types this store may use; defaults to all. */
    types?: readonly FeedbackType[]
    onClose: () => void
    /** Override for tests / alternate transports. Defaults to the REST adapter. */
    submit?: SubmitFeedback
}

export function FeedbackDialog({ context, types = FEEDBACK_TYPES, onClose, submit = submitFeedback }: Props) {
    const { t, ti } = useI18n()
    const f = t.dashboard.feedback
    const form = useFeedbackForm({ context, submit })
    const uid = useId()
    const areaRef = useRef<HTMLButtonElement>(null)
    const detailsRef = useRef<HTMLTextAreaElement>(null)
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    const submitting = form.status === 'submitting'
    const done = form.status === 'success'
    const ids = { type: `${uid}-type`, area: `${uid}-area`, details: `${uid}-details` }

    // Closing a form with unsent input asks first; nothing to lose otherwise.
    const requestClose = () => {
        if (submitting) return
        if (!done && form.isDirty) setConfirmDiscard(true)
        else onClose()
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const invalid = await form.handleSubmit()
        if (invalid === 'area') areaRef.current?.focus()
        else if (invalid === 'details') detailsRef.current?.focus()
    }

    return (
        <>
            <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
                <DialogContent
                    showCloseButton={false}
                    aria-describedby={done ? undefined : `${uid}-desc`}
                    // Mobile (<sm): full-height sheet; form scrolls, footer button stays pinned.
                    className="flex max-h-[90vh] max-w-[480px] flex-col gap-0 overflow-hidden rounded-xl p-0 max-sm:left-0 max-sm:top-0 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:border-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
                    style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
                >
                    <div className="flex items-start gap-3 px-6 pb-3 pt-5 max-sm:items-center max-sm:[border-bottom:1px_solid_var(--dash-border)] max-sm:px-4 max-sm:py-3">
                        <button
                            type="button"
                            onClick={requestClose}
                            disabled={submitting}
                            aria-label={f.actions.close}
                            className="order-last rounded text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 max-sm:order-first"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <DialogTitle className="flex-1 text-lg font-bold leading-7 text-[var(--dash-text)] max-sm:pr-5 max-sm:text-center max-sm:text-base">
                            {f.title}
                        </DialogTitle>
                    </div>

                    {done ? (
                        <div className="flex flex-col gap-4 px-6 pb-6 pt-1">
                            <FeedbackSuccessView onClose={onClose} />
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
                            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4 max-sm:px-4 max-sm:pt-4">
                                <div className="flex flex-col gap-0.5 text-xs leading-4">
                                    <DialogDescription id={`${uid}-desc`} className="text-xs text-[var(--dash-text-muted)] max-sm:hidden">
                                        {f.description}
                                    </DialogDescription>
                                    {context.storeName && (
                                        <p className="text-[var(--cus-text-secondary)]">
                                            {ti(f.context.store, { store: context.storeName })}
                                        </p>
                                    )}
                                </div>

                                {(form.failure === 'failed' || form.failure === 'screenshot_too_large') && (
                                    <Alert variant="destructive" role="alert">
                                        <AlertTitle className="text-[hsl(var(--destructive))]">{f.failed.title}</AlertTitle>
                                        <AlertDescription className="text-xs text-[var(--dash-text)]">
                                            {form.failure === 'screenshot_too_large' ? f.failed.screenshotTooLarge : f.failed.description}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {form.failure === 'rate_limited' && (
                                    // Too many feedbacks: yellow banner, form stays open with its content.
                                    <Alert variant="warning" role="alert">
                                        <AlertDescription className="text-xs text-[var(--dash-text)]">{f.rateLimited}</AlertDescription>
                                    </Alert>
                                )}

                                <FeedbackFormFields
                                    form={form}
                                    submitting={submitting}
                                    types={types}
                                    ids={ids}
                                    areaRef={areaRef}
                                    detailsRef={detailsRef}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 [border-top:1px_solid_var(--dash-border)] px-6 py-4 max-sm:px-4">
                                {submitting && (
                                    <p aria-live="polite" className="mr-auto text-xs text-[var(--dash-text-muted)] max-sm:hidden">
                                        {f.sendingNote}
                                    </p>
                                )}
                                <Button type="button" variant="dashSecondary" className="px-4 max-sm:hidden" disabled={submitting} onClick={requestClose}>
                                    {f.actions.cancel}
                                </Button>
                                <Button type="submit" variant="dashPrimary" className="px-4 max-sm:h-11 max-sm:flex-1" disabled={submitting}>
                                    {submitting && <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                    {submitting ? f.actions.sending : f.actions.send}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <DiscardConfirmDialog
                open={confirmDiscard}
                onKeepEditing={() => setConfirmDiscard(false)}
                onDiscard={() => { setConfirmDiscard(false); onClose() }}
            />
        </>
    )
}
