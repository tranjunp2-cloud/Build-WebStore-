'use client'

import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DAY_OF_WEEK_OPTIONS } from '@/lib/seo/local-business-constants'
import type { OpeningHourRow } from './types'

interface OpeningHoursTableProps {
    rows?: OpeningHourRow[]
    fullWidth?: boolean
    onChange: (rows: OpeningHourRow[]) => void
    dayLabels: Record<string, string>
    closedLabel: string
    opensLabel: string
    closesLabel: string
}

// Wireframe §3 "default/empty state" starter suggestion: Mon-Fri open, weekend
// closed — only applied when the site has NO saved opening hours at all, so
// it never overrides a seller's own choices on subsequent renders.
const DEFAULT_CLOSED_DAYS = new Set(['Sa', 'Su'])

function buildFullWeek(rows: OpeningHourRow[] | undefined): OpeningHourRow[] {
    const hasAnyExisting = Array.isArray(rows) && rows.length > 0
    return DAY_OF_WEEK_OPTIONS.map(({ value: dayOfWeek }) => {
        const existing = rows?.find(r => r.dayOfWeek === dayOfWeek)
        if (existing) {
            return {
                dayOfWeek,
                opens: existing.opens || '09:00',
                closes: existing.closes || '18:00',
                isClosed: existing.isClosed ?? false,
            }
        }
        return {
            dayOfWeek,
            opens: '09:00',
            closes: '18:00',
            isClosed: !hasAnyExisting && DEFAULT_CLOSED_DAYS.has(dayOfWeek),
        }
    })
}

/** F37 US-01: 7-row Mo-Su opening-hours editor. Net-new UI (no in-file
 *  precedent). `isClosed` DISABLES (not hides) the time inputs and retains
 *  their values in local state, so un-checking restores them (AC-2) — mirrors
 *  wireframe §6. Mobile <768px collapses the table into stacked day cards
 *  (wireframe §7), reusing the `fullWidth` responsive convention already
 *  established for Logo/Favicon and Phone/Email in `SettingsPanel.tsx`. */
export function OpeningHoursTable({ rows, fullWidth, onChange, dayLabels, closedLabel, opensLabel, closesLabel }: OpeningHoursTableProps) {
    const [week, setWeek] = useState<OpeningHourRow[]>(() => buildFullWeek(rows))

    // Re-sync from parent only when saved data actually differs — not on every
    // local edit's onChange echo, or typed values would fight the update.
    useEffect(() => {
        if (!rows || rows.length === 0) return
        setWeek(prev => {
            const next = buildFullWeek(rows)
            return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
        })
    }, [rows])

    function updateDay(index: number, patch: Partial<OpeningHourRow>) {
        const next = week.map((row, i) => (i === index ? { ...row, ...patch } : row))
        setWeek(next)
        onChange(next)
    }

    // Card layout is the default everywhere — the standard (non-fullWidth)
    // SettingsPanel sidebar is a fixed ~320px column regardless of device
    // screen size, too narrow for a 4-column table. The table only takes over
    // in the fullWidth F05 Tools-sheet context, and only at >=768px viewport.
    return (
        <div>
            <div className={cn('space-y-2', fullWidth && 'min-[768px]:hidden')}>
                {week.map((row, i) => (
                    <div key={row.dayOfWeek} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-200">{dayLabels[row.dayOfWeek || ''] || row.dayOfWeek}</span>
                            <label className="flex items-center gap-2 text-[11px] text-slate-400">
                                <Checkbox
                                    checked={row.isClosed}
                                    onCheckedChange={checked => updateDay(i, { isClosed: checked === true })}
                                    aria-label={`${closedLabel} ${dayLabels[row.dayOfWeek || ''] || row.dayOfWeek}`}
                                />
                                {closedLabel}
                            </label>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <TimeField label={opensLabel} value={row.opens} disabled={row.isClosed} onChange={v => updateDay(i, { opens: v })} />
                            <TimeField label={closesLabel} value={row.closes} disabled={row.isClosed} onChange={v => updateDay(i, { closes: v })} />
                        </div>
                    </div>
                ))}
            </div>

            <div className={cn('overflow-hidden rounded-lg border border-white/10', fullWidth ? 'hidden min-[768px]:block' : 'hidden')}>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="px-2 py-2 text-left font-medium" aria-hidden />
                            <th className="px-2 py-2 text-left font-medium">{closedLabel}</th>
                            <th className="px-2 py-2 text-left font-medium">{opensLabel}</th>
                            <th className="px-2 py-2 text-left font-medium">{closesLabel}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {week.map((row, i) => (
                            <tr key={row.dayOfWeek} className="border-b border-white/[0.06] last:border-0">
                                <td className="px-2 py-2 text-slate-300">{dayLabels[row.dayOfWeek || ''] || row.dayOfWeek}</td>
                                <td className="px-2 py-2">
                                    <Checkbox
                                        checked={row.isClosed}
                                        onCheckedChange={checked => updateDay(i, { isClosed: checked === true })}
                                        aria-label={`${closedLabel} ${dayLabels[row.dayOfWeek || ''] || row.dayOfWeek}`}
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <TimeInput value={row.opens} disabled={row.isClosed} onChange={v => updateDay(i, { opens: v })} />
                                </td>
                                <td className="px-2 py-2">
                                    <TimeInput value={row.closes} disabled={row.isClosed} onChange={v => updateDay(i, { closes: v })} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function TimeInput({ value, disabled, onChange }: { value?: string; disabled?: boolean; onChange: (v: string) => void }) {
    return (
        <input
            type="time"
            value={value || ''}
            disabled={disabled}
            aria-disabled={disabled}
            onChange={e => onChange(e.target.value)}
            className={cn(
                'w-full min-w-0 rounded-md border border-white/10 bg-[var(--editor-surface-elevated)] px-2 py-1.5 text-xs text-white outline-none',
                disabled && 'cursor-not-allowed border-white/[0.04] bg-white/[0.02] text-slate-600',
            )}
        />
    )
}

function TimeField({ label, value, disabled, onChange }: { label: string; value?: string; disabled?: boolean; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-[10px] text-slate-500">{label}</label>
            <div className="mt-1">
                <TimeInput value={value} disabled={disabled} onChange={onChange} />
            </div>
        </div>
    )
}
