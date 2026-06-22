'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GH-1222 — Shared dashboard search box (the F33 / Discounts search input).
 *
 * Standalone on purpose: a list page that only needs search imports just this,
 * without pulling in any filter UI. Pages that also filter compose it next to
 * <FilterChip> (see ui/filter-chip.tsx).
 *
 * Debounced (400ms) with a value-compare guard: onSearch fires only when the
 * input actually CHANGED from the last propagated value, so the mount run never
 * reaches the parent's setPage(1) (which would clobber a ?page=N restored from
 * the URL). Comparing values — not a first-run ref flag — stays correct under
 * React Strict Mode's double-effect.
 */
export function TableSearch({
    value,
    onSearch,
    placeholder,
    debounceMs = 400,
    className,
}: {
    value: string
    onSearch: (q: string) => void
    placeholder?: string
    debounceMs?: number
    className?: string
}) {
    const [input, setInput] = useState(value)

    // Re-sync local input when the committed value is reset externally (e.g. clear filters).
    useEffect(() => { setInput(value) }, [value])

    const lastSent = useRef(value)
    useEffect(() => {
        if (input === lastSent.current) return
        const timer = setTimeout(() => {
            lastSent.current = input
            onSearch(input)
        }, debounceMs)
        return () => clearTimeout(timer)
    }, [input, onSearch, debounceMs])

    return (
        <div className={cn('relative flex-1 min-w-[200px] max-w-[360px]', className)}>
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--dash-text-muted)' }}
            />
            <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full h-9 rounded-md pl-9 pr-3 text-[13px] outline-none transition-colors [border:1px_solid_hsl(var(--input-border))] focus:[border-color:hsl(var(--primary))] focus:[box-shadow:0_0_0_3px_hsl(var(--ring)/0.25)]"
                style={{
                    // Transparent fill to match the FilterChip pills (same height).
                    background: 'transparent',
                    color: 'var(--dash-text)',
                }}
            />
        </div>
    )
}
