'use client'
/**
 * Grid view: thumbnail cards with status pill, checkbox, row actions.
 */
import { useCallback } from 'react'
import { ImageOff } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { TemplateStatusPill } from './template-status-pill'
import { TemplateRowActionsMenu } from './template-row-actions-menu'
import type { AdminTemplate, TemplatesFilter } from '@/lib/admin/templates-query'

type Props = {
    templates: AdminTemplate[]
    selected: Set<string | number>
    onSelect: (s: Set<string | number>) => void
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    loading: boolean
    filter: TemplatesFilter
}

export function TemplatesGridView({ templates, selected, onSelect, onFilterChange, loading }: Props) {
    const handleRefresh = () => onFilterChange({})

    const toggleOne = useCallback((id: string | number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        onSelect(next)
    }, [selected, onSelect])

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 animate-pulse aspect-[4/3]" />
                ))}
            </div>
        )
    }

    if (templates.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No templates found.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-auto pb-2">
            {templates.map(t => {
                const isSelected = selected.has(t.id)
                return (
                    <div
                        key={t.id}
                        className={`group relative rounded-lg border bg-background overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${
                            isSelected ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => toggleOne(t.id)}
                    >
                        {/* Thumbnail */}
                        <div className="aspect-[16/10] bg-muted relative">
                            {t.thumbnail?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={t.thumbnail.url}
                                    alt={t.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ImageOff size={20} className="text-muted-foreground" />
                                </div>
                            )}
                            {/* Checkbox overlay */}
                            <div
                                className="absolute top-2 left-2"
                                onClick={e => e.stopPropagation()}
                            >
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOne(t.id)}
                                    className="bg-background/80 backdrop-blur-sm"
                                    aria-label={`Select ${t.name}`}
                                />
                            </div>
                            {/* Status pill */}
                            <div className="absolute bottom-2 left-2">
                                <TemplateStatusPill status={t.status} />
                            </div>
                            {/* Actions overlay */}
                            <div
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => e.stopPropagation()}
                            >
                                <TemplateRowActionsMenu template={t} onRefresh={handleRefresh} />
                            </div>
                        </div>

                        {/* Card body */}
                        <div className="p-2.5">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {Array.isArray(t.category) ? t.category[0] : t.category}
                                {t.isPremium && ' · Premium'}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
