'use client'

import { Loader2, Check } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

type Props = {
    saving: boolean
    saveLabel: string
    savingLabel: string
    onCancel: () => void
    /** Disables the Save button independent of `saving` (e.g. required fields not filled yet). */
    disabled?: boolean
}

// Inline dirty-tracked action bar (F23 GH-1614 P2) — shared by GeneralInfoTab (P2) and
// SecurityTab (P3). Unlike the old fixed `ProfileSaveBar`, this mounts INSIDE the card's
// <form> flow (no `position:fixed`, no viewport `pb-*` buffer). Parent renders it only
// while `formState.isDirty`; Save is `type="submit"` so it must stay inside the <form>.
export function CardActionBar({ saving, saveLabel, savingLabel, onCancel, disabled = false }: Props) {
    const { t } = useI18n()

    return (
        <div className="mt-2 pt-5 flex gap-3 justify-end">
            <Button
                type="button"
                onClick={onCancel}
                disabled={saving}
                variant="dashSecondary"
                size="dash"
            >
                {t.profile.general.cancel}
            </Button>

            <Button
                type="submit"
                disabled={saving || disabled}
                variant="dashPrimary"
                size="dash"
                className="min-w-[150px]"
            >
                {saving
                    ? <Loader2 className="animate-spin" />
                    : <Check />
                }
                {saving ? savingLabel : saveLabel}
            </Button>
        </div>
    )
}
