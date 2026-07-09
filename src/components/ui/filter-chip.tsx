'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GH-1222 — Shared dashboard filter pill (the F33 / Discounts filter chip).
 *
 * Standalone + generic: one pill = one single-select filter (status, type,
 * category, sort…). A page composes as many as it needs next to <TableSearch>,
 * or none. The first option is treated as the "all"/default; the pill renders
 * highlighted when a non-default value is selected.
 */
export function FilterChip<T extends string>({
    icon: Icon,
    label,
    value,
    options,
    onChange,
}: {
    icon?: React.ComponentType<{ className?: string }>
    label: string
    value: T
    options: { key: T; label: string }[]
    onChange: (v: T) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const active = value !== options[0]?.key
    const selected = options.find(o => o.key === value) ?? options[0]

    useEffect(() => {
        if (!open) return
        function onMouseDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                // `chip-trigger` is a marker hook (no styles) so a caller can target just
                // this pill (not the dropdown option buttons) for responsive tweaks.
                // Colors moved from inline `style` to Tailwind classes so `hover:` can apply —
                // inline style values always win over CSS classes, which blocked any hover state.
                // Hover matches the dashSecondary Button pattern (see Discounts "Export CSV") —
                // a subtle surface wash, not a border-color change.
                className={cn(
                    "chip-trigger flex items-center gap-1.5 h-9 px-3 rounded-lg border border-solid text-[13px] font-medium transition-colors cursor-pointer",
                    active
                        ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.18)]"
                        : "bg-[hsl(var(--card))] border-[hsl(var(--input-border))] text-[var(--dash-text-muted)] hover:bg-white/[0.05]"
                )}
            >
                {Icon && <Icon className="chip-icon w-3.5 h-3.5 shrink-0" />}
                {/* Label / separator / value are three marked spans so a caller can hide
                    whichever it wants on narrow screens (each also hides the ` : ` sep):
                    orders hides sep+value (label-only chip), blog hides label+sep
                    (value-only chip). With none hidden it renders "Label : value". */}
                <span className="truncate max-w-[160px]">
                    <span data-chip-label style={{ color: 'var(--dash-text-muted)' }}>{label}</span>
                    <span data-chip-sep style={{ color: 'var(--dash-text-muted)' }}> : </span>
                    <span data-chip-value>{selected?.label}</span>
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    className="absolute top-[calc(100%+4px)] left-0 min-w-[140px] max-h-[300px] overflow-y-auto z-50 rounded-lg"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    {options.map(o => (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => { onChange(o.key); setOpen(false) }}
                            // Theme-aware hover: subtle dark wash on light, light wash on dark
                            // (preflight is off, so utility hovers still need both directions).
                            className="w-full px-4 py-[10px] text-left text-[13px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                            style={{
                                // Selected option → teal (primary) text + nền teal nhạt: trạng thái active rõ ràng.
                                color: o.key === value ? 'hsl(var(--primary))' : 'var(--dash-text-muted)',
                                fontWeight: o.key === value ? 600 : 400,
                                background: o.key === value ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                            }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
