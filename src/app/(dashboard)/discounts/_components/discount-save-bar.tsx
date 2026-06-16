'use client'

import { Check, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

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
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ color: 'var(--dash-text-muted)', background: 'var(--dash-surface-hover)' }}
                >
                    {d.cancel}
                </button>

                <button
                    type="button"
                    onClick={onSave}
                    disabled={saveDisabled}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40"
                    style={{ background: 'var(--brand, #14b8a6)', color: '#fff' }}
                >
                    {saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Check className="h-3.5 w-3.5" />
                    }
                    {saving ? d.saving : isNew ? d.saveDiscount : d.save}
                </button>
            </div>
        </div>
    )
}
