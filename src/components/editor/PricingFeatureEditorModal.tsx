'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, PlusCircle, X, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { PricingFeatureMatrixRow } from '@/blocks/pricing/config'
import { useI18n } from '@/i18n'

interface PricingFeatureEditorModalProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    matrix: PricingFeatureMatrixRow[]
    planNames: string[]
    onSave: (m: PricingFeatureMatrixRow[]) => void
}

export default function PricingFeatureEditorModal({ open, onOpenChange, matrix, planNames, onSave }: PricingFeatureEditorModalProps) {
    const { t, ti } = useI18n()
    const s = t.editor.settings
    const [draft, setDraft] = useState<PricingFeatureMatrixRow[]>([])
    const [initial, setInitial] = useState('[]')
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    // Deep copy + pad/truncate values array to match planNames.length on every open
    useEffect(() => {
        setConfirmDiscard(false)
        if (!open) return
        const copy = matrix.map(row => ({
            featureName: row.featureName,
            values: Array.from({ length: planNames.length }, (_, i) => ({ included: row.values[i]?.included ?? false })),
        }))
        setDraft(copy)
        setInitial(JSON.stringify(copy))
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    const isDirty = JSON.stringify(draft) !== initial

    const handleCancel = () => {
        if (isDirty) { setConfirmDiscard(true); return }
        onOpenChange(false)
    }

    const handleSave = () => {
        onSave(draft)
        onOpenChange(false)
    }

    const toggleCell = (rIdx: number, cIdx: number) => {
        setDraft(prev => prev.map((row, ri) =>
            ri !== rIdx ? row : { ...row, values: row.values.map((v, ci) => ci !== cIdx ? v : { included: !v.included }) }
        ))
    }

    const updateFeatureName = (rIdx: number, name: string) => {
        setDraft(prev => prev.map((row, i) => i !== rIdx ? row : { ...row, featureName: name }))
    }

    const addRow = () => {
        setDraft(prev => [...prev, { featureName: '', values: planNames.map(() => ({ included: false })) }])
    }

    const deleteRow = (rIdx: number) => {
        setDraft(prev => prev.filter((_, i) => i !== rIdx))
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
            <DialogContent
                className="w-[768px] max-w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 bg-[#0b1120] border border-[rgba(255,255,255,0.08)] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
                onInteractOutside={e => { e.preventDefault(); handleCancel() }}
                onEscapeKeyDown={e => { e.preventDefault(); handleCancel() }}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white">
                            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="text-[20px] font-bold text-[#f8fafc] leading-7">{s.pricingFeatureModalTitle}</DialogTitle>
                        <p className="text-[14px] text-[rgba(248,250,252,0.6)] mt-0.5 leading-5">
                            {s.pricingFeatureModalSubtitle}
                        </p>
                    </div>
                </div>

                {/* Scrollable table area */}
                <div className="flex-1 overflow-auto px-6 py-3">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[480px]">
                            <thead>
                                <tr className="bg-[#151b2b]">
                                    <th className="text-left p-4 text-[10px] text-white font-bold uppercase tracking-[1px] w-[200px]">
                                        {s.pricingFeatureNameCol}
                                    </th>
                                    {planNames.map((name, i) => (
                                        <th key={i} className="p-4 text-center text-[10px] text-white font-bold uppercase tracking-[1px] min-w-[120px]">
                                            {name || `Plan ${i + 1}`}
                                        </th>
                                    ))}
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {draft.map((row, rIdx) => (
                                    <tr key={rIdx} className="border-t border-[rgba(66,71,84,0.1)]">
                                        <td className="p-1.5 w-[200px]">
                                            <Input
                                                defaultValue={row.featureName}
                                                placeholder={s.pricingFeatureNamePlaceholder}
                                                variant="editor"
                                                onBlur={e => updateFeatureName(rIdx, e.target.value)}
                                            />
                                        </td>
                                        {row.values.map((val, cIdx) => (
                                            <td key={cIdx} className="p-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCell(rIdx, cIdx)}
                                                    aria-label={val.included ? s.pricingIncludedToggle : s.pricingExcludedToggle}
                                                    className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-colors ${
                                                        val.included
                                                            ? 'bg-[rgba(78,222,163,0.1)] hover:bg-[rgba(78,222,163,0.2)]'
                                                            : 'bg-[rgba(255,180,171,0.1)] hover:bg-[rgba(255,180,171,0.2)]'
                                                    }`}
                                                >
                                                    {val.included
                                                        ? <CheckCircle2 className="w-5 h-5 text-[#4ede9f]" />
                                                        : <XCircle className="w-5 h-5 text-[#ff9b8f]" />
                                                    }
                                                </button>
                                            </td>
                                        ))}
                                        <td className="p-1.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => deleteRow(rIdx)}
                                                aria-label={ti(s.pricingDeleteRow, { n: rIdx + 1 })}
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
                        className="mt-6 w-full flex items-center justify-center gap-2 py-[18px] rounded-[16px] border-2 border-dashed border-[rgba(66,71,84,0.3)] text-[14px] text-[#3b82f6] tracking-[0.35px] hover:border-[rgba(66,71,84,0.5)] hover:bg-white/[0.02] transition-colors"
                    >
                        <PlusCircle className="w-5 h-5" />
                        {s.pricingAddFeatureRow}
                    </button>

                    {/* Save Changes — full-width, inside scrollable area */}
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
                    <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] flex-shrink-0">
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
