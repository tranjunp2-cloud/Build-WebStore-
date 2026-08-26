'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'

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
            {/* Uses the shared <Input> so the border (solid, box-border, full wrap)
                matches every other field in the CMS. White fill (bg-card) in light
                mode so the box reads as a real input, not the page background. */}
            <Input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="h-10 pl-9 pr-3 text-[13px] bg-[hsl(var(--card))]"
            />
        </div>
    )
}
