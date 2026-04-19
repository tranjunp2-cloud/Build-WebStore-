'use client'
/**
 * Table view — matches bundle .tbl + .tbl-wrap design.
 * Columns: checkbox | thumb | name+tags | category | status | uses | updated | actions
 * Sortable headers, selected-row accent, quality score preserved.
 */
import { useCallback, useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, Star } from 'lucide-react'
import { TemplateStatusPill } from './template-status-pill'
import { TemplateRowActionsMenu } from './template-row-actions-menu'
import { ScoreBadge } from './score-badge'
import type { AdminTemplate, TemplatesFilter } from '@/lib/admin/templates-query'

type QualitySummary = { avgScore: number; passRubric: boolean }

type Props = {
    templates: AdminTemplate[]
    selected: Set<string | number>
    onSelect: (s: Set<string | number>) => void
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    loading: boolean
    filter: TemplatesFilter
    /** When used inside split view: compact mode hides thumbnail column */
    compact?: boolean
    /** Highlight the active row in split view */
    activeId?: string | number | null
    /** Row click handler (split view uses this to open peek panel) */
    onRowClick?: (id: string | number) => void
}

type SortKey = 'name' | 'updatedAt' | 'createdAt' | 'usageCount' | 'sortOrder'

const SORT_MAP: Record<SortKey, { asc: string; desc: string }> = {
    name:       { asc: 'name',       desc: '-name' },
    updatedAt:  { asc: 'updatedAt',  desc: '-updatedAt' },
    createdAt:  { asc: 'createdAt',  desc: '-createdAt' },
    usageCount: { asc: 'usageCount', desc: '-usageCount' },
    sortOrder:  { asc: 'sortOrder',  desc: '-sortOrder' },
}

function SortIcon({ col, currentSort }: { col: SortKey; currentSort: string }) {
    const isAsc  = currentSort === SORT_MAP[col].asc
    const isDesc = currentSort === SORT_MAP[col].desc
    return (
        <span className="sort-icon" style={{ marginLeft: 4 }}>
            <ChevronUp  size={10} style={{ opacity: isAsc  ? 1 : 0.35 }} />
            <ChevronDown size={10} style={{ opacity: isDesc ? 1 : 0.35 }} />
        </span>
    )
}

export function TemplatesTableView({
    templates,
    selected,
    onSelect,
    onFilterChange,
    loading,
    filter,
    compact = false,
    activeId,
    onRowClick,
}: Props) {
    const currentSort = filter.sort ?? '-updatedAt'
    const [qualityMap, setQualityMap] = useState<Map<string | number, QualitySummary>>(new Map())

    // Fetch quality scores for visible templates
    useEffect(() => {
        if (templates.length === 0) return
        let cancelled = false
        const fetchAll = async () => {
            const entries = await Promise.allSettled(
                templates.map(async t => {
                    const res = await fetch(`/api/admin/templates/${t.id}/quality`, { cache: 'no-store' })
                    if (!res.ok) return null
                    const json = await res.json() as { data?: { latest?: { avgScore: number; passRubric: boolean } } }
                    const latest = json?.data?.latest
                    if (!latest) return null
                    return { id: t.id, avgScore: latest.avgScore, passRubric: latest.passRubric }
                }),
            )
            if (cancelled) return
            const next = new Map<string | number, QualitySummary>()
            for (const r of entries) {
                if (r.status === 'fulfilled' && r.value) {
                    next.set(r.value.id, { avgScore: r.value.avgScore, passRubric: r.value.passRubric })
                }
            }
            setQualityMap(next)
        }
        void fetchAll()
        return () => { cancelled = true }
    }, [templates])

    const allIds     = templates.map(t => t.id)
    const allSelected = templates.length > 0 && allIds.every(id => selected.has(id))
    const someSelected = selected.size > 0 && !allSelected

    const toggleAll = useCallback(() => {
        if (allSelected) {
            const next = new Set(selected)
            allIds.forEach(id => next.delete(id))
            onSelect(next)
        } else {
            const next = new Set(selected)
            allIds.forEach(id => next.add(id))
            onSelect(next)
        }
    }, [allSelected, allIds, selected, onSelect])

    const toggleOne = useCallback((id: string | number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        onSelect(next)
    }, [selected, onSelect])

    const handleSort = (col: SortKey) => {
        const isCurrentDesc = currentSort === SORT_MAP[col].desc
        onFilterChange({ sort: isCurrentDesc ? SORT_MAP[col].asc : SORT_MAP[col].desc })
    }

    const handleRefresh = () => onFilterChange({})

    return (
        <div className="tbl-wrap" style={{ position: 'relative' }}>
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, fontSize: 13, color: 'var(--text-3)',
                }}>
                    Loading…
                </div>
            )}

            <table className="tbl">
                <thead>
                    <tr>
                        {/* Master checkbox */}
                        <th className="check-cell">
                            <input
                                type="checkbox"
                                className={`cbx${someSelected ? ' mixed' : ''}`}
                                checked={allSelected}
                                onChange={toggleAll}
                                aria-label="Select all"
                            />
                        </th>
                        {/* Thumbnail — hidden in compact mode */}
                        {!compact && <th className="thumb-cell" />}
                        {/* Name */}
                        <th>
                            <button className="sort-btn" onClick={() => handleSort('name')}>
                                Template <SortIcon col="name" currentSort={currentSort} />
                            </button>
                        </th>
                        {/* Category */}
                        <th style={{ width: 120 }}>Category</th>
                        {/* Status */}
                        <th style={{ width: 110 }}>Status</th>
                        {/* Uses */}
                        <th style={{ width: 80, textAlign: 'right' }}>
                            <button className="sort-btn" style={{ justifyContent: 'flex-end', width: '100%' }} onClick={() => handleSort('usageCount')}>
                                Uses <SortIcon col="usageCount" currentSort={currentSort} />
                            </button>
                        </th>
                        {/* Score — hidden in compact */}
                        {!compact && <th style={{ width: 80 }}>Score</th>}
                        {/* Updated */}
                        <th style={{ width: 90 }}>
                            <button className="sort-btn" onClick={() => handleSort('updatedAt')}>
                                Updated <SortIcon col="updatedAt" currentSort={currentSort} />
                            </button>
                        </th>
                        {/* Actions */}
                        <th className="actions-cell" />
                    </tr>
                </thead>
                <tbody>
                    {templates.length === 0 && !loading && (
                        <tr>
                            <td colSpan={compact ? 7 : 9}>
                                <div className="empty-state">
                                    <h3>No templates found</h3>
                                    <p>Try adjusting the filters or create a new template.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                    {templates.map(t => {
                        const isSelected = selected.has(t.id)
                        const isActive   = activeId === t.id
                        const rowCls     = isSelected || isActive ? 'selected' : ''
                        const tagStr     = Array.isArray(t.tags)
                            ? t.tags.map(x => `#${x.tag}`).join(' ')
                            : ''
                        const catStr = Array.isArray(t.category)
                            ? t.category.slice(0, 2).join(', ')
                            : (t.category ?? '—')

                        return (
                            <tr key={t.id} className={rowCls}>
                                {/* Checkbox */}
                                <td className="check-cell">
                                    <input
                                        type="checkbox"
                                        className="cbx"
                                        checked={isSelected}
                                        onChange={() => toggleOne(t.id)}
                                        aria-label={`Select ${t.name}`}
                                    />
                                </td>

                                {/* Thumbnail */}
                                {!compact && (
                                    <td className="thumb-cell">
                                        {t.thumbnail?.url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={t.thumbnail.url}
                                                alt=""
                                                style={{
                                                    width: 56, height: 35, objectFit: 'cover',
                                                    borderRadius: 'var(--radius-sm)',
                                                }}
                                            />
                                        ) : (
                                            <div
                                                className="ph"
                                                style={{ aspectRatio: '16/10', width: 56, padding: 0, fontSize: 8 }}
                                            >
                                                <span style={{ opacity: 0.6 }}>
                                                    {typeof t.name === 'string' ? t.name.slice(0, 4) : '—'}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                )}

                                {/* Name + tags */}
                                <td
                                    className="name-cell"
                                    onClick={() => onRowClick ? onRowClick(t.id) : undefined}
                                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {t.isFeatured && (
                                            <Star size={12} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                                        )}
                                        <span>{t.name}</span>
                                    </div>
                                    {tagStr && <div className="sub">{tagStr}</div>}
                                </td>

                                {/* Category */}
                                <td>
                                    <span className="chip chip-solid" style={{ alignSelf: 'flex-start' }}>
                                        {catStr}
                                    </span>
                                </td>

                                {/* Status */}
                                <td>
                                    <TemplateStatusPill status={t.status} />
                                </td>

                                {/* Uses */}
                                <td className="num" style={{ textAlign: 'right' }}>
                                    {t.usageCount ? t.usageCount.toLocaleString() : '—'}
                                </td>

                                {/* Score */}
                                {!compact && (
                                    <td>
                                        {qualityMap.has(t.id) ? (
                                            <ScoreBadge
                                                avgScore={qualityMap.get(t.id)!.avgScore}
                                                pass={qualityMap.get(t.id)!.passRubric}
                                                size="sm"
                                            />
                                        ) : (
                                            <span className="muted" style={{ fontSize: 10 }}>—</span>
                                        )}
                                    </td>
                                )}

                                {/* Updated */}
                                <td className="muted">
                                    {new Date(t.updatedAt).toLocaleDateString()}
                                </td>

                                {/* Actions */}
                                <td className="actions-cell">
                                    <TemplateRowActionsMenu template={t} onRefresh={handleRefresh} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
