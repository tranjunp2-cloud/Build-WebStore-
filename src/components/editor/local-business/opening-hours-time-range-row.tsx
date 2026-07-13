'use client'

import { useId } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimeRange } from './opening-hours-utils'

const TIME_INPUT_BASE = 'w-full rounded-md border bg-[var(--editor-bg)] px-3 pb-1.5 pt-3 text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:hover:opacity-100'

interface TimeRangeRowProps {
    range: TimeRange
    invalid: boolean
    canRemove: boolean
    opensLabel: string
    closesLabel: string
    removeLabel: string
    invalidLabel: string
    onUpdate: (patch: Partial<TimeRange>) => void
    onRemove: () => void
}

/** One "Opens / Closes" time-range row inside the opening-hours edit modal.
 *  Extracted from the modal to keep that file under the project's 200-line cap. */
export function TimeRangeRow({ range, invalid, canRemove, opensLabel, closesLabel, removeLabel, invalidLabel, onUpdate, onRemove }: TimeRangeRowProps) {
    const rowId = useId()
    const opensId = `${rowId}-opens`
    const closesId = `${rowId}-closes`
    const errorId = `${rowId}-error`

    return (
        <div>
            <div className="flex items-end gap-2">
                <div className="relative flex-1">
                    <input
                        id={opensId}
                        type="time"
                        value={range.opens}
                        onChange={e => onUpdate({ opens: e.target.value })}
                        className={cn(TIME_INPUT_BASE, 'border-white/15 focus:border-blue-400/60')}
                    />
                    <label htmlFor={opensId} className="absolute -top-2 left-2 bg-[var(--editor-surface-elevated)] px-1 text-[10px] text-slate-400">{opensLabel}</label>
                </div>
                <div className="relative flex-1">
                    <input
                        id={closesId}
                        type="time"
                        value={range.closes}
                        onChange={e => onUpdate({ closes: e.target.value })}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? errorId : undefined}
                        className={cn(TIME_INPUT_BASE, invalid ? 'border-red-400/60 focus:border-red-400' : 'border-white/15 focus:border-blue-400/60')}
                    />
                    <label htmlFor={closesId} className={cn('absolute -top-2 left-2 bg-[var(--editor-surface-elevated)] px-1 text-[10px]', invalid ? 'text-red-400' : 'text-slate-400')}>{closesLabel}</label>
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={!canRemove}
                    aria-label={removeLabel}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {invalid && <p id={errorId} className="mt-1 text-[10px] text-red-400">{invalidLabel}</p>}
        </div>
    )
}
