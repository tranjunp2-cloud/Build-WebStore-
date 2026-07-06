"use client"

import { AlertCircle, RotateCcw, Save } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

type Props = {
    isDirty: boolean
    isSaving: boolean
    lastSaveSucceeded: boolean
    onReset: () => void
    onSave: () => void
}

// GH-1509 bug #12: aligned to the same save-bar template as
// PaymentsFormClient.tsx (sticky positioning, `--save-bar-bg` token, amber
// "unsaved changes" indicator, `size="sm"` buttons) — was previously a
// bespoke natural+scroll-triggered-fixed-copy layout with a different
// background token, which read as visually inconsistent with Payments.
export function SettingsFooter({ isDirty, isSaving, onReset, onSave }: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping

    // Only rendered while dirty (bug #11) — so this bar, whenever visible, always means
    // "there's something unsaved right now". No "all saved" branch here: that would
    // contradict the bar's own presence (lastSaveSucceeded can still be stale-true from a
    // previous save while the user has since made a new edit).
    if (!isDirty) return null

    return (
        <div
            className="sticky bottom-4 z-40 flex items-center justify-between px-[18px] py-[12px] rounded-[14px] border border-white/[0.08] mt-6"
            style={{ background: 'var(--save-bar-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.6)' }}
        >
            <div className="flex items-center gap-2 text-[13px]">
                <AlertCircle className="w-[14px] h-[14px] text-amber-400 shrink-0" />
                <span className="text-amber-300 font-medium">{s.unsavedChanges}</span>
            </div>
            <div className="flex gap-2">
                <Button
                    type="button"
                    onClick={onReset}
                    variant="dashSecondary"
                    size="sm"
                    disabled={isSaving}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {s.resetToDefaults}
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={!isDirty || isSaving}
                    size="sm"
                    className="gap-1.5"
                >
                    <Save className="w-[13px] h-[13px]" />
                    {isSaving ? s.saving : s.saveChanges}
                </Button>
            </div>
        </div>
    )
}
