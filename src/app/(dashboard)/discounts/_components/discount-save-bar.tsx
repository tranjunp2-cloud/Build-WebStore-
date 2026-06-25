'use client'

import { Check, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

interface DiscountSaveBarProps {
    dirty: boolean
    isNew: boolean
    saving: boolean
    onCancel: () => void
    onSave: () => void
}

export function DiscountSaveBar({ dirty, isNew, saving, onCancel, onSave }: DiscountSaveBarProps) {
    const { t } = useI18n()
    const d = t.dashboard.discounts.saveBar

    const statusText = dirty ? d.unsavedChanges : isNew ? d.newDiscount : d.upToDate
    const saveDisabled = saving || (!dirty && !isNew)

    return (
        <div
            className="fixed bottom-0 left-0 right-0 md:left-[250px] flex items-center justify-between gap-3 px-6 py-3 border-t z-40"
            style={{
                background: 'var(--dash-surface)',
                borderColor: 'var(--dash-border)',
                backdropFilter: 'blur(12px)',
            }}
        >
            <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>
                {statusText}
            </span>

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
                    disabled={saveDisabled}
                    variant="dashPrimary"
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
