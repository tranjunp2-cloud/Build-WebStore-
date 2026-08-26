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
    const hasIncompleteRange = mode === 'custom' && ranges.some(r => !r.opens || !r.closes)
    const isSaveDisabled = selectedDays.size === 0 || hasIncompleteRange || hasInvalidRange

    function handleSave() {
        if (isSaveDisabled) return
        onSave(selectedDays, mode, ranges)
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent
                className="editor-portal w-[440px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 !bg-white p-6 text-[#22313f] dark:border-slate-700 dark:!bg-slate-800 dark:text-slate-50"
                onEscapeKeyDown={e => { e.preventDefault(); onClose() }}
            >
                <DialogTitle className="text-base font-semibold text-[#22313f] dark:text-slate-50">{s.title}</DialogTitle>

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                    {DAY_OF_WEEK_OPTIONS.map(({ value: day }) => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            aria-pressed={selectedDays.has(day)}
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-full border border-solid text-xs font-medium',
                                selectedDays.has(day)
                                    ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                            )}
                        >
                            {dayLabels[day] || day}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <Checkbox
                            checked={mode === 'open24h'}
                            onCheckedChange={c => setMode(c === true ? 'open24h' : 'custom')}
                            className="h-5 w-5 rounded-md border-2 border-solid border-slate-500 bg-slate-50 shadow-sm data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:border-slate-500 dark:bg-slate-900 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500"
                        />
                        {s.open24h}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <Checkbox
                            checked={mode === 'closed'}
                            onCheckedChange={c => setMode(c === true ? 'closed' : 'custom')}
                            className="h-5 w-5 rounded-md border-2 border-solid border-slate-500 bg-slate-50 shadow-sm data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:border-slate-500 dark:bg-slate-900 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500"
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
                                className="rounded-full border border-solid border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
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
                        className="h-9 rounded-lg border border-solid border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        {s.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaveDisabled}
                        className={cn('h-9 rounded-lg border border-solid px-4 text-xs font-medium', isSaveDisabled ? 'cursor-not-allowed border-slate-400 bg-slate-300 text-slate-700 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100' : 'border-blue-600 bg-blue-600 text-blue-50 hover:border-blue-700 hover:bg-blue-700')}
                    >
                        {s.save}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
