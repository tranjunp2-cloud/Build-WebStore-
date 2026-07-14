'use client'

import { AlertCircle, Loader2, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

type Props = {
    saving: boolean
    saveLabel: string
    savingLabel: string
    onCancel: () => void
}

// Same floating save-bar template as DiscountSaveBar / PaymentsFormClient /
// Shipping SettingsFooter (GH-1509): fixed rounded card at bottom-4,
// `--save-bar-bg` + `--save-bar-shadow` tokens, amber unsaved indicator,
// size="sm" buttons, `--dash-content-pl` left alignment at lg+ (GH-1592).
// Must be rendered INSIDE the tab's <form> — the save button is type="submit";
// parent mounts it only while the form is dirty.
export function ProfileSaveBar({ saving, saveLabel, savingLabel, onCancel }: Props) {
    const { t } = useI18n()

    return (
        <div
            className="fixed z-40 bottom-4 left-4 right-4 lg:left-[var(--dash-content-pl)] lg:right-8 flex flex-wrap items-center justify-between gap-y-2 px-[18px] py-[12px] rounded-[14px] border border-solid border-[hsl(var(--border))]"
            style={{ background: 'var(--save-bar-bg)', boxShadow: 'var(--save-bar-shadow)' }}
        >
            <div className="flex items-center gap-2 text-[13px]">
                <AlertCircle className="w-[14px] h-[14px] text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-amber-600 dark:text-amber-300 font-medium">
                    {t.profile.saveBar.unsavedChanges}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    variant="dashSecondary"
                    size="sm"
                >
                    {t.profile.general.cancel}
                </Button>

                <Button type="submit" disabled={saving} size="sm">
                    {saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Check className="h-3.5 w-3.5" />
                    }
                    {saving ? savingLabel : saveLabel}
                </Button>
            </div>
        </div>
    )
}
