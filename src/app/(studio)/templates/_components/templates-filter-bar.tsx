'use client'
/**
 * Filter bar: status tabs, category dropdown, personality dropdown, search input.
 * Search debounced 300ms. Status tabs show counts from totalDocs.
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CATEGORY_OPTIONS, PERSONALITY_OPTIONS } from '@/lib/admin/templates-query'
import type { TemplatesFilter, TemplateStatus } from '@/lib/admin/templates-query'

const STATUS_TABS: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'Live' },
    { id: 'draft', label: 'Draft' },
    { id: 'review', label: 'In Review' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'archived', label: 'Archived' },
]

type Props = {
    filter: TemplatesFilter
    presetStatus?: TemplateStatus
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    totalDocs: number
}

export function TemplatesFilterBar({ filter, presetStatus, onFilterChange, totalDocs }: Props) {
    const [localSearch, setLocalSearch] = useState(filter.search ?? '')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync external search reset
    useEffect(() => {
        setLocalSearch(filter.search ?? '')
    }, [filter.search])

    const handleSearch = (value: string) => {
        setLocalSearch(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            onFilterChange({ search: value || undefined })
        }, 300)
    }

    const currentStatus = filter.status ?? 'all'

    return (
        <div className="flex flex-col gap-2">
            {/* Status tabs — hidden if page has a presetStatus (sub-routes) */}
            {!presetStatus && (
                <div className="flex items-center gap-1 border-b pb-2">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onFilterChange({ status: tab.id === 'all' ? undefined : tab.id })}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                currentStatus === tab.id
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                        >
                            {tab.label}
                            {tab.id === currentStatus && (
                                <span className="ml-1.5 text-xs opacity-70">{totalDocs}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Secondary filters row */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search templates…"
                        value={localSearch}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full rounded-md border bg-background pl-8 pr-8 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                    {localSearch && (
                        <button
                            onClick={() => handleSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Category */}
                <select
                    value={filter.category ?? 'all'}
                    onChange={e => onFilterChange({ category: e.target.value })}
                    className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                    <option value="all">All categories</option>
                    {CATEGORY_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>

                {/* Personality */}
                <select
                    value={filter.personality ?? 'all'}
                    onChange={e => onFilterChange({ personality: e.target.value })}
                    className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                    <option value="all">All personalities</option>
                    {PERSONALITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    value={filter.sort ?? '-updatedAt'}
                    onChange={e => onFilterChange({ sort: e.target.value })}
                    className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                    <option value="-updatedAt">Updated (newest)</option>
                    <option value="updatedAt">Updated (oldest)</option>
                    <option value="-createdAt">Created (newest)</option>
                    <option value="createdAt">Created (oldest)</option>
                    <option value="name">Name A–Z</option>
                    <option value="-name">Name Z–A</option>
                    <option value="-usageCount">Most used</option>
                    <option value="sortOrder">Sort order</option>
                </select>

                {/* Active filter chips */}
                {(filter.search || (filter.category && filter.category !== 'all') || (filter.personality && filter.personality !== 'all')) && (
                    <button
                        onClick={() => onFilterChange({ search: undefined, category: undefined, personality: undefined })}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                        <X size={11} /> Clear filters
                    </button>
                )}
            </div>
        </div>
    )
}
