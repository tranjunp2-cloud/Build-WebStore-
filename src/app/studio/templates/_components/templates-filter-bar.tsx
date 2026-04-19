'use client'
/**
 * Filter bar — bundle-matched design.
 * Status tabs (.tabs) above, then search + selects + seg control in one row (.filters).
 * Search debounced 300ms. Preset status locks the tab row.
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X, Filter, RefreshCw, LayoutList, Grid2X2, PanelRight } from 'lucide-react'
import { CATEGORY_OPTIONS, PERSONALITY_OPTIONS } from '@/lib/admin/templates-query'
import type { TemplatesFilter, TemplateStatus } from '@/lib/admin/templates-query'

const STATUS_TABS: Array<{ id: string; label: string }> = [
    { id: 'all',       label: 'All' },
    { id: 'live',      label: 'Live' },
    { id: 'draft',     label: 'Draft' },
    { id: 'review',    label: 'In Review' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'archived',  label: 'Archived' },
]

type ViewMode = 'table' | 'grid' | 'split'

type Props = {
    filter: TemplatesFilter
    presetStatus?: TemplateStatus
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    totalDocs: number
    view: ViewMode
    onViewChange: (v: ViewMode) => void
    onRefresh: () => void
}

export function TemplatesFilterBar({
    filter,
    presetStatus,
    onFilterChange,
    totalDocs,
    view,
    onViewChange,
    onRefresh,
}: Props) {
    const [localSearch, setLocalSearch] = useState(filter.search ?? '')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        <div>
            {/* Status tabs */}
            {!presetStatus && (
                <div className="tabs">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={currentStatus === tab.id ? 'active' : ''}
                            onClick={() =>
                                onFilterChange({ status: tab.id === 'all' ? undefined : (tab.id as TemplateStatus) })
                            }
                        >
                            {tab.label}
                            {tab.id === currentStatus && (
                                <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>
                                    {totalDocs}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Filters row */}
            <div className="filters">
                {/* Search */}
                <div className="search-wrap">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search by name or tag…"
                        value={localSearch}
                        onChange={e => handleSearch(e.target.value)}
                    />
                    {localSearch && (
                        <button
                            className="icon-btn"
                            style={{ width: 18, height: 18 }}
                            onClick={() => handleSearch('')}
                            aria-label="Clear search"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Category */}
                <select
                    className="select"
                    value={filter.category ?? 'all'}
                    onChange={e => onFilterChange({ category: e.target.value })}
                >
                    <option value="all">All categories</option>
                    {CATEGORY_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>

                {/* Personality */}
                <select
                    className="select"
                    value={filter.personality ?? 'all'}
                    onChange={e => onFilterChange({ personality: e.target.value })}
                    title="Personality — vibe / tone"
                >
                    <option value="all">All personalities</option>
                    {PERSONALITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    className="select"
                    value={filter.sort ?? '-updatedAt'}
                    onChange={e => onFilterChange({ sort: e.target.value })}
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

                {/* More filters stub */}
                <button className="btn btn-sm">
                    <Filter size={13} /> More filters
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Clear active filters */}
                {(filter.search ||
                    (filter.category && filter.category !== 'all') ||
                    (filter.personality && filter.personality !== 'all')) && (
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() =>
                            onFilterChange({
                                search: undefined,
                                category: undefined,
                                personality: undefined,
                            })
                        }
                    >
                        <X size={12} /> Clear
                    </button>
                )}

                {/* Refresh */}
                <button className="btn btn-sm btn-ghost" onClick={onRefresh} title="Refresh">
                    <RefreshCw size={13} />
                </button>

                {/* View toggle — segmented control */}
                <div className="seg">
                    <button
                        className={view === 'table' ? 'active' : ''}
                        onClick={() => onViewChange('table')}
                        title="Table view"
                    >
                        <LayoutList size={13} /> Table
                    </button>
                    <button
                        className={view === 'grid' ? 'active' : ''}
                        onClick={() => onViewChange('grid')}
                        title="Grid view"
                    >
                        <Grid2X2 size={13} /> Grid
                    </button>
                    <button
                        className={view === 'split' ? 'active' : ''}
                        onClick={() => onViewChange('split')}
                        title="Split view"
                    >
                        <PanelRight size={13} /> Split
                    </button>
                </div>
            </div>
        </div>
    )
}
