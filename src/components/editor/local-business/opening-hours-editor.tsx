'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OpeningHourRow } from './types'
import { groupRowsByDay, rangesFromDay, applyBatchSave, describeDay, type OpeningHoursMode, type TimeRange } from './opening-hours-utils'
import { OpeningHoursEditModal } from './opening-hours-edit-modal'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr']
const WEEKEND = ['Sa', 'Su']
const ALL_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

interface OpeningHoursEditorProps {
    rows?: OpeningHourRow[]
    fullWidth?: boolean
    onChange: (rows: OpeningHourRow[]) => void
    dayLabels: Record<string, string>
    closedLabel: string
    opensLabel: string
    closesLabel: string
    editAllLabel: string
    editWeekdaysLabel: string
    editWeekendLabel: string
    editDayAriaTemplate: string
    modalTitle: string
    open24hLabel: string
    addRangeLabel: string
    removeRangeLabel: string
    invalidRangeLabel: string
    saveLabel: string
    cancelLabel: string
    notSetLabel: string
    setLabel: string
}

interface ModalState {
    open: boolean
    days: Set<string>
    mode: OpeningHoursMode
    ranges: TimeRange[]
}

const CLOSED_MODAL: ModalState = { open: false, days: new Set(), mode: 'custom', ranges: [] }

/** F37 US-01 follow-up: Google Maps-style opening-hours list + modal orchestration
 *  (replaces the old fixed-7-row inline table). Reads committed `rows` from the
 *  parent, renders a grouped-by-day list, and is the ONLY writer of `onChange` —
 *  the modal returns raw selection only, this component owns `applyBatchSave`.
 *  Empty state (`rows` undefined/empty) explicitly asks the user to set hours;
 *  no suggested schedule is rendered as if it were saved data. */
export function OpeningHoursEditor({
    rows, fullWidth, onChange, dayLabels, closedLabel, opensLabel, closesLabel,
    editAllLabel, editWeekdaysLabel, editWeekendLabel, editDayAriaTemplate,
    modalTitle, open24hLabel, addRangeLabel, removeRangeLabel, invalidRangeLabel, saveLabel, cancelLabel,
    notSetLabel, setLabel,
}: OpeningHoursEditorProps) {
    const [modal, setModal] = useState<ModalState>(CLOSED_MODAL)

    const hasAnyData = Array.isArray(rows) && rows.length > 0
    const groups = groupRowsByDay(rows)

    function openForDays(days: string[]) {
        const { mode, ranges } = hasAnyData
            ? rangesFromDay(groups.find(g => g.day === days[0])?.rows || [])
            : { mode: 'custom' as const, ranges: [] }
        setModal({ open: true, days: new Set(days), mode, ranges })
    }

    function handleSave(days: Set<string>, mode: OpeningHoursMode, ranges: TimeRange[]) {
        onChange(applyBatchSave(rows, days, mode, ranges))
        setModal(CLOSED_MODAL)
    }

    return (
        <div className={cn('space-y-1.5', fullWidth && 'min-[768px]:max-w-md')}>
            {!hasAnyData ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-4">
                    <p className="text-xs text-slate-400">{notSetLabel}</p>
                    <button
                        type="button"
                        onClick={() => openForDays(ALL_DAYS)}
                        className="mt-3 rounded-full border border-white/20 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-400/40 hover:bg-white/10 hover:text-blue-300"
                    >
                        {setLabel}
                    </button>
                </div>
            ) : (
                <>
            {groups.map(({ day, rows: dayRows }) => {
                const lines = describeDay(dayRows, closedLabel)
                return (
                    <div key={day} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                        <span className="w-20 shrink-0 text-xs font-medium text-slate-200">{dayLabels[day] || day}</span>
                        <div className="flex-1 text-right text-xs text-slate-400">
                            {lines.length > 0 ? lines.map((line, i) => <div key={i}>{line}</div>) : <span className="text-slate-600">—</span>}
                        </div>
                        <button
                            type="button"
                            onClick={() => openForDays([day])}
                            aria-label={editDayAriaTemplate.replace('{day}', dayLabels[day] || day)}
                            className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )
            })}

            <div className="flex flex-wrap gap-2 pt-1">
                {[
                    { label: editAllLabel, days: ALL_DAYS },
                    { label: editWeekdaysLabel, days: WEEKDAYS },
                    { label: editWeekendLabel, days: WEEKEND },
                ].map(({ label, days }) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => openForDays(days)}
                        className="shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-400/40 hover:bg-white/10 hover:text-blue-300"
                    >
                        {label}
                    </button>
                ))}
            </div>
                </>
            )}

            <OpeningHoursEditModal
                open={modal.open}
                initialDays={modal.days}
                initialMode={modal.mode}
                initialRanges={modal.ranges}
                dayLabels={dayLabels}
                labels={{
                    title: modalTitle,
                    open24h: open24hLabel,
                    closed: closedLabel,
                    opens: opensLabel,
                    closes: closesLabel,
                    addRange: addRangeLabel,
                    removeRange: removeRangeLabel,
                    invalidRange: invalidRangeLabel,
                    save: saveLabel,
                    cancel: cancelLabel,
                }}
                onSave={handleSave}
                onClose={() => setModal(CLOSED_MODAL)}
            />
        </div>
    )
}
