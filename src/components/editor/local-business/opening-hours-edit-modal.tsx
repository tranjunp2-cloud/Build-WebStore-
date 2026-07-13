'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DAY_OF_WEEK_OPTIONS } from '@/lib/seo/local-business-constants'
import { isRangeOrderValid, type OpeningHoursMode, type TimeRange } from './opening-hours-utils'
import { TimeRangeRow } from './opening-hours-time-range-row'

const MAX_RANGES = 3

interface ModalLabels {
    title: string
    open24h: string
    closed: string
    opens: string
    closes: string
    addRange: string
    removeRange: string
    invalidRange: string
    save: string
    cancel: string
}

interface OpeningHoursEditModalProps {
    open: boolean
    initialDays: Set<string>
    initialMode: OpeningHoursMode
    initialRanges: TimeRange[]
    dayLabels: Record<string, string>
    labels: ModalLabels
    onSave: (days: Set<string>, mode: OpeningHoursMode, ranges: TimeRange[]) => void
    onClose: () => void
}

/** F37 US-01 follow-up: Google Maps-style "Select days and hours" modal. Controlled
 *  by the parent (opening-hours-editor.tsx) via `open` + `initial*` props — local
 *  state resets every time it (re)opens (mirrors PricingFeatureEditorModal's pattern).
 *  Returns raw selection via `onSave`; does NOT merge into the committed rows itself —
 *  the parent owns `applyBatchSave` so there is exactly one writer of persisted data. */
export function OpeningHoursEditModal({ open, initialDays, initialMode, initialRanges, dayLabels, labels: s, onSave, onClose }: OpeningHoursEditModalProps) {
    const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
    const [mode, setMode] = useState<OpeningHoursMode>('custom')
    const [ranges, setRanges] = useState<TimeRange[]>([{ opens: '', closes: '' }])

    useEffect(() => {
        if (!open) return
        setSelectedDays(new Set(initialDays))
        setMode(initialMode)
        setRanges(initialRanges.length > 0 ? initialRanges : [{ opens: '', closes: '' }])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function toggleDay(day: string) {
        setSelectedDays(prev => {
            const next = new Set(prev)
            if (next.has(day)) next.delete(day)
            else next.add(day)
            return next
        })
    }

    function updateRange(index: number, patch: Partial<TimeRange>) {
        setRanges(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    }

    function addRange() {
        setRanges(prev => (prev.length >= MAX_RANGES ? prev : [...prev, { opens: '', closes: '' }]))
    }

    function removeRange(index: number) {
        setRanges(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
    }

    const hasInvalidRange = mode === 'custom' && ranges.some(r => !isRangeOrderValid(r))

    function handleSave() {
        if (selectedDays.size === 0 || hasInvalidRange) return
        onSave(selectedDays, mode, ranges)
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent
                className="editor-portal w-[440px] max-w-[95vw] max-h-[90vh] overflow-y-auto bg-[var(--editor-surface-elevated)] border-white/10 rounded-2xl p-6"
                onEscapeKeyDown={e => { e.preventDefault(); onClose() }}
            >
                <DialogTitle className="text-base font-semibold text-white">{s.title}</DialogTitle>

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                    {DAY_OF_WEEK_OPTIONS.map(({ value: day }) => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            aria-pressed={selectedDays.has(day)}
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                                selectedDays.has(day)
                                    ? 'border-blue-400/50 bg-blue-500/20 text-blue-300'
                                    : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]',
                            )}
                        >
                            {dayLabels[day] || day}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                        <Checkbox
                            checked={mode === 'open24h'}
                            onCheckedChange={c => setMode(c === true ? 'open24h' : 'custom')}
                            className="border-white/30 bg-white/5 data-[state=checked]:border-blue-400 data-[state=checked]:bg-blue-500"
                        />
                        {s.open24h}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                        <Checkbox
                            checked={mode === 'closed'}
                            onCheckedChange={c => setMode(c === true ? 'closed' : 'custom')}
                            className="border-white/30 bg-white/5 data-[state=checked]:border-blue-400 data-[state=checked]:bg-blue-500"
                        />
                        {s.closed}
                    </label>
                </div>

                {mode === 'custom' && (
                    <div className="mt-4 space-y-3">
                        {ranges.map((range, i) => (
                            <TimeRangeRow
                                key={i}
                                range={range}
                                invalid={!isRangeOrderValid(range)}
                                canRemove={ranges.length > 1}
                                opensLabel={s.opens}
                                closesLabel={s.closes}
                                removeLabel={s.removeRange}
                                invalidLabel={s.invalidRange}
                                onUpdate={patch => updateRange(i, patch)}
                                onRemove={() => removeRange(i)}
                            />
                        ))}
                        {ranges.length < MAX_RANGES && (
                            <button
                                type="button"
                                onClick={addRange}
                                className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                            >
                                {s.addRange}
                            </button>
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5"
                    >
                        {s.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={selectedDays.size === 0 || hasInvalidRange}
                        className="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {s.save}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
