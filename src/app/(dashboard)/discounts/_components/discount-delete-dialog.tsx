'use client'

import { Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n'

interface DiscountDeleteDialogProps {
    code: string
    usageCount: number
    open: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function DiscountDeleteDialog({
    code,
    usageCount,
    open,
    onConfirm,
    onCancel,
}: DiscountDeleteDialogProps) {
    const { t, ti } = useI18n()
    const d = t.dashboard.discounts

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
            <DialogContent
                className="max-w-sm text-center [&>button]:hidden"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon */}
                <div className="flex justify-center mb-2">
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-destructive/15">
                        <Trash2 className="h-7 w-7 text-destructive" />
                    </div>
                </div>

                {/* Title (DialogTitle — required by Radix for a11y) */}
                <DialogTitle className="text-[15px] font-semibold" style={{ color: 'var(--dash-text)' }}>
                    {ti(d.deleteDialog.title, { code })}
                </DialogTitle>

                {/* Description */}
                <DialogDescription className="text-sm leading-relaxed mt-1" style={{ color: 'var(--dash-text-muted)' }}>
                    {d.deleteDialog.description}
                </DialogDescription>

                {usageCount > 0 && (
                    <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning text-left mt-2">
                        ⚠ {usageCount}{' '}
                        {usageCount === 1 ? d.deleteDialog.usageWarningOrder : d.deleteDialog.usageWarningOrders}{' '}
                        {d.deleteDialog.usageWarningSuffix}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                        className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text)' }}
                        onClick={onCancel}
                    >
                        {d.deleteDialog.cancel}
                    </button>
                    <button
                        className="flex items-center gap-1.5 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive"
                        onClick={onConfirm}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        {d.deleteDialog.confirm}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
