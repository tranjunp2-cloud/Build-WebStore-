'use client'
/** Logs filter bar. Every change writes to the URL (server-side filtering); paging and the open drawer reset. */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { AREA_GROUP_LABELS, AREA_GROUPS, PLAN_GROUP_LABELS, PLAN_GROUPS } from '@/lib/admin/ai-usage/groups'
import type { FilterOptions } from '@/lib/admin/ai-usage/log-queries'
import { OUTCOMES, type LogFilters } from '@/lib/admin/ai-usage/log-filters'

const OUTCOME_LABEL = { ok: 'OK', refused: 'No result', error: 'Error' } as const

export function LogsFilters({ filters, options }: { filters: LogFilters; options: FilterOptions }) {
    const router = useRouter()
    const pathname = usePathname()
    const sp = useSearchParams()
    const [q, setQ] = useState(filters.q ?? '')
    const [, startTransition] = useTransition()
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const set = (key: string, value: string | undefined) => {
        const next = new URLSearchParams(sp.toString())
        for (const k of ['limit', 'log']) next.delete(k)
        if (value) next.set(key, value); else next.delete(key)
        const qs = next.toString()
        startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    }

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
    const onSearch = (value: string) => {
        setQ(value)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => set('q', value.trim() || undefined), 350)
    }

    const select = (key: string, label: string, current: string | undefined, items: Array<{ value: string; label: string }>) => (
        <label className={`btn btn-sm${current ? ' au-on' : ''}`} style={{ position: 'relative' }}>
            <span className="au-dim">{label}</span>
            <select aria-label={label} value={current ?? ''} onChange={(e) => set(key, e.target.value || undefined)}
                style={{ border: 0, background: 'none', color: 'inherit', font: 'inherit', maxWidth: 160, cursor: 'pointer' }}>
                <option value="">All</option>
                {items.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
        </label>
    )

    const active = Boolean(filters.q || filters.plan || filters.area || filters.task || filters.model || filters.outcome || filters.unpriced)
    return (
        <div className="au-filters" role="search" aria-label="Filter AI calls">
            <span className="au-search"><Search size={14} aria-hidden />
                <input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search shop or email" aria-label="Search shop or email" /></span>
            {select('plan', 'Plan', filters.plan, PLAN_GROUPS.map((p) => ({ value: p, label: PLAN_GROUP_LABELS[p] })))}
            {select('area', 'Area', filters.area, AREA_GROUPS.map((a) => ({ value: a, label: AREA_GROUP_LABELS[a] })))}
            {select('task', 'Task', filters.task, options.tasks)}
            {select('model', 'Model', filters.model, options.models.map((m) => ({ value: m, label: m })))}
            {select('outcome', 'Outcome', filters.outcome, OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] })))}
            <label className="au-check"><input type="checkbox" checked={filters.unpriced} onChange={(e) => set('unpriced', e.target.checked ? '1' : undefined)} /><span className="au-box">{filters.unpriced ? '✓' : ''}</span>Unpriced only</label>
            {active && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setQ(''); const next = new URLSearchParams(sp.toString()); for (const k of ['q', 'plan', 'area', 'task', 'model', 'outcome', 'unpriced', 'limit', 'log']) next.delete(k); router.push(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false }) }}><X size={14} />Clear filters</button>}
        </div>
    )
}
