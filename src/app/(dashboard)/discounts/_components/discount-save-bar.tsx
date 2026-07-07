'use client'

import { AlertCircle, Loader2, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

interface DiscountSaveBarProps {
    isNew: boolean
    saving: boolean
    onCancel: () => void
    onSave: () => void
}

// GH-1509: aligned to the same save-bar template as PaymentsFormClient.tsx /
// Shipping's SettingsFooter / CustomersDetail (sticky floating rounded card,
// `--save-bar-bg`, amber "unsaved changes" indicator, size="sm" buttons) —
// was previously a full-width fixed bar with a different background token.
// Parent (discount-form.tsx) only mounts this while `dirty`, so whenever this
// renders it always means "there's something unsaved right now" — no need
// for the old isNew/upToDate status-text branching.
export function DiscountSaveBar({ isNew, saving, onCancel, onSave }: DiscountSaveBarProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.saveBar

    return (
        <div
            className="sticky bottom-4 z-40 flex flex-wrap items-center justify-between gap-y-2 px-[18px] py-[12px] rounded-[14px] border border-white/[0.08] mt-6"
            style={{ background: 'var(--save-bar-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.6)' }}
        >
            <div className="flex items-center gap-2 text-[13px]">
                <AlertCircle className="w-[14px] h-[14px] text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-amber-600 dark:text-amber-300 font-medium">{d.unsavedChanges}</span>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    variant="dashSecondary"
                    size="sm"
                >
                    {d.cancel}
                </Button>

                <Button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    size="sm"
                >
                    {saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Check className="h-3.5 w-3.5" />
                    }
                    {saving ? d.saving : isNew ? d.saveDiscount : d.save}
                </Button>
            </div>
        </div>
    )
}
