'use client'

import { Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'

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
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
            <DialogContent
                className="max-w-sm text-center [&>button]:hidden"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon */}
                <div className="flex justify-center mb-2">
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-red-500/15">
                        <Trash2 className="h-7 w-7 text-red-500" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--dash-text)' }}>
                    Delete discount &lsquo;{code}&rsquo;?
                </h2>

                {/* Description */}
                <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--dash-text-muted)' }}>
                    The code will stop working immediately and won&apos;t be redeemable at checkout.
                    Its <strong style={{ color: 'var(--dash-text)' }}>usage history is preserved</strong> for audit.
                </p>

                {usageCount > 0 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400 text-left mt-2">
                        ⚠ {usageCount} {usageCount === 1 ? 'order has' : 'orders have'} used this code. Deleting it
                        won&apos;t undo those discounts but the code can&apos;t be reused.
                    </div>
                )}

                {/* Buttons */}
                <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                        className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--dash-text)' }}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                        onClick={onConfirm}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete discount
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
