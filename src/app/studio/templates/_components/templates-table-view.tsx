'use client'
/**
 * Table view: sortable columns, checkbox selection, row actions.
 * Columns: checkbox | name | category | status | personality | updated | usageCount | score | actions
 */
import { useCallback, useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, ImageOff } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
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
}

type SortKey = 'name' | 'updatedAt' | 'createdAt' | 'usageCount' | 'sortOrder'

const SORT_MAP: Record<SortKey, { asc: string; desc: string }> = {
    name: { asc: 'name', desc: '-name' },
    updatedAt: { asc: 'updatedAt', desc: '-updatedAt' },
    createdAt: { asc: 'createdAt', desc: '-createdAt' },
    usageCount: { asc: 'usageCount', desc: '-usageCount' },
    sortOrder: { asc: 'sortOrder', desc: '-sortOrder' },
}

function SortIcon({ col, currentSort }: { col: SortKey; currentSort: string }) {
    const isAsc = currentSort === SORT_MAP[col].asc
    const isDesc = currentSort === SORT_MAP[col].desc
    return (
        <span className="inline-flex flex-col ml-1 opacity-40 group-hover:opacity-80">
            <ChevronUp size={10} className={isAsc ? 'opacity-100 text-foreground' : ''} />
            <ChevronDown size={10} className={isDesc ? 'opacity-100 text-foreground' : ''} />
        </span>
    )
}

export function TemplatesTableView({ templates, selected, onSelect, onFilterChange, loading, filter }: Props) {
    const currentSort = filter.sort ?? '-updatedAt'
    const [qualityMap, setQualityMap] = useState<Map<string | number, QualitySummary>>(new Map())

    // Fetch latest quality scores for visible templates on mount / when list changes
    useEffect(() => {
        if (templates.length === 0) return
        let cancelled = false
        const fetchAll = async () => {
            const entries = await Promise.allSettled(
                templates.map(async (t) => {
                    const res = await fetch(`/api/admin/templates/${t.id}/quality`, { cache: 'no-store' })
                    if (!res.ok) return null
                    const json = await res.json()
                    const latest = json?.data?.latest
                    if (!latest) return null
                    return { id: t.id, avgScore: latest.avgScore as number, passRubric: latest.passRubric as boolean }
                })
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
    const allIds = templates.map(t => t.id)
    const allSelected = templates.length > 0 && allIds.every(id => selected.has(id))

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
        const nextSort = isCurrentDesc ? SORT_MAP[col].asc : SORT_MAP[col].desc
        onFilterChange({ sort: nextSort })
    }

    const handleRefresh = () => onFilterChange({})

    return (
        <div className="relative overflow-auto rounded-md border bg-background">
            {loading && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                    <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
            )}
            <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 sticky top-0 z-[1]">
                    <tr>
                        <th className="w-10 px-3 py-2.5 text-left">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium">
                            <button className="group flex items-center" onClick={() => handleSort('name')}>
                                Name <SortIcon col="name" currentSort={currentSort} />
                            </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Category</th>
                        <th className="px-3 py-2.5 text-left font-medium">Status</th>
                        <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">Personality</th>
                        <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">
                            <button className="group flex items-center" onClick={() => handleSort('updatedAt')}>
                                Updated <SortIcon col="updatedAt" currentSort={currentSort} />
                            </button>
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium hidden sm:table-cell">
                            <button className="group flex items-center justify-end w-full" onClick={() => handleSort('usageCount')}>
                                Uses <SortIcon col="usageCount" currentSort={currentSort} />
                            </button>
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium hidden lg:table-cell">Score</th>
                        <th className="w-10 px-3 py-2.5" />
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {templates.length === 0 && !loading && (
                        <tr>
                            <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">
                                No templates found.
                            </td>
                        </tr>
                    )}
                    {templates.map(t => (
                        <tr key={t.id} className={`hover:bg-muted/30 transition-colors ${selected.has(t.id) ? 'bg-muted/40' : ''}`}>
                            <td className="px-3 py-2.5">
                                <Checkbox
                                    checked={selected.has(t.id)}
                                    onCheckedChange={() => toggleOne(t.id)}
                                    aria-label={`Select ${t.name}`}
                                />
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    {t.thumbnail?.url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={t.thumbnail.url} alt="" className="h-8 w-12 rounded object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                            <ImageOff size={12} className="text-muted-foreground" />
                                        </div>
                                    )}
                                    <span className="font-medium truncate max-w-[200px]">{t.name}</span>
                                </div>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                                <span className="text-muted-foreground text-xs">
                                    {Array.isArray(t.category) ? t.category.slice(0, 2).join(', ') : t.category}
                                </span>
                            </td>
                            <td className="px-3 py-2.5">
                                <TemplateStatusPill status={t.status} />
                            </td>
                            <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                                {t.personality ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                                {new Date(t.updatedAt).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell text-right text-xs text-muted-foreground">
                                {t.usageCount ?? 0}
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell text-right">
                                {qualityMap.has(t.id) ? (
                                    <ScoreBadge
                                        avgScore={qualityMap.get(t.id)!.avgScore}
                                        pass={qualityMap.get(t.id)!.passRubric}
                                        size="sm"
                                    />
                                ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                                <TemplateRowActionsMenu template={t} onRefresh={handleRefresh} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
