'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'

interface DisableVariantsConfirmDialogProps {
    open: boolean
    onCancel: () => void
    onConfirm: () => void
}

// GH-2163 (TC-F08-02-06): confirm before turning off "has variants" when matrix data exists,
// because confirming wipes the tiers + variant rows.
export function DisableVariantsConfirmDialog({ open, onCancel, onConfirm }: DisableVariantsConfirmDialogProps) {
    const { t } = useI18n()
    const s = t.dashboard.products.form.sections

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
            <DialogContent className="dash-shell max-w-sm border-white/10 text-foreground" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>
                <DialogHeader>
                    <DialogTitle className="text-[16px] font-semibold text-foreground">
                        {s?.disableVariantsConfirmTitle || 'Turn off variants?'}
                    </DialogTitle>
                </DialogHeader>
                <p className="text-[13px] text-foreground/60">
                    {s?.disableVariantsConfirmDesc || 'Turning this off will delete all variant matrix data. Continue?'}
                </p>
                <DialogFooter className="gap-2 sm:gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-[14px] font-medium text-foreground hover:bg-white/10 transition-colors"
                    >
                        {s?.disableVariantsCancelBtn || 'No'}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-2 text-[14px] font-medium text-destructive hover:bg-destructive/25 transition-colors"
                    >
                        {s?.disableVariantsConfirmBtn || 'Yes'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
