'use client'
/**
 * Split view: table on left, drawer panel on right.
 * Click a row to open drawer. Drawer closes when another row is clicked or X pressed.
 */
import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { TemplateStatusPill } from './template-status-pill'
import { TemplateRowActionsMenu } from './template-row-actions-menu'
import { TemplateDrawer } from './template-drawer'
import type { AdminTemplate, TemplatesFilter } from '@/lib/admin/templates-query'

type Props = {
    templates: AdminTemplate[]
    selected: Set<string | number>
    onSelect: (s: Set<string | number>) => void
    onFilterChange: (updated: Partial<TemplatesFilter>) => void
    loading: boolean
    filter: TemplatesFilter
}

export function TemplatesSplitView({ templates, selected, onSelect, onFilterChange, loading }: Props) {
    const [activeId, setActiveId] = useState<string | number | null>(null)
    const activeTemplate = templates.find(t => t.id === activeId) ?? null
    const handleRefresh = () => onFilterChange({})

    const toggleOne = (id: string | number) => {
        const next = new Set(selected)
        next.has(id) ? next.delete(id) : next.add(id)
        onSelect(next)
    }

    return (
        <div className="flex h-full gap-0 border rounded-md overflow-hidden bg-background">
            {/* Left: compact list */}
            <div className={`flex flex-col overflow-auto border-r transition-all ${activeTemplate ? 'w-[55%]' : 'w-full'}`}>
                {loading && (
                    <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        Loading…
                    </div>
                )}
                {!loading && templates.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        No templates found.
                    </div>
                )}
                {templates.map(t => {
                    const isActive = t.id === activeId
                    const isSelected = selected.has(t.id)
                    return (
                        <div
                            key={t.id}
                            onClick={() => setActiveId(isActive ? null : t.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer transition-colors ${
                                isActive ? 'bg-accent' : 'hover:bg-muted/40'
                            }`}
                        >
                            {/* Checkbox */}
                            <div onClick={e => { e.stopPropagation(); toggleOne(t.id) }}>
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOne(t.id)}
                                    aria-label={`Select ${t.name}`}
                                />
                            </div>

                            {/* Thumbnail */}
                            {t.thumbnail?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={t.thumbnail.url}
                                    alt=""
                                    className="h-9 w-14 rounded object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="h-9 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <ImageOff size={12} className="text-muted-foreground" />
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{t.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {Array.isArray(t.category) ? t.category[0] : t.category}
                                </p>
                            </div>

                            <TemplateStatusPill status={t.status} />

                            <div onClick={e => e.stopPropagation()}>
                                <TemplateRowActionsMenu template={t} onRefresh={handleRefresh} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Right: drawer panel */}
            {activeTemplate && (
                <div className="flex-1 min-w-0 overflow-hidden">
                    <TemplateDrawer
                        template={activeTemplate}
                        onClose={() => setActiveId(null)}
                    />
                </div>
            )}

            {/* Empty state when no row selected */}
            {!activeTemplate && (
                <div className="hidden md:flex flex-1 items-center justify-center text-sm text-muted-foreground border-l">
                    Select a template to preview
                </div>
            )}
        </div>
    )
}
