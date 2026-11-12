'use client'

import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Props = { open: boolean; onKeepEditing: () => void; onDiscard: () => void }

/** Nested confirm shown when the user closes a form that has unsent input (Figma "Discard confirmation"). */
export function DiscardConfirmDialog({ open, onKeepEditing, onDiscard }: Props) {
    const { t } = useI18n()
    const d = t.dashboard.feedback.discard

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onKeepEditing() }}>
            <DialogContent
                showCloseButton={false}
                overlayClassName="z-[60]"
                className="z-[60] max-w-[400px] justify-items-center gap-0 rounded-xl p-6 text-center max-sm:w-[calc(100%-32px)]"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                <div aria-hidden className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/0.1)]">
                    <AlertCircle className="h-6 w-6 text-[hsl(var(--destructive))]" />
                </div>
                <DialogTitle className="text-base font-semibold leading-6 text-[var(--dash-text)]">{d.title}</DialogTitle>
                <DialogDescription className="mt-2 text-[13px] leading-5 text-[var(--dash-text-muted)]">{d.description}</DialogDescription>
                <div className="mt-6 flex justify-center gap-3">
                    <Button type="button" variant="dashSecondary" size="dash" onClick={onKeepEditing}>{d.keep}</Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="dash"
                        className="px-4 font-semibold !text-white"
                        onClick={onDiscard}
                    >
                        {d.confirm}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
