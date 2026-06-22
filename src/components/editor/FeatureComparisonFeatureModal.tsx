'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, PlusCircle, X, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ComparisonFeature } from '@/blocks/feature-comparison/config'
import { useI18n } from '@/i18n'

interface FeatureComparisonFeatureModalProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    features: ComparisonFeature[]
    productNames: string[]
    onSave: (f: ComparisonFeature[]) => void
}

// Draft row extends ComparisonFeature with a stable key for React reconciliation
type DraftRow = ComparisonFeature & { _key: string }

let _keyCounter = 0
const nextKey = () => String(++_keyCounter)

export default function FeatureComparisonFeatureModal({ open, onOpenChange, features, productNames, onSave }: FeatureComparisonFeatureModalProps) {
    const { t, ti } = useI18n()
    const s = t.editor.settings
    const [draft, setDraft] = useState<DraftRow[]>([])
    const [initial, setInitial] = useState('[]')
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    // Intentional: snapshot features/productNames on modal open.
    // Live updates from parent while modal is open are deliberately ignored
    // (draft-on-open pattern) — see exhaustive-deps disable on next line.
    useEffect(() => {
        setConfirmDiscard(false)
        if (!open) return
        const copy: DraftRow[] = features.map(f => ({
            name: f.name,
            values: Array.from({ length: productNames.length }, (_, i) => f.values[i] ?? false),
            _key: nextKey(),
        }))
        setDraft(copy)
        setInitial(JSON.stringify(copy.map(({ _key, ...rest }) => rest)))
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    // Compare without _key so dirty-check is not affected by internal keys
    const isDirty = JSON.stringify(draft.map(({ _key, ...rest }) => rest)) !== initial

    const handleCancel = () => {
        if (isDirty) { setConfirmDiscard(true); return }
        onOpenChange(false)
    }

    const handleSave = () => {
        // Strip internal _key before persisting
        onSave(draft.map(({ _key, ...rest }) => rest))
        onOpenChange(false)
    }

    const toggleCell = (ri: number, ci: number) => {
        setDraft(prev => prev.map((row, r) =>
            r !== ri ? row : { ...row, values: row.values.map((v, c) => c !== ci ? v : !v) }
        ))
    }

    const updateName = (ri: number, name: string) => {
        setDraft(prev => prev.map((row, i) => i !== ri ? row : { ...row, name }))
    }

    const addRow = () => {
        setDraft(prev => [...prev, { name: '', values: Array(productNames.length).fill(false), _key: nextKey() }])
    }

    const deleteRow = (ri: number) => {
        setDraft(prev => prev.filter((_, i) => i !== ri))
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
            <DialogContent
                className="editor-portal w-[768px] max-w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 bg-[var(--editor-bg)] border-[var(--editor-border)] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
                onInteractOutside={e => { e.preventDefault(); handleCancel() }}
                onEscapeKeyDown={e => { e.preventDefault(); handleCancel() }}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-[var(--editor-border)] flex-shrink-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white">
                            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="text-[20px] font-bold text-[var(--editor-text)] leading-7">{s.fcFeatureModalTitle}</DialogTitle>
                        <p className="text-[14px] text-[var(--editor-text-muted)] mt-0.5 leading-5">
                            {s.fcFeatureModalSubtitle}
                        </p>
                    </div>
                </div>

                {/* Scrollable table area */}
                <div className="flex-1 overflow-auto px-6 py-3">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[480px]">
                            <thead>
                                <tr className="bg-[var(--editor-bg)]">
                                    <th className="text-left p-4 text-[10px] text-white font-bold uppercase tracking-[1px] w-[200px]">
                                        {s.pricingFeatureNameCol}
                                    </th>
                                    {productNames.map((name, i) => (
                                        <th key={i} className="p-4 text-center text-[10px] text-white font-bold uppercase tracking-[1px] min-w-[120px]">
                                            {name || `Product ${i + 1}`}
                                        </th>
                                    ))}
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {draft.map((row, ri) => (
                                    <tr key={row._key} className="border-t border-[var(--editor-border)]">
                                        <td className="p-1.5 w-[200px]">
                                            <Input
                                                defaultValue={row.name}
                                                placeholder={s.pricingFeatureNamePlaceholder}
                                                variant="editor"
                                                onBlur={e => updateName(ri, e.target.value)}
                                            />
                                        </td>
                                        {row.values.map((val, ci) => (
                                            <td key={ci} className="p-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCell(ri, ci)}
                                                    aria-label={val ? s.pricingIncludedToggle : s.pricingExcludedToggle}
                                                    className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-colors ${
                                                        val
                                                            ? 'bg-[hsl(var(--primary)/0.1)] hover:bg-[hsl(var(--primary)/0.2)]'
                                                            : 'bg-[hsl(var(--destructive)/0.1)] hover:bg-[hsl(var(--destructive)/0.2)]'
                                                    }`}
                                                >
                                                    {val
                                                        ? <CheckCircle2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                                                        : <XCircle className="w-5 h-5 text-[hsl(var(--destructive))]" />
                                                    }
                                                </button>
                                            </td>
                                        ))}
                                        <td className="p-1.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => deleteRow(ri)}
                                                aria-label={ti(s.pricingDeleteRow, { n: ri + 1 })}
                                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mx-auto"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={addRow}
                        className="mt-6 w-full flex items-center justify-center gap-2 py-[18px] rounded-[16px] border-2 border-dashed border-[var(--editor-border)] text-[14px] text-[hsl(var(--primary))] tracking-[0.35px] hover:border-[var(--editor-border)] hover:bg-white/[0.02] transition-colors"
                    >
                        <PlusCircle className="w-5 h-5" />
                        {s.pricingAddFeatureRow}
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        className="mt-6 w-full h-[48px] rounded-[10px] text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-teal-400 hover:opacity-90 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.1)] transition-opacity"
                    >
                        {s.pricingSaveChanges}
                    </button>
                </div>

                {/* Footer — only shown when confirming discard */}
                {confirmDiscard && (
                    <div className="px-6 py-4 border-t border-[var(--editor-border)] flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-amber-400">{s.pricingDiscardPrompt}</p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setConfirmDiscard(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/5 transition-colors">
                                    {s.pricingKeepEditing}
                                </button>
                                <button type="button" onClick={() => onOpenChange(false)} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                                    {s.pricingYesDiscard}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
