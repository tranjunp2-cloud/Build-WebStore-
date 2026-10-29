'use client'

import { AlertCircle, Loader2, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { SaveBarLift } from '@/components/agent/save-bar-lift'

interface DiscountSaveBarProps {
    isNew: boolean
    saving: boolean
    onCancel: () => void
    onSave: () => void
}

// GH-1509: aligned to the same save-bar template as PaymentsFormClient.tsx /
// Shipping's SettingsFooter / CustomersDetail (floating rounded card,
// `--save-bar-bg`, amber "unsaved changes" indicator, size="sm" buttons) —
// was previously a full-width fixed bar with a different background token.
// Parent (discount-form.tsx) only mounts this while `dirty`, so whenever this
// renders it always means "there's something unsaved right now" — no need
// for the old isNew/upToDate status-text branching.
// `position: fixed` (not `sticky`) so it always sits bottom-4 from the viewport
// regardless of content length. `--dash-content-pl` (globals.css, GH-1592) aligns the
// left edge with the content column (sidebar + p-8 gutter) at lg+.
export function DiscountSaveBar({ isNew, saving, onCancel, onSave }: DiscountSaveBarProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.saveBar

    return (
        <div
            data-save-bar=""
            className="fixed z-40 bottom-4 left-4 right-4 lg:left-[var(--dash-content-pl)] lg:right-8 flex flex-wrap items-center justify-between gap-y-2 px-[18px] py-[12px] rounded-[14px] border border-solid border-[hsl(var(--border))]"
            style={{ background: 'var(--save-bar-bg)', boxShadow: 'var(--save-bar-shadow)' }}
        >
            <SaveBarLift />
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
